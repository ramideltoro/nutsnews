import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getRuntimePublicConfig } from "../web/runtimePublicConfig.mjs";

const root = resolve(import.meta.dirname, "..");

test("runtime public configuration differs by runtime environment without serializing secrets", () => {
  const staging = getRuntimePublicConfig({
    NUTSNEWS_RUNTIME_ENV: "staging",
    NUTSNEWS_SIDE_EFFECTS_MODE: "disabled",
    NUTSNEWS_PUBLIC_SUPABASE_URL: "https://staging-project.supabase.co",
    NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY: "staging-public-anon-key",
    NUTSNEWS_PUBLIC_TURNSTILE_SITE_KEY: "staging-turnstile-site-key",
    NUTSNEWS_PUBLIC_SENTRY_DSN: "https://staging-sentry.invalid/1",
    NUTSNEWS_PUBLIC_GA_ID: "G-STAGINGRUNTIME",
    NUTSNEWS_SOURCE_COMMIT: "same-source-commit",
    NUTSNEWS_BUILD_ID: "same-build-id",
    NUTSNEWS_DEPLOYMENT_TARGET: "vps",
    NUTSNEWS_EXPECTED_IMAGE_DIGEST:
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-staging-secret",
    RESEND_API_KEY: "server-only-resend-secret",
    AUTH_SECRET: "server-only-auth-secret",
  });
  const production = getRuntimePublicConfig({
    NUTSNEWS_RUNTIME_ENV: "production",
    NUTSNEWS_SIDE_EFFECTS_MODE: "live",
    NUTSNEWS_PUBLIC_SUPABASE_URL: "https://production-project.supabase.co",
    NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY: "production-public-anon-key",
    NUTSNEWS_PUBLIC_TURNSTILE_SITE_KEY: "production-turnstile-site-key",
    NUTSNEWS_PUBLIC_SENTRY_DSN: "https://production-sentry.invalid/1",
    NUTSNEWS_PUBLIC_GA_ID: "G-PRODUCTIONRUNTIME",
    NUTSNEWS_SOURCE_COMMIT: "same-source-commit",
    NUTSNEWS_BUILD_ID: "same-build-id",
    NUTSNEWS_DEPLOYMENT_TARGET: "vps",
    NUTSNEWS_EXPECTED_IMAGE_DIGEST:
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-production-secret",
    RESEND_API_KEY: "server-only-resend-secret",
    AUTH_SECRET: "server-only-auth-secret",
  });

  assert.equal(staging.runtimeEnv, "staging");
  assert.equal(production.runtimeEnv, "production");
  assert.equal(staging.supabaseUrl, "https://staging-project.supabase.co");
  assert.equal(production.supabaseUrl, "https://production-project.supabase.co");
  assert.equal(staging.telemetryEnabled, false);
  assert.equal(production.telemetryEnabled, true);
  assert.equal(staging.sourceCommit, production.sourceCommit);
  assert.equal(staging.buildId, production.buildId);
  assert.equal(staging.expectedImageDigest, production.expectedImageDigest);

  const serialized = JSON.stringify({ staging, production });
  assert.doesNotMatch(serialized, /server-only-(?:staging|production)-secret/);
  assert.doesNotMatch(serialized, /server-only-resend-secret/);
  assert.doesNotMatch(serialized, /server-only-auth-secret/);
});

test("runtime public configuration rejects invalid URLs and unknown identities", () => {
  const config = getRuntimePublicConfig({
    NUTSNEWS_RUNTIME_ENV: "preview",
    NUTSNEWS_SIDE_EFFECTS_MODE: "live-ish",
    NUTSNEWS_PUBLIC_SUPABASE_URL: "javascript:alert(1)",
    NUTSNEWS_PUBLIC_SENTRY_DSN: "not-a-url",
  });

  assert.equal(config.runtimeEnv, "unknown");
  assert.equal(config.sideEffectsMode, "disabled");
  assert.equal(config.supabaseUrl, null);
  assert.equal(config.sentryDsn, null);
  assert.equal(config.telemetryEnabled, false);
});

test("staging configuration fails closed when live side effects are requested", () => {
  const config = getRuntimePublicConfig({
    NUTSNEWS_RUNTIME_ENV: "staging",
    NUTSNEWS_SIDE_EFFECTS_MODE: "live",
  });

  assert.equal(config.runtimeEnv, "staging");
  assert.equal(config.sideEffectsMode, "disabled");
  assert.equal(config.telemetryEnabled, false);
});

test("browser entries and immutable image inputs do not embed runtime public values", async () => {
  const [dockerfile, workflow, contactForm, layout, instrumentation, route, homePage] = await Promise.all([
    readFile(resolve(root, "web/Dockerfile"), "utf8"),
    readFile(resolve(root, ".github/workflows/container-image.yml"), "utf8"),
    readFile(resolve(root, "web/app/contact/ContactForm.tsx"), "utf8"),
    readFile(resolve(root, "web/app/layout.tsx"), "utf8"),
    readFile(resolve(root, "web/instrumentation-client.ts"), "utf8"),
    readFile(resolve(root, "web/app/api/runtime-config/route.ts"), "utf8"),
    readFile(resolve(root, "web/app/page.tsx"), "utf8"),
  ]);

  assert.doesNotMatch(dockerfile, /ARG NEXT_PUBLIC_(?:SUPABASE|APP_ENV|TURNSTILE|SENTRY|GA)/);
  assert.doesNotMatch(workflow, /build-arg NEXT_PUBLIC_(?:SUPABASE|APP_ENV|TURNSTILE|SENTRY|GA)/);
  for (const source of [contactForm, layout, instrumentation]) {
    assert.doesNotMatch(source, /process\.env\.NEXT_PUBLIC_/);
  }
  assert.match(route, /force-dynamic/);
  assert.match(route, /no-store/);
  assert.match(homePage, /process\.env\.VERCEL !== "1"/);
  assert.match(homePage, /await connection\(\)/);
  assert.match(homePage, /unstable_cache/);
  assert.match(homePage, /homepage-initial-feed/);
  assert.match(homePage, /revalidate: 900/);
});
