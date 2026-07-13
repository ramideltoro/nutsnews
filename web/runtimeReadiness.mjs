import { getRuntimeSafetyPolicy } from "./runtimeSafety.mjs";

const IDENTITY_VALUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,127}$/;
const IMAGE_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SCHEMA_VERSION_PATTERN = /^[0-9]{14}$/;
const MIN_TIMEOUT_MS = 25;
const MAX_TIMEOUT_MS = 5000;
const DEFAULT_TIMEOUT_MS = 2000;

const TARGET_RUNTIME_ENVIRONMENTS = new Map([
  ["vps-staging", "staging"],
  ["production-vps", "production"],
]);

function envValue(env, name) {
  return String(env[name] ?? "").trim();
}

function safeIdentityValue(env, fallback, ...names) {
  for (const name of names) {
    const candidate = envValue(env, name);

    if (IDENTITY_VALUE_PATTERN.test(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

function safeDigestValue(env, name) {
  const candidate = envValue(env, name);

  return IMAGE_DIGEST_PATTERN.test(candidate) ? candidate : "unknown";
}

function safeSchemaVersion(env) {
  const candidate = envValue(env, "NUTSNEWS_EXPECTED_SCHEMA_VERSION");

  return SCHEMA_VERSION_PATTERN.test(candidate) ? candidate : "unknown";
}

function readinessTimeout(env) {
  const raw = envValue(env, "NUTSNEWS_READYZ_TIMEOUT_MS");

  if (!raw) {
    return { value: DEFAULT_TIMEOUT_MS, valid: true };
  }

  const value = Number(raw);

  return {
    value,
    valid: Number.isInteger(value) && value >= MIN_TIMEOUT_MS && value <= MAX_TIMEOUT_MS,
  };
}

/**
 * Return only header-safe release identity fields. The expected values are
 * deployment inputs that are compared to the image/runtime identity by
 * evaluateRuntimeReadiness; no URL, project reference, or secret is returned.
 */
export function getRuntimeIdentity(env = process.env) {
  const sourceCommit = safeIdentityValue(
    env,
    "unknown",
    "NUTSNEWS_SOURCE_COMMIT",
    "VERCEL_GIT_COMMIT_SHA",
  );
  const buildId = safeIdentityValue(
    env,
    sourceCommit,
    "NUTSNEWS_BUILD_ID",
    "VERCEL_DEPLOYMENT_ID",
  );
  const explicitTarget = safeIdentityValue(env, "", "NUTSNEWS_DEPLOYMENT_TARGET");
  const vercelEnvironment = safeIdentityValue(env, "", "VERCEL_ENV");
  const deploymentTarget =
    explicitTarget ||
    (vercelEnvironment || (env.VERCEL === "1" ? "vercel" : "unknown"));
  const timeout = readinessTimeout(env);

  return Object.freeze({
    sourceCommit,
    buildId,
    deploymentTarget,
    expectedImageDigest: safeDigestValue(env, "NUTSNEWS_EXPECTED_IMAGE_DIGEST"),
    deployedImageDigest: safeDigestValue(env, "NUTSNEWS_DEPLOYED_IMAGE_DIGEST"),
    expectedSourceCommit: safeIdentityValue(env, "unknown", "NUTSNEWS_EXPECTED_SOURCE_COMMIT"),
    expectedBuildId: safeIdentityValue(env, "unknown", "NUTSNEWS_EXPECTED_BUILD_ID"),
    configGeneration: safeIdentityValue(env, "unknown", "NUTSNEWS_CONFIG_GENERATION"),
    expectedSchemaVersion: safeSchemaVersion(env),
    timeoutMs: timeout.value,
    timeoutValid: timeout.valid,
  });
}

function getIdentityReadiness(policy, identity) {
  if (
    identity.sourceCommit === "unknown" ||
    identity.buildId === "unknown" ||
    identity.deploymentTarget === "unknown" ||
    identity.expectedImageDigest === "unknown" ||
    identity.deployedImageDigest === "unknown" ||
    identity.expectedSourceCommit === "unknown" ||
    identity.expectedBuildId === "unknown" ||
    identity.configGeneration === "unknown" ||
    identity.expectedSchemaVersion === "unknown" ||
    !identity.timeoutValid
  ) {
    return "runtime_identity_invalid";
  }

  const expectedRuntimeEnvironment = TARGET_RUNTIME_ENVIRONMENTS.get(identity.deploymentTarget);
  if (!expectedRuntimeEnvironment) {
    return "deployment_target_invalid";
  }

  if (expectedRuntimeEnvironment !== policy.runtimeEnv) {
    return "deployment_target_environment_mismatch";
  }

  if (
    identity.sourceCommit !== identity.expectedSourceCommit ||
    identity.buildId !== identity.expectedBuildId ||
    identity.expectedImageDigest !== identity.deployedImageDigest
  ) {
    return "release_identity_mismatch";
  }

  return "ready";
}

class ReadinessTimeoutError extends Error {}

async function withinTimeout(promise, timeoutMs) {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new ReadinessTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function result(policy, identity, ready, code) {
  return Object.freeze({
    ready,
    runtimeEnv: policy.runtimeEnv,
    sideEffectsMode: policy.sideEffectsMode,
    code,
    sourceCommit: identity.sourceCommit,
    buildId: identity.buildId,
    deploymentTarget: identity.deploymentTarget,
    expectedImageDigest: identity.expectedImageDigest,
    configGeneration: identity.configGeneration,
  });
}

/**
 * Evaluate the server-side qualification gate. The supplied reader must be a
 * single read-only Supabase query that returns the deployed schema version.
 * Public callers receive only the stable code and safe identity above.
 */
export async function evaluateRuntimeReadiness({
  env = process.env,
  readSchemaVersion,
} = {}) {
  const policy = getRuntimeSafetyPolicy(env);
  const identity = getRuntimeIdentity(env);

  if (!policy.ready) {
    return result(policy, identity, false, policy.code);
  }

  // Vercel remains outside the OCI staging-promotion gate. Retain its existing
  // #117 readiness semantics instead of requiring image-only attestation
  // values from a native Vercel deployment.
  if (env.VERCEL === "1" && !TARGET_RUNTIME_ENVIRONMENTS.has(identity.deploymentTarget)) {
    return result(policy, identity, true, "ready");
  }

  const identityCode = getIdentityReadiness(policy, identity);
  if (identityCode !== "ready") {
    return result(policy, identity, false, identityCode);
  }

  if (typeof readSchemaVersion !== "function") {
    return result(policy, identity, false, "supabase_dependency_failed");
  }

  try {
    const schemaVersion = await withinTimeout(
      Promise.resolve().then(() => readSchemaVersion()),
      identity.timeoutMs,
    );

    if (schemaVersion !== identity.expectedSchemaVersion) {
      return result(policy, identity, false, "schema_version_mismatch");
    }
  } catch (error) {
    return result(
      policy,
      identity,
      false,
      error instanceof ReadinessTimeoutError
        ? "supabase_dependency_timeout"
        : "supabase_dependency_failed",
    );
  }

  return result(policy, identity, true, "ready");
}
