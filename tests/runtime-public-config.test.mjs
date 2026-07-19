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
    NUTSNEWS_DATA_ENVIRONMENT: "staging",
    NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "staging",
    NUTSNEWS_SUPABASE_PROJECT_REF: "staging-project",
    NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "production-project",
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
    NUTSNEWS_CONFIG_GENERATION: "staging-config-generation-1",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-staging-secret",
    RESEND_API_KEY: "server-only-resend-secret",
    AUTH_SECRET: "server-only-auth-secret",
  });
  const production = getRuntimePublicConfig({
    NUTSNEWS_RUNTIME_ENV: "production",
    NUTSNEWS_SIDE_EFFECTS_MODE: "live",
    NUTSNEWS_DATA_ENVIRONMENT: "production",
    NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "production",
    NUTSNEWS_SUPABASE_PROJECT_REF: "production-project",
    NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "production-project",
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
    NUTSNEWS_CONFIG_GENERATION: "production-config-generation-1",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-production-secret",
    RESEND_API_KEY: "server-only-resend-secret",
    AUTH_SECRET: "server-only-auth-secret",
  });

  assert.equal(staging.runtimeEnv, "staging");
  assert.equal(production.runtimeEnv, "production");
  assert.equal(staging.databaseProviderMode, "supabase_primary");
  assert.equal(production.databaseProviderMode, "supabase_primary");
  assert.equal(staging.productionWritesPaused, false);
  assert.equal(production.productionWritesPaused, false);
  assert.equal(staging.supabaseUrl, "https://staging-project.supabase.co");
  assert.equal(production.supabaseUrl, "https://production-project.supabase.co");
  assert.equal(staging.telemetryEnabled, false);
  assert.equal(production.telemetryEnabled, true);
  assert.equal(staging.turnstileSiteKey, null);
  assert.equal(staging.sentryDsn, null);
  assert.equal(staging.gaId, null);
  assert.equal(staging.sourceCommit, production.sourceCommit);
  assert.equal(staging.buildId, production.buildId);
  assert.equal(staging.expectedImageDigest, production.expectedImageDigest);
  assert.notEqual(staging.configGeneration, production.configGeneration);

  const serialized = JSON.stringify({ staging, production });
  assert.doesNotMatch(serialized, /server-only-(?:staging|production)-secret/);
  assert.doesNotMatch(serialized, /server-only-resend-secret/);
  assert.doesNotMatch(serialized, /server-only-auth-secret/);
});

test("runtime public configuration rejects invalid URLs and unknown identities", () => {
  const config = getRuntimePublicConfig({
    NUTSNEWS_RUNTIME_ENV: "preview",
    NUTSNEWS_SIDE_EFFECTS_MODE: "live-ish",
    NUTSNEWS_DATA_ENVIRONMENT: "preview",
    NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "preview",
    NUTSNEWS_SUPABASE_PROJECT_REF: "invalid",
    NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "invalid",
    NUTSNEWS_PUBLIC_SUPABASE_URL: "javascript:alert(1)",
    NUTSNEWS_PUBLIC_SENTRY_DSN: "not-a-url",
  });

  assert.equal(config.runtimeEnv, "unknown");
  assert.equal(config.sideEffectsMode, "disabled");
  assert.equal(config.databaseProviderMode, "invalid");
  assert.equal(config.supabaseUrl, null);
  assert.equal(config.sentryDsn, null);
  assert.equal(config.expectedImageDigest, "unknown");
  assert.equal(config.configGeneration, "unknown");
  assert.equal(config.telemetryEnabled, false);
});

test("staging configuration fails closed when live side effects are requested", () => {
  const config = getRuntimePublicConfig({
    NUTSNEWS_RUNTIME_ENV: "staging",
    NUTSNEWS_SIDE_EFFECTS_MODE: "live",
    NUTSNEWS_DATA_ENVIRONMENT: "staging",
    NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "staging",
    NUTSNEWS_SUPABASE_PROJECT_REF: "staging-project",
    NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "production-project",
    NUTSNEWS_PUBLIC_SUPABASE_URL: "https://staging-project.supabase.co",
  });

  assert.equal(config.runtimeEnv, "unknown");
  assert.equal(config.sideEffectsMode, "disabled");
  assert.equal(config.databaseProviderMode, "invalid");
  assert.equal(config.telemetryEnabled, false);
});

