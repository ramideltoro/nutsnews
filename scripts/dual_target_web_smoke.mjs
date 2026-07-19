#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 15_000;

function accessHeaders(env = process.env) {
  const clientId = String(env.CF_ACCESS_CLIENT_ID ?? "").trim();
  const clientSecret = String(env.CF_ACCESS_CLIENT_SECRET ?? "").trim();

  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new Error("Cloudflare Access service-token inputs must be provided together");
  }

  return clientId
    ? {
        "CF-Access-Client-Id": clientId,
        "CF-Access-Client-Secret": clientSecret,
      }
    : {};
}

function vercelProtectionHeaders(env = process.env) {
  const bypassSecret = String(env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim();

  return bypassSecret
    ? {
        "x-vercel-protection-bypass": bypassSecret,
        "x-vercel-set-bypass-cookie": "true",
      }
    : {};
}

const protectedHeaders = {
  ...accessHeaders(),
  ...vercelProtectionHeaders(),
};

function option(name) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  const value = process.argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }

  return value.trim();
}

function options(name) {
  const values = [];

  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] !== name) {
      continue;
    }

    const value = process.argv[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`${name} requires a value`);
    }

    values.push(value.trim());
  }

  return values;
}

function flag(name) {
  return process.argv.includes(name);
}

function required(value, label) {
  if (!value) {
    throw new Error(`${label} is required`);
  }

  return value;
}

