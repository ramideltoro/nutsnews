import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import test from "node:test";

import { callBackendDatabaseOperation } from "../web/backendDatabase.mjs";
import {
  RuntimeSafetyError,
  assertDataRead,
  assertSupabasePrimaryAllowed,
  getDatabaseProviderMode,
  getRuntimeSafetyPolicy,
  getSafeReadiness,
  isSupabasePrimaryRequired,
} from "../web/runtimeSafety.mjs";

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function stagingSupabasePrimary(overrides = {}) {
  return {
    NUTSNEWS_RUNTIME_ENV: "staging",
    NUTSNEWS_SIDE_EFFECTS_MODE: "disabled",
    NUTSNEWS_DATA_ENVIRONMENT: "staging",
    NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "staging",
    NUTSNEWS_SUPABASE_PROJECT_REF: "stage-project",
    NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "production-project",
    NUTSNEWS_PUBLIC_SUPABASE_URL: "https://stage-project.supabase.co",
    NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    ...overrides,
  };
}

function stagingBackendPrimary(overrides = {}) {
  return {
    NUTSNEWS_RUNTIME_ENV: "staging",
    NUTSNEWS_SIDE_EFFECTS_MODE: "sandbox",
    NUTSNEWS_DATA_ENVIRONMENT: "staging",
    NUTSNEWS_DATABASE_PROVIDER_MODE: "backend_postgres_primary",
    NUTSNEWS_BACKEND_POSTGRES_PRIMARY_CONFIRMATION: "enable-backend-postgres-primary",
    NUTSNEWS_BACKEND_API_URL: "http://127.0.0.1:8787/api/app/db",
    NUTSNEWS_BACKEND_API_TOKEN: "server-only-backend-token",
    ...overrides,
  };
}

test("Supabase primary remains the safe default rollback mode", () => {
  const environment = stagingSupabasePrimary();
  const policy = getRuntimeSafetyPolicy(environment);

  assert.equal(policy.ready, true);
  assert.equal(policy.databaseProviderMode, "supabase_primary");
  assert.equal(getDatabaseProviderMode(environment), "supabase_primary");
  assert.equal(isSupabasePrimaryRequired(environment), true);
  assert.doesNotThrow(() => assertSupabasePrimaryAllowed("rollback-reader", environment));
});

test("Backend shadow requires both Supabase primary and backend API config", () => {
  assert.equal(
    getRuntimeSafetyPolicy(
      stagingSupabasePrimary({ NUTSNEWS_DATABASE_PROVIDER_MODE: "backend_postgres_shadow" }),
    ).code,
    "backend_api_config_missing",
  );

  const ready = getRuntimeSafetyPolicy(
    stagingSupabasePrimary({
      NUTSNEWS_DATABASE_PROVIDER_MODE: "backend_postgres_shadow",
      NUTSNEWS_BACKEND_API_URL: "https://backend.nutsnews.com/api/app/db",
      NUTSNEWS_BACKEND_API_TOKEN: "server-only-shadow-token",
    }),
  );
  assert.equal(ready.ready, true);
  assert.equal(ready.databaseProviderMode, "backend_postgres_shadow");
});

test("Backend primary can be configured for non-production without Supabase bindings", () => {
  const environment = stagingBackendPrimary();
  const policy = getRuntimeSafetyPolicy(environment);
  const safeReadiness = getSafeReadiness(environment);
  const serializedReadiness = JSON.stringify(safeReadiness);

  assert.equal(policy.ready, true);
  assert.equal(policy.databaseProviderMode, "backend_postgres_primary");
  assert.equal(isSupabasePrimaryRequired(environment), false);
  assert.doesNotThrow(() => assertDataRead("backend-primary-reader", environment));
  assert.throws(
    () => assertSupabasePrimaryAllowed("backend-primary-reader", environment),
    (error) =>
      error instanceof RuntimeSafetyError &&
      error.code === "supabase_access_disabled_for_backend_primary",
  );
  assert.doesNotMatch(serializedReadiness, /server-only-backend-token/);
  assert.doesNotMatch(serializedReadiness, /127\.0\.0\.1/);
});

test("Backend primary fails closed without confirmation or valid backend API URL", () => {
  assert.equal(
    getRuntimeSafetyPolicy(
      stagingBackendPrimary({ NUTSNEWS_BACKEND_POSTGRES_PRIMARY_CONFIRMATION: "" }),
    ).code,
    "backend_postgres_primary_confirmation_missing",
  );
  assert.equal(
    getRuntimeSafetyPolicy(
      stagingBackendPrimary({ NUTSNEWS_BACKEND_API_URL: "http://backend.nutsnews.com/api/app/db" }),
    ).code,
    "backend_api_url_invalid",
  );
  assert.equal(
    getRuntimeSafetyPolicy(
      stagingSupabasePrimary({ NUTSNEWS_DATABASE_PROVIDER_MODE: "backend_postgres_primary" }),
    ).code,
    "backend_api_config_missing",
  );
});

test("Unknown database provider modes fail closed", () => {
  const policy = getRuntimeSafetyPolicy(
    stagingSupabasePrimary({ NUTSNEWS_DATABASE_PROVIDER_MODE: "bare_postgres" }),
  );

  assert.equal(policy.ready, false);
  assert.equal(policy.code, "database_provider_mode_invalid");
  assert.equal(policy.databaseProviderMode, "invalid");
});

