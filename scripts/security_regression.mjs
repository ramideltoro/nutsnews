#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { redact } from "./staging_qualification.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromWeb = createRequire(path.join(repoRoot, "web", "package.json"));
const ts = requireFromWeb("typescript");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function loadTsModule(relativePath, mocks = {}) {
  const filename = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
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

    if (specifier.startsWith("node:")) {
      return requireFromWeb(specifier);
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

function assertIncludes(content, needle, label) {
  assert(content.includes(needle), `${label} missing required text: ${needle}`);
}

function assertNotIncludes(content, needle, label) {
  assert(!content.includes(needle), `${label} must not include: ${needle}`);
}

function assertRedacted(value, forbiddenValues) {
  const serialized = JSON.stringify(value);

  for (const forbiddenValue of forbiddenValues) {
    assertNotIncludes(serialized, forbiddenValue, "redacted output");
  }
}

async function testSecurityHeaders() {
  const { buildContentSecurityPolicy, getSecurityHeaders } = loadTsModule("web/lib/securityHeaders.ts");
  const productionHeaders = getSecurityHeaders({ isDevelopment: false });
  const developmentHeaders = getSecurityHeaders({ isDevelopment: true });
  const productionCsp = buildContentSecurityPolicy({ isDevelopment: false });
  const developmentCsp = buildContentSecurityPolicy({ isDevelopment: true });

  assert.equal(productionHeaders["X-Frame-Options"], "DENY", "public security headers deny framing");
  assert.equal(productionHeaders["X-Content-Type-Options"], "nosniff", "public security headers disable MIME sniffing");
  assert.equal(productionHeaders["Cross-Origin-Resource-Policy"], "same-origin", "public security headers set CORP");
  assert.match(productionHeaders["Strict-Transport-Security"], /includeSubDomains/, "production HSTS includes subdomains");
  assertIncludes(productionCsp, "default-src 'self'", "production CSP");
  assertIncludes(productionCsp, "frame-ancestors 'none'", "production CSP");
  assertIncludes(productionCsp, "object-src 'none'", "production CSP");
  assertIncludes(productionCsp, "base-uri 'self'", "production CSP");
  assertIncludes(productionCsp, "form-action 'self'", "production CSP");
  assertIncludes(productionCsp, "upgrade-insecure-requests", "production CSP");
  assertNotIncludes(productionCsp, "'unsafe-eval'", "production CSP");
  assertNotIncludes(productionCsp, "localhost", "production CSP");
  assertIncludes(developmentCsp, "'unsafe-eval'", "development CSP");
  assertIncludes(developmentCsp, "http://localhost:*", "development CSP");
  assert.equal(developmentHeaders["Strict-Transport-Security"], undefined, "development omits HSTS");
}

async function testMiddlewareAdminBoundary() {
  const { middleware } = loadTsModule("web/middleware.ts", {
    "next/server": {
      NextResponse: {
        next() {
          return { headers: new Headers() };
        },
      },
    },
  });

  const adminResponse = middleware({ nextUrl: { pathname: "/admin/feeds" } });
  assert.equal(adminResponse.headers.get("cache-control"), "no-store, max-age=0", "admin routes are no-store");
  assert.equal(adminResponse.headers.get("x-robots-tag"), "noindex, nofollow, noarchive", "admin routes are noindex");
  assert.equal(adminResponse.headers.get("x-nutsnews-cache-policy"), "bypass-admin-cache", "admin routes use admin bypass policy");

  const publicResponse = middleware({ nextUrl: { pathname: "/" } });
  assert.equal(publicResponse.headers.get("x-robots-tag"), null, "public routes do not inherit admin robots header");
  assert.equal(publicResponse.headers.get("cache-control"), null, "public routes do not inherit admin no-store header");
}

async function testExternalUrlSafety() {
  const { assertPublicHttpUrl } = loadTsModule("web/lib/externalUrlSafety.ts");

  assert.equal(
    assertPublicHttpUrl("https://publisher.example/feed.xml", "Feed URL"),
    "https://publisher.example/feed.xml",
    "public HTTPS feed URL is accepted",
  );
  assert.equal(
    assertPublicHttpUrl("http://news.example/rss", "Feed URL"),
    "http://news.example/rss",
    "public HTTP feed URL is accepted",
  );

  const forbiddenUrls = [
    "file:///etc/passwd",
    "https://user:password@publisher.example/feed.xml",
    "http://localhost/feed.xml",
    "http://metadata.local/feed.xml",
    "http://127.0.0.1/feed.xml",
    "http://10.0.0.5/feed.xml",
    "http://172.16.0.5/feed.xml",
    "http://192.168.1.5/feed.xml",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/feed.xml",
    "http://[fd00::1]/feed.xml",
  ];

  for (const forbiddenUrl of forbiddenUrls) {
    assert.throws(
      () => assertPublicHttpUrl(forbiddenUrl, "Feed URL"),
      (error) =>
        error instanceof Error &&
        !error.message.includes(forbiddenUrl) &&
        !error.message.includes("password") &&
        !error.message.includes("169.254.169.254"),
      `private or unsafe URL must be rejected without echoing input: ${forbiddenUrl}`,
    );
  }
}

async function testAdminFeedMutationUrlBoundary() {
  class RuntimeSafetyError extends Error {}
  const externalUrlSafety = loadTsModule("web/lib/externalUrlSafety.ts");
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return Response.json([
        {
          feed_id: 1,
          feed_source: "Publisher",
          feed_url: "https://publisher.example/feed.xml",
          previous_is_active: true,
          next_is_active: false,
          audit_event_id: "00000000-0000-4000-8000-000000000001",
        },
      ]);
    };

    const { setAdminRssFeedActiveStatus } = loadTsModule("web/lib/adminFeedManagement.ts", {
      "@/lib/adminTime": {
        formatAdminDateTime(value, fallback = "Never") {
          return value ?? fallback;
        },
      },
      "@/lib/externalUrlSafety": externalUrlSafety,
      "@/lib/runtimeSafety": {
        RuntimeSafetyError,
        assertDataMutation() {},
      },
      "@/lib/supabase": {
        getServerSupabaseConfig() {
          return {
            url: "https://staging-fixture.supabase.co",
            serviceRoleKey: "test-service-role-key",
          };
        },
      },
    });

    const denied = await setAdminRssFeedActiveStatus({
      feedUrl: "http://169.254.169.254/latest/meta-data",
      isActive: true,
    });
    assert.deepEqual(denied, { ok: false, message: "Feed URL is not allowed." }, "private feed URL is denied generically");
    assert.equal(fetchCalls, 0, "private feed URL denial does not reach fetch");

    const allowed = await setAdminRssFeedActiveStatus({
      actorEmail: "admin@example.com",
      feedUrl: "https://publisher.example/feed.xml",
      isActive: false,
    });
    assert.deepEqual(
      allowed,
      {
        ok: true,
        message: "Feed disabled.",
        auditEventId: "00000000-0000-4000-8000-000000000001",
      },
      "public feed URL can reach the audited mutation path",
    );
    assert.equal(fetchCalls, 1, "public feed URL reaches exactly one mutation request");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testAuthBoundaryContracts() {
  const protectedAdminLayout = read("web/app/admin/(protected)/layout.tsx");
  const oauthRoute = read("web/app/api/auth/[...nextauth]/route.ts");
  const authConfig = read("web/auth.ts");
  const nextConfig = read("web/next.config.ts");

  assertIncludes(protectedAdminLayout, "const session = await auth();", "protected admin layout");
  assertIncludes(protectedAdminLayout, 'redirect("/admin/login")', "protected admin layout unauthenticated denial");
  assertIncludes(protectedAdminLayout, 'redirect("/admin/access-denied")', "protected admin layout unauthorized denial");
  assertIncludes(protectedAdminLayout, "isAllowedAdminEmail(email)", "protected admin layout allow-list");
  assertIncludes(protectedAdminLayout, "assertSyntheticTestUser", "protected admin test bypass");

  for (const method of ["GET", "POST"]) {
    assert.match(
      oauthRoute,
      new RegExp(
        `export async function ${method}\\(request: NextRequest\\) \\{[\\s\\S]*?allowOAuthCallbacks\\(request\\)[\\s\\S]*?handlers\\.${method}\\(request\\)`,
      ),
      `${method} OAuth callback path must guard before Auth.js dispatch`,
    );
  }
  assertIncludes(oauthRoute, "assertOAuthCallback", "OAuth callback route");
  assertIncludes(oauthRoute, "status: 503", "OAuth denied response");
  assertIncludes(oauthRoute, '"Cache-Control": "no-store"', "OAuth denied response");
  assertIncludes(authConfig, "isAllowedAdminEmail(user.email)", "Auth.js sign-in callback");
  assertIncludes(authConfig, 'return "/admin/access-denied"', "Auth.js rejected sign-in redirect");
  assertIncludes(nextConfig, 'source: "/admin/:path*"', "admin route no-store config");
  assertIncludes(nextConfig, 'source: "/api/auth/:path*"', "auth route no-store config");
}

async function testRedactionContracts() {
  const secretValues = [
    "bearer-token-fixture",
    "cookie-fixture=value",
    "csrf-fixture",
    "service-role-fixture",
    "exact-secret-fixture",
    "full-sensitive-body",
  ];
  const redacted = redact(
    {
      Authorization: "Bearer bearer-token-fixture",
      cookie: "cookie-fixture=value",
      message:
        "CF-Access-Client-Secret: service-role-fixture csrfToken=csrf-fixture custom exact-secret-fixture",
      responseBody: "full-sensitive-body",
      nested: {
        client_secret: "service-role-fixture",
      },
    },
    ["exact-secret-fixture"],
  );

  assertRedacted(redacted, secretValues);
  assertIncludes(JSON.stringify(redacted), "[REDACTED]", "redacted output");
}

async function testCommandAndCiWiring() {
  const packageJson = JSON.parse(read("web/package.json"));
  const workflow = read(".github/workflows/web-ci.yml");

  assert.equal(
    packageJson.scripts?.["test:security-regression"],
    "node ../scripts/security_regression.mjs",
    "security regression command is wired into package.json",
  );
  assertIncludes(workflow, "npm run test:security-regression", "Web CI");
  assertIncludes(workflow, "npm run test:security-headers", "Web CI");
}

await testSecurityHeaders();
await testMiddlewareAdminBoundary();
await testExternalUrlSafety();
await testAdminFeedMutationUrlBoundary();
await testAuthBoundaryContracts();
await testRedactionContracts();
await testCommandAndCiWiring();

console.log("Focused security regression checks passed.");
