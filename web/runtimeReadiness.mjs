import { getRuntimeSafetyPolicy } from "./runtimeSafety.mjs";
import { MIGRATION_HEAD } from "./migrationContract.mjs";

const IDENTITY_VALUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,127}$/;
const IMAGE_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SCHEMA_VERSION_PATTERN = /^[0-9]{14}$/;
const SCHEMA_FINGERPRINT_PATTERN = /^[a-f0-9]{32}$/;
const MIN_TIMEOUT_MS = 25;
const MAX_TIMEOUT_MS = 5000;
const DEFAULT_TIMEOUT_MS = 2000;

const TARGET_RUNTIME_ENVIRONMENTS = new Map([
  ["vps-staging", "staging"],
  ["production-vps", "production"],
  ["vercel-production", "production"],
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

function getIdentityReadiness(policy, identity, { requireImageIdentity = true } = {}) {
  if (
    identity.sourceCommit === "unknown" ||
    identity.buildId === "unknown" ||
    identity.deploymentTarget === "unknown" ||
    identity.expectedSourceCommit === "unknown" ||
    identity.expectedBuildId === "unknown" ||
    identity.configGeneration === "unknown" ||
    identity.expectedSchemaVersion === "unknown" ||
    !identity.timeoutValid
  ) {
    return "runtime_identity_invalid";
  }

  if (
    requireImageIdentity &&
    (identity.expectedImageDigest === "unknown" || identity.deployedImageDigest === "unknown")
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
    (requireImageIdentity && identity.expectedImageDigest !== identity.deployedImageDigest)
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
    databaseProviderMode: policy.databaseProviderMode,
    productionWritesPaused: policy.productionWritesPaused,
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
 * single read-only query against the configured primary datastore that returns
 * the legacy marker, migration head, recorded schema fingerprint, and current
 * schema fingerprint. Public callers receive only the stable code and safe
 * identity above.
 */
export async function evaluateRuntimeReadiness({
  env = process.env,
  readSchemaContract,
} = {}) {
  const policy = getRuntimeSafetyPolicy(env);
  const identity = getRuntimeIdentity(env);

  if (!policy.ready) {
    return result(policy, identity, false, policy.code);
  }

  const isVercel = env.VERCEL === "1";
  if (isVercel && identity.deploymentTarget !== "vercel-production") {
    return result(policy, identity, false, "deployment_target_invalid");
  }

  // Native Vercel deployments have no OCI digest, but they still need an exact
  // release/build identity and the same required datastore check as the VPS.
  const identityCode = getIdentityReadiness(policy, identity, {
    requireImageIdentity: !isVercel,
  });
  if (identityCode !== "ready") {
    return result(policy, identity, false, identityCode);
  }

  if (typeof readSchemaContract !== "function") {
    return result(
      policy,
      identity,
      false,
      policy.databaseProviderMode === "backend_postgres_primary"
        ? "backend_dependency_failed"
        : "supabase_dependency_failed",
    );
  }

  try {
    const schemaContract = await withinTimeout(
      Promise.resolve().then(() => readSchemaContract()),
      identity.timeoutMs,
    );

    if (!schemaContract || typeof schemaContract !== "object") {
      return result(policy, identity, false, "migration_contract_invalid");
    }

    if (schemaContract.legacySchemaVersion !== identity.expectedSchemaVersion) {
      return result(policy, identity, false, "schema_version_mismatch");
    }

    if (schemaContract.migrationHead !== MIGRATION_HEAD) {
      return result(policy, identity, false, "migration_head_mismatch");
    }

    if (
      !SCHEMA_FINGERPRINT_PATTERN.test(schemaContract.expectedSchemaFingerprint) ||
      !SCHEMA_FINGERPRINT_PATTERN.test(schemaContract.actualSchemaFingerprint)
    ) {
      return result(policy, identity, false, "migration_contract_invalid");
    }

    if (schemaContract.expectedSchemaFingerprint !== schemaContract.actualSchemaFingerprint) {
      return result(policy, identity, false, "schema_drift_detected");
    }
  } catch (error) {
    const dependency =
      policy.databaseProviderMode === "backend_postgres_primary" ? "backend" : "supabase";
    return result(
      policy,
      identity,
      false,
      error instanceof ReadinessTimeoutError
        ? `${dependency}_dependency_timeout`
        : `${dependency}_dependency_failed`,
    );
  }

  return result(policy, identity, true, "ready");
}