test("Backend primary smoke can call a mock compatibility endpoint without Supabase", async () => {
  const requests = [];
  const server = createServer((request, response) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      requests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        body: JSON.parse(body),
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, rows: [{ id: "smoke" }] }));
    });
  });
  const origin = await listen(server);

  try {
    const result = await callBackendDatabaseOperation(
      "app-provider-smoke",
      { operationSource: "database-provider-mode.test" },
      {
        env: stagingBackendPrimary({
          NUTSNEWS_BACKEND_API_URL: `${origin}/api/app/db`,
          NUTSNEWS_BACKEND_API_TOKEN: "server-only-smoke-token",
        }),
      },
    );

    assert.deepEqual(result, { ok: true, rows: [{ id: "smoke" }] });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, "POST");
    assert.equal(requests[0].url, "/api/app/db/app-provider-smoke");
    assert.equal(requests[0].authorization, "Bearer server-only-smoke-token");
    assert.equal(requests[0].body.providerMode, "backend_postgres_primary");
    assert.equal(requests[0].body.operationSource, "database-provider-mode.test");
  } finally {
    await close(server);
  }
});

test("Backend primary compatibility calls can opt into cacheable fetch for sitemap metadata", async () => {
  let capturedRequest = null;

  const result = await callBackendDatabaseOperation(
    "load-published-article-sitemap-count",
    {},
    {
      env: stagingBackendPrimary({
        NUTSNEWS_BACKEND_API_URL: "https://backend.example.test/api/app/db",
        NUTSNEWS_BACKEND_API_TOKEN: "server-only-smoke-token",
      }),
      cache: "force-cache",
      next: {
        revalidate: 3600,
        tags: ["sitemap"],
      },
      async fetchImpl(url, init) {
        capturedRequest = { url: String(url), init };
        return new Response(JSON.stringify({ articleCount: 42 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  );

  assert.deepEqual(result, { articleCount: 42 });
  assert.equal(capturedRequest.url, "https://backend.example.test/api/app/db/load-published-article-sitemap-count");
  assert.equal(capturedRequest.init.method, "POST");
  assert.equal(capturedRequest.init.cache, "force-cache");
  assert.deepEqual(capturedRequest.init.next, {
    revalidate: 3600,
    tags: ["sitemap"],
  });
  assert.equal(JSON.parse(capturedRequest.init.body).providerMode, "backend_postgres_primary");
});

test("Backend primary public article reads use backend compatibility operations", async () => {
  const articlesSource = await readFile(
    resolve(import.meta.dirname, "../web/lib/articles.ts"),
    "utf8",
  );

  for (const operation of [
    "load-public-feed-snapshot",
    "load-home-feed-snapshot",
    "load-published-articles",
    "load-published-categories",
    "load-article-detail",
    "load-recent-article-sitemap-items",
    "load-published-article-sitemap-count",
    "load-article-sitemap-items-page",
    "search-published-articles",
  ]) {
    assert.match(articlesSource, new RegExp(`callBackendDatabaseOperation<[^>]+>\\(\\s*"${operation}"`));
  }

  assert.match(
    articlesSource,
    /if \(isBackendPostgresPrimary\(\)\) \{[\s\S]+load-article-detail/,
  );
  assert.match(
    articlesSource,
    /if \(isBackendPostgresPrimary\(\)\) \{[\s\S]+translation_available: false/,
  );

  for (const operation of [
    "load-public-feed-snapshot",
    "load-home-feed-snapshot",
    "load-published-articles",
    "load-article-detail",
    "search-published-articles",
  ]) {
    assert.match(
      articlesSource,
      new RegExp(`"${operation}"[\\s\\S]{0,500}requestedLanguageCode: languageCode`),
      `${operation} must pass the normalized requested language to backend PostgreSQL reads.`,
    );
  }
});

test("Backend primary admin production readiness uses provider-neutral admin database operation", async () => {
  const readinessSource = await readFile(
    resolve(import.meta.dirname, "../web/lib/adminProductionReadiness.ts"),
    "utf8",
  );

  assert.match(
    readinessSource,
    /readAdminDatabase\(\s*"load-admin-production-readiness"/,
  );
  assert.doesNotMatch(readinessSource, /from "@\/lib\/supabase"/);
  assert.doesNotMatch(readinessSource, /getServerSupabase\(/);
  assert.match(
    readinessSource,
    /NUTSNEWS_BACKEND_API_URL and NUTSNEWS_BACKEND_API_TOKEN/,
  );
});

test("Backend primary admin article reviews uses provider-neutral admin database operation", async () => {
  const articleReviewsSource = await readFile(
    resolve(import.meta.dirname, "../web/lib/adminArticleReviews.ts"),
    "utf8",
  );

  assert.match(
    articleReviewsSource,
    /readAdminDatabase\(\s*"load-admin-article-reviews"/,
  );
  assert.doesNotMatch(articleReviewsSource, /from "@\/lib\/supabase"/);
  assert.doesNotMatch(articleReviewsSource, /getServerSupabase\(/);
  assert.match(articleReviewsSource, /AdminDatabaseAccessError/);
});

test("Backend primary admin article engagement uses provider-neutral admin database operation", async () => {
  const articleEngagementSource = await readFile(
    resolve(import.meta.dirname, "../web/lib/adminArticleEngagement.ts"),
    "utf8",
  );

  assert.match(
    articleEngagementSource,
    /readAdminDatabase\(\s*"load-admin-article-engagement"/,
  );
  assert.doesNotMatch(articleEngagementSource, /from "@\/lib\/supabase"/);
  assert.doesNotMatch(articleEngagementSource, /getServerSupabase\(/);
  assert.match(articleEngagementSource, /AdminDatabaseAccessError/);
});