test("backend primary runtime config exposes provider mode without Supabase or backend secrets", () => {
  const config = getRuntimePublicConfig({
    NUTSNEWS_RUNTIME_ENV: "staging",
    NUTSNEWS_SIDE_EFFECTS_MODE: "sandbox",
    NUTSNEWS_DATA_ENVIRONMENT: "staging",
    NUTSNEWS_DATABASE_PROVIDER_MODE: "backend_postgres_primary",
    NUTSNEWS_BACKEND_POSTGRES_PRIMARY_CONFIRMATION: "enable-backend-postgres-primary",
    NUTSNEWS_BACKEND_API_URL: "http://127.0.0.1:8787/api/app/db",
    NUTSNEWS_BACKEND_API_TOKEN: "server-only-backend-token",
    NUTSNEWS_SOURCE_COMMIT: "same-source-commit",
    NUTSNEWS_BUILD_ID: "same-build-id",
    NUTSNEWS_DEPLOYMENT_TARGET: "vps",
    NUTSNEWS_EXPECTED_IMAGE_DIGEST:
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    NUTSNEWS_CONFIG_GENERATION: "backend-primary-config-generation-1",
  });
  const serialized = JSON.stringify(config);

  assert.equal(config.runtimeEnv, "staging");
  assert.equal(config.sideEffectsMode, "sandbox");
  assert.equal(config.databaseProviderMode, "backend_postgres_primary");
  assert.equal(config.supabaseUrl, null);
  assert.equal(config.supabaseAnonKey, null);
  assert.doesNotMatch(serialized, /server-only-backend-token/);
  assert.doesNotMatch(serialized, /api\/app\/db/);
});

test("runtime public configuration exposes only the production writer pause boolean", () => {
  const config = getRuntimePublicConfig({
    NUTSNEWS_RUNTIME_ENV: "production",
    NUTSNEWS_SIDE_EFFECTS_MODE: "live",
    NUTSNEWS_DATA_ENVIRONMENT: "production",
    NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "production",
    NUTSNEWS_SUPABASE_PROJECT_REF: "production-project",
    NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "production-project",
    NUTSNEWS_PUBLIC_SUPABASE_URL: "https://production-project.supabase.co",
    NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY: "production-public-anon-key",
    NUTSNEWS_PRODUCTION_WRITES_PAUSED: "on",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-production-secret",
  });
  const serialized = JSON.stringify(config);

  assert.equal(config.runtimeEnv, "production");
  assert.equal(config.productionWritesPaused, true);
  assert.doesNotMatch(serialized, /server-only-production-secret/);
});

test("unknown environments and malformed image digests fail closed", () => {
  const config = getRuntimePublicConfig({
    NUTSNEWS_RUNTIME_ENV: "preview",
    NUTSNEWS_SIDE_EFFECTS_MODE: "sandbox",
    NUTSNEWS_EXPECTED_IMAGE_DIGEST: "sha256:not-a-real-digest",
  });

  assert.equal(config.runtimeEnv, "unknown");
  assert.equal(config.sideEffectsMode, "disabled");
  assert.equal(config.expectedImageDigest, "unknown");
});

test("browser entries and immutable image inputs do not embed runtime public values", async () => {
  const [
    dockerfile,
    workflow,
    contactForm,
    articleFeed,
    layout,
    instrumentation,
    route,
    homePage,
    runtimeConfig,
    sentryServer,
    sentryEdge,
    logger,
  ] = await Promise.all([
    readFile(resolve(root, "web/Dockerfile"), "utf8"),
    readFile(resolve(root, ".github/workflows/container-image.yml"), "utf8"),
    readFile(resolve(root, "web/app/contact/ContactForm.tsx"), "utf8"),
    readFile(resolve(root, "web/app/components/ArticleFeed.tsx"), "utf8"),
    readFile(resolve(root, "web/app/layout.tsx"), "utf8"),
    readFile(resolve(root, "web/instrumentation-client.ts"), "utf8"),
    readFile(resolve(root, "web/app/api/runtime-config/route.ts"), "utf8"),
    readFile(resolve(root, "web/app/page.tsx"), "utf8"),
    readFile(resolve(root, "web/runtimePublicConfig.mjs"), "utf8"),
    readFile(resolve(root, "web/sentry.server.config.ts"), "utf8"),
    readFile(resolve(root, "web/sentry.edge.config.ts"), "utf8"),
    readFile(resolve(root, "web/lib/logger.ts"), "utf8"),
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
  assert.match(homePage, /shouldBypassHomeFeedCacheForQualification/);
  assert.match(homePage, /process\.env\.NUTSNEWS_RUNTIME_ENV === "staging"/);
  assert.match(homePage, /\^nutsnews-test-\[a-z0-9-\]\+\$/);
  assert.match(articleFeed, /initialEnglishArticlesRef\.current\.length === 0/);
  assert.match(articleFeed, /void loadLocalizedHomeFeed\(storedLanguage\)/);
  assert.match(workflow, /@sha256/);
  for (const source of [sentryServer, sentryEdge, logger]) {
    assert.match(source, /getRuntimePublicConfig/);
    assert.match(source, /runtimeEnv/);
  }
  assert.match(logger, /isTelemetryDeliveryAllowed/);
  for (const serverSecretName of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "TURNSTILE_SECRET_KEY",
    "RESEND_API_KEY",
    "AUTH_SECRET",
    "SENTRY_AUTH_TOKEN",
    "BETTER_STACK_SOURCE_TOKEN",
  ]) {
    assert.doesNotMatch(runtimeConfig, new RegExp(serverSecretName));
    assert.doesNotMatch(route, new RegExp(serverSecretName));
  }
});