function endpoint(baseUrl, path) {
  return new URL(path.replace(/^\//, ""), baseUrl);
}

async function fetchOk(url, label) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/html;q=0.9, */*;q=0.8",
      ...protectedHeaders,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}`);
  }

  return response;
}

async function fetchAny(url, label, init = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/html;q=0.9, */*;q=0.8",
      ...protectedHeaders,
      ...(init.headers ?? {}),
    },
    redirect: init.redirect ?? "manual",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    method: init.method,
    body: init.body,
  });

  return response;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, received ${actual ?? "missing"}`);
  }
}

function assertRuntimeConfigIsPublic(config) {
  const expectedKeys = new Set([
    "runtimeEnv",
    "sideEffectsMode",
    "databaseProviderMode",
    "productionWritesPaused",
    "supabaseUrl",
    "supabaseAnonKey",
    "turnstileSiteKey",
    "sentryDsn",
    "gaId",
    "iosAppStoreUrl",
    "sourceCommit",
    "buildId",
    "deploymentTarget",
    "expectedImageDigest",
    "configGeneration",
    "telemetryEnabled",
  ]);
  const unexpectedKeys = Object.keys(config).filter((key) => !expectedKeys.has(key));

  if (unexpectedKeys.length > 0) {
    throw new Error("Runtime public configuration returned keys outside its allowlist");
  }
}

function assertHeaderPresent(response, name, label) {
  const value = response.headers.get(name);
  if (!value) {
    throw new Error(`${label} missing required ${name} header`);
  }
  return value;
}

function firstStaticAssetPath(html) {
  const match = html.match(/["'](\/_next\/static\/[^"']+\.(?:js|css))["']/);
  return match?.[1];
}

const baseUrlValue = required(
  option("--base-url") || process.env.NUTSNEWS_SMOKE_BASE_URL,
  "--base-url or NUTSNEWS_SMOKE_BASE_URL",
);
const expectedSourceCommit = required(
  option("--expected-source-commit") || process.env.NUTSNEWS_EXPECTED_SOURCE_COMMIT,
  "--expected-source-commit or NUTSNEWS_EXPECTED_SOURCE_COMMIT",
);
const expectedBuildId = required(
  option("--expected-build-id") || process.env.NUTSNEWS_EXPECTED_BUILD_ID,
  "--expected-build-id or NUTSNEWS_EXPECTED_BUILD_ID",
);
const expectedDeploymentTarget = required(
  option("--expected-deployment-target") ||
    process.env.NUTSNEWS_EXPECTED_DEPLOYMENT_TARGET,
  "--expected-deployment-target or NUTSNEWS_EXPECTED_DEPLOYMENT_TARGET",
);
const expectedHealthDeploymentTarget =
  option("--expected-health-deployment-target") ||
  process.env.NUTSNEWS_EXPECTED_HEALTH_DEPLOYMENT_TARGET ||
  expectedDeploymentTarget;
const expectedRuntimeEnv = option("--expected-runtime-env") || process.env.NUTSNEWS_EXPECTED_RUNTIME_ENV;
const expectedSupabaseUrl = option("--expected-supabase-url") || process.env.NUTSNEWS_EXPECTED_SUPABASE_URL;
const expectedImageDigest = option("--expected-image-digest") || process.env.NUTSNEWS_EXPECTED_IMAGE_DIGEST;
const expectedConfigGeneration = required(
  option("--expected-config-generation") || process.env.NUTSNEWS_EXPECTED_CONFIG_GENERATION,
  "--expected-config-generation or NUTSNEWS_EXPECTED_CONFIG_GENERATION",
);
const expectedSideEffectsMode =
  option("--expected-side-effects-mode") || process.env.NUTSNEWS_EXPECTED_SIDE_EFFECTS_MODE;
const expectedDatabaseProviderMode =
  option("--expected-database-provider-mode") || process.env.NUTSNEWS_EXPECTED_DATABASE_PROVIDER_MODE;
const expectedTurnstileSiteKey =
  option("--expected-turnstile-site-key") || process.env.NUTSNEWS_EXPECTED_TURNSTILE_SITE_KEY;
const expectedSentryDsn = option("--expected-sentry-dsn") || process.env.NUTSNEWS_EXPECTED_SENTRY_DSN;
const expectedGaId = option("--expected-ga-id") || process.env.NUTSNEWS_EXPECTED_GA_ID;
const forbiddenRuntimeConfigTokens = options("--forbidden-runtime-config-token");
const productionSafeSurfaces = flag("--production-safe-surfaces") || process.env.NUTSNEWS_PRODUCTION_SAFE_SURFACES === "true";

const baseUrl = new URL(baseUrlValue.endsWith("/") ? baseUrlValue : `${baseUrlValue}/`);

if (!/^https?:$/.test(baseUrl.protocol)) {
  throw new Error("The smoke base URL must use HTTP or HTTPS");
}

const healthResponse = await fetchOk(endpoint(baseUrl, "/healthz"), "Health endpoint");
const health = await healthResponse.json();

if (health?.ok !== true || health?.service !== "nutsnews-web") {
  throw new Error("Health endpoint did not return the expected NutsNews liveness payload");
}

assertEqual(health.sourceCommit, expectedSourceCommit, "Health source commit");
assertEqual(health.buildId, expectedBuildId, "Health build ID");
assertEqual(health.deploymentTarget, expectedHealthDeploymentTarget, "Health deployment target");
assertEqual(
  healthResponse.headers.get("x-nutsnews-source-commit"),
  expectedSourceCommit,
  "Health source commit header",
);
assertEqual(
  healthResponse.headers.get("x-nutsnews-build-id"),
  expectedBuildId,
  "Health build ID header",
);
assertEqual(
  healthResponse.headers.get("x-nutsnews-deployment-target"),
  expectedHealthDeploymentTarget,
  "Health deployment target header",
);
if (productionSafeSurfaces && !/s-maxage=60/.test(healthResponse.headers.get("cdn-cache-control") ?? "")) {
  throw new Error("Production health endpoint must retain the bounded CDN cache policy");
}

const readinessResponse = await fetchOk(
  endpoint(baseUrl, `/readyz?cache-bust=${encodeURIComponent(expectedConfigGeneration)}`),
  "Readiness endpoint",
);
const readiness = await readinessResponse.json();

if (readiness?.ok !== true || readiness?.service !== "nutsnews-web" || readiness?.code !== "ready") {
  throw new Error("Readiness endpoint did not return a qualified runtime response");
}

if (!/no-store/.test(readinessResponse.headers.get("cache-control") ?? "")) {
  throw new Error("Readiness endpoint must be no-store");
}

assertEqual(readiness.runtimeEnv, expectedRuntimeEnv, "Readiness runtime environment");
assertEqual(readinessResponse.headers.get("x-nutsnews-source-commit"), expectedSourceCommit, "Readiness source commit header");
assertEqual(readinessResponse.headers.get("x-nutsnews-build-id"), expectedBuildId, "Readiness build ID header");
assertEqual(readinessResponse.headers.get("x-nutsnews-deployment-target"), expectedDeploymentTarget, "Readiness deployment target header");
assertEqual(readinessResponse.headers.get("x-nutsnews-runtime-environment"), expectedRuntimeEnv, "Readiness runtime environment header");
assertEqual(readinessResponse.headers.get("x-nutsnews-config-generation"), expectedConfigGeneration, "Readiness config generation header");
if (expectedImageDigest) {
  assertEqual(readinessResponse.headers.get("x-nutsnews-expected-image-digest"), expectedImageDigest, "Readiness image digest header");
}

if (
  expectedRuntimeEnv ||
  expectedSupabaseUrl ||
  expectedImageDigest ||
  expectedSideEffectsMode ||
  expectedDatabaseProviderMode ||
  expectedTurnstileSiteKey ||
  expectedSentryDsn ||
  expectedGaId ||
  forbiddenRuntimeConfigTokens.length > 0
) {
  const runtimeConfigResponse = await fetchOk(
    endpoint(baseUrl, "/api/runtime-config"),
    "Runtime public configuration endpoint",
  );
  const runtimeConfig = await runtimeConfigResponse.json();

  if (!/no-store/.test(runtimeConfigResponse.headers.get("cache-control") ?? "")) {
    throw new Error("Runtime public configuration endpoint must be no-store");
  }

  assertRuntimeConfigIsPublic(runtimeConfig);

  if (expectedRuntimeEnv) {
    assertEqual(runtimeConfig.runtimeEnv, expectedRuntimeEnv, "Runtime environment");
  }
  if (expectedSupabaseUrl) {
    assertEqual(runtimeConfig.supabaseUrl, expectedSupabaseUrl, "Runtime Supabase URL");
  }
  if (expectedImageDigest) {
    assertEqual(runtimeConfig.expectedImageDigest, expectedImageDigest, "Runtime expected image digest");
  }
  assertEqual(runtimeConfig.configGeneration, expectedConfigGeneration, "Runtime config generation");
  if (expectedSideEffectsMode) {
    assertEqual(runtimeConfig.sideEffectsMode, expectedSideEffectsMode, "Runtime side-effects mode");
  }
  if (expectedDatabaseProviderMode) {
    assertEqual(runtimeConfig.databaseProviderMode, expectedDatabaseProviderMode, "Runtime database provider mode");
  }
  if (expectedTurnstileSiteKey) {
    assertEqual(runtimeConfig.turnstileSiteKey, expectedTurnstileSiteKey, "Runtime Turnstile site key");
  }
  if (expectedSentryDsn) {
    assertEqual(runtimeConfig.sentryDsn, expectedSentryDsn, "Runtime Sentry DSN");
  }
  if (expectedGaId) {
    assertEqual(runtimeConfig.gaId, expectedGaId, "Runtime analytics ID");
  }

  const serializedRuntimeConfig = JSON.stringify(runtimeConfig);
  for (const token of forbiddenRuntimeConfigTokens) {
    if (serializedRuntimeConfig.includes(token)) {
      throw new Error("Runtime public configuration included a forbidden fixture marker");
    }
  }
}

const homeResponse = await fetchOk(endpoint(baseUrl, "/"), "Homepage");
const home = await homeResponse.text();

if (!home.includes("NutsNews")) {
  throw new Error("Homepage did not contain the expected NutsNews identity");
}

if (productionSafeSurfaces) {
  assertHeaderPresent(homeResponse, "x-content-type-options", "Homepage");
  assertHeaderPresent(homeResponse, "referrer-policy", "Homepage");
  const assetPath = firstStaticAssetPath(home);
  if (!assetPath) {
    throw new Error("Homepage did not reference a Next.js static asset");
  }
  const assetResponse = await fetchOk(endpoint(baseUrl, assetPath), "Next.js static asset");
  if (!/immutable/.test(assetResponse.headers.get("cache-control") ?? "")) {
    throw new Error("Next.js static asset must use immutable cache headers");
  }
}

const articlesResponse = await fetchOk(
  endpoint(baseUrl, "/api/articles?page=0"),
  "Public articles API",
);
const articles = await articlesResponse.json();

if (!Array.isArray(articles?.articles)) {
  throw new Error("Public articles API did not return an articles array");
}

if (productionSafeSurfaces) {
  const corsProbe = await fetchAny(endpoint(baseUrl, "/api/articles?page=0"), "Public articles CORS probe", {
    headers: { Origin: "https://www.nutsnews.com" },
  });
  if (!corsProbe.ok) {
    throw new Error(`Public articles CORS probe returned HTTP ${corsProbe.status}`);
  }
  if (
    corsProbe.headers.get("access-control-allow-origin") === "*" &&
    corsProbe.headers.get("access-control-allow-credentials") === "true"
  ) {
    throw new Error("Public articles CORS must not combine wildcard origin with credentials");
  }

  const contactResponse = await fetchAny(endpoint(baseUrl, "/api/contact"), "Contact validation probe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invalid", message: "" }),
  });
  if (![400, 422].includes(contactResponse.status)) {
    throw new Error(`Contact validation probe returned HTTP ${contactResponse.status}`);
  }

  const authResponse = await fetchAny(endpoint(baseUrl, "/api/auth/session"), "Auth session probe", {
    headers: { Accept: "application/json" },
  });
  if (![200, 204, 302, 307].includes(authResponse.status)) {
    throw new Error(`Auth session probe returned HTTP ${authResponse.status}`);
  }
}

console.log(`Web deployment smoke passed for ${baseUrl.origin}`);
console.log(`Source commit: ${expectedSourceCommit}`);
console.log(`Build ID: ${expectedBuildId}`);
console.log(`Deployment target: ${expectedDeploymentTarget}`);
if (productionSafeSurfaces) {
  console.log("Production safe surface probes passed");
}
