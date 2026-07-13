#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromWeb = createRequire(path.join(repoRoot, "web", "package.json"));
const ts = requireFromWeb("typescript");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function loadTypeScriptModule(relativePath, mocks = {}) {
  const filename = path.join(repoRoot, relativePath);
  const { outputText } = ts.transpileModule(read(relativePath), {
    fileName: filename,
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) {
      return mocks[specifier];
    }

    throw new Error(`${relativePath} imported unexpected module: ${specifier}`);
  };
  const wrapper = vm.runInThisContext(
    `(function (exports, require, module, __filename, __dirname) { ${outputText}\n})`,
    { filename },
  );

  wrapper(module.exports, localRequire, module, filename, path.dirname(filename));
  return module.exports;
}

const nextServerMock = {
  NextResponse: {
    json(body, init = {}) {
      return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: init.headers,
      });
    },
  },
};

const bypassHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-NutsNews-Cache-Policy": "bypass-cache",
};

async function testDefinitionsAndFailureFallback() {
  const definitions = loadTypeScriptModule("web/lib/runtimeFeatureFlagDefinitions.ts");
  const serverFlags = loadTypeScriptModule("web/lib/runtimeFeatureFlags.ts", {
    "server-only": {},
    "@/lib/supabase": { getServerSupabase() {} },
    "@/lib/runtimeFeatureFlagDefinitions": definitions,
  });

  assert.equal(definitions.isRuntimeFeatureFlagKey("reader_archive_search"), true);
  assert.equal(definitions.isRuntimeFeatureFlagKey("unknown_flag"), false);

  const resolved = definitions.resolveRuntimeFeatureFlags([
    { key: "reader_archive_search", enabled: false },
    { key: "unknown_flag", enabled: true },
    { key: "worker_public_feed_edge_snapshot_publish", enabled: "true" },
  ]);
  assert.equal(resolved.find((flag) => flag.key === "reader_archive_search")?.enabled, false);
  assert.equal(
    resolved.find((flag) => flag.key === "worker_public_feed_edge_snapshot_publish")?.enabled,
    true,
  );

  const fallback = await serverFlags.getRuntimeFeatureFlags(async () => {
    throw new Error("storage unavailable");
  });
  assert.equal(fallback.every((flag) => flag.enabled === flag.defaultValue), true);
}

async function testSearchRouteEnabledAndDisabled() {
  let enabled = false;
  let searchCalls = 0;
  const searchRoute = loadTypeScriptModule("web/app/api/search/route.ts", {
    "next/server": nextServerMock,
    "@/lib/articles": {
      SEARCH_PAGE_SIZE: 5,
      async searchPublishedArticles(query, page, limit, languageCode) {
        searchCalls += 1;
        return { articles: [], nextPage: null, query, page, pageSize: limit, languageCode };
      },
    },
    "@/lib/cacheHeaders": { BYPASS_CACHE_HEADERS: bypassHeaders },
    "@/lib/languages": { normalizeLanguageCode: () => "en" },
    "@/lib/logger": { async logError() {}, async logInfoSampled() {} },
    "@/lib/runtimeFeatureFlags": {
      async isRuntimeFeatureFlagEnabled() {
        return enabled;
      },
    },
  });

  const disabledResponse = await searchRoute.GET(
    new Request("https://www.nutsnews.com/api/search?q=community"),
  );
  assert.equal(disabledResponse.status, 503);
  assert.equal(disabledResponse.headers.get("Cache-Control"), "no-store, max-age=0");
  assert.equal(searchCalls, 0);
  assert.equal((await disabledResponse.json()).error, "Archive search is temporarily unavailable");

  enabled = true;
  const enabledResponse = await searchRoute.GET(
    new Request("https://www.nutsnews.com/api/search?q=community"),
  );
  assert.equal(enabledResponse.status, 200);
  assert.equal(searchCalls, 1);
}

function testMigrationAndAdminSafety() {
  const migration = read("supabase/migrations/20260712160000_create_runtime_feature_flags.sql");
  const protectedLayout = read("web/app/admin/(protected)/layout.tsx");
  const adminPage = read("web/app/admin/(protected)/feature-flags/page.tsx");

  for (const token of [
    "create table if not exists public.runtime_feature_flags",
    "reader_archive_search",
    "worker_public_feed_edge_snapshot_publish",
    "enable row level security",
    "revoke all on table public.runtime_feature_flags from anon, authenticated",
    "updated_at timestamptz not null default now()",
  ]) {
    assert(migration.includes(token), `migration is missing ${token}`);
  }

  for (const token of ["const session = await auth()", "isAllowedAdminEmail", 'redirect("/admin/login")']) {
    assert(protectedLayout.includes(token), `protected admin layout is missing ${token}`);
  }
  assert(adminPage.includes("getRuntimeFeatureFlags"));
  assert(adminPage.includes("Read-only operations view"));
  assert.equal(adminPage.includes("<form"), false);
  assert.equal(adminPage.includes("action="), false);
}

await testDefinitionsAndFailureFallback();
await testSearchRouteEnabledAndDisabled();
testMigrationAndAdminSafety();

console.log("Runtime feature-flag regression checks passed.");
