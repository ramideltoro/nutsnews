#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 15_000;

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
    },
    redirect: "follow",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}`);
  }

  return response;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, received ${actual ?? "missing"}`);
  }
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
assertEqual(health.deploymentTarget, expectedDeploymentTarget, "Health deployment target");
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
  expectedDeploymentTarget,
  "Health deployment target header",
);

const homeResponse = await fetchOk(endpoint(baseUrl, "/"), "Homepage");
const home = await homeResponse.text();

if (!home.includes("NutsNews")) {
  throw new Error("Homepage did not contain the expected NutsNews identity");
}

const articlesResponse = await fetchOk(
  endpoint(baseUrl, "/api/articles?page=0"),
  "Public articles API",
);
const articles = await articlesResponse.json();

if (!Array.isArray(articles?.articles)) {
  throw new Error("Public articles API did not return an articles array");
}

console.log(`Web deployment smoke passed for ${baseUrl.origin}`);
console.log(`Source commit: ${expectedSourceCommit}`);
console.log(`Build ID: ${expectedBuildId}`);
console.log(`Deployment target: ${expectedDeploymentTarget}`);
