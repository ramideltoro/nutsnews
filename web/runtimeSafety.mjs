const RUNTIME_ENVS = new Set(["staging", "production"]);
const SIDE_EFFECTS_MODES = new Set(["disabled", "sandbox", "live"]);
const DATA_ENVS = new Set(["staging", "production"]);
const PROJECT_REF_PATTERN = /^[a-z0-9][a-z0-9-]{2,62}$/;
const SYNTHETIC_NAMESPACE_PATTERN = /^nutsnews-test-[a-z0-9][a-z0-9-]{5,96}$/;

const SUPABASE_URL_VARIABLES = [
  "NUTSNEWS_SUPABASE_URL",
  "SUPABASE_URL",
  "NUTSNEWS_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
];

function envValue(env, name) {
  return String(env[name] ?? "").trim();
}

function isLocalOrTestHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "host.docker.internal" ||
    hostname.endsWith(".test")
  );
}

function projectRefFromUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const match = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/);

    if (match) {
      return { kind: "supabase", projectRef: match[1], url };
    }

    if (isLocalOrTestHost(hostname)) {
      return { kind: "fixture", projectRef: null, url };
    }
  } catch {
    // The public error below intentionally never includes the configured URL.
  }

  return { kind: "invalid", projectRef: null, url: null };
}

function hasContradictoryLegacyValue(env, explicitName, legacyNames) {
  const explicit = envValue(env, explicitName);

  return legacyNames.some((name) => {
    const legacy = envValue(env, name);
    return legacy && legacy !== explicit;
  });
}

function exactOrigin(value, expectedOrigin) {
  try {
    const url = new URL(value);
    return (
      url.origin === expectedOrigin &&
      url.username === "" &&
      url.password === "" &&
      (url.pathname === "" || url.pathname === "/") &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

function requestUsesOrigin(value, expectedOrigin) {
  try {
    return new URL(value).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function basePolicy(env) {
  const reasons = [];
  const runtimeEnv = envValue(env, "NUTSNEWS_RUNTIME_ENV");
  const sideEffectsMode = envValue(env, "NUTSNEWS_SIDE_EFFECTS_MODE");
  const dataEnvironment = envValue(env, "NUTSNEWS_DATA_ENVIRONMENT");
  const credentialsEnvironment = envValue(env, "NUTSNEWS_SUPABASE_CREDENTIALS_ENV");
  const projectRef = envValue(env, "NUTSNEWS_SUPABASE_PROJECT_REF").toLowerCase();
  const productionProjectRef = envValue(
    env,
    "NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF",
  ).toLowerCase();

  if (!RUNTIME_ENVS.has(runtimeEnv)) {
    reasons.push("runtime_environment_invalid");
  }
  if (
    hasContradictoryLegacyValue(env, "NUTSNEWS_RUNTIME_ENV", [
      "NUTSNEWS_PUBLIC_APP_ENV",
      "NEXT_PUBLIC_APP_ENV",
    ])
  ) {
    reasons.push("runtime_environment_conflict");
  }

  if (!SIDE_EFFECTS_MODES.has(sideEffectsMode)) {
    reasons.push("side_effects_mode_invalid");
  }
  if (
    hasContradictoryLegacyValue(env, "NUTSNEWS_SIDE_EFFECTS_MODE", [
      "NUTSNEWS_PUBLIC_SIDE_EFFECTS_MODE",
    ])
  ) {
    reasons.push("side_effects_mode_conflict");
  }
  if (runtimeEnv === "staging" && sideEffectsMode === "live") {
    reasons.push("staging_live_side_effects_rejected");
  }

  if (!DATA_ENVS.has(dataEnvironment)) {
    reasons.push("data_environment_invalid");
  }
  if (!DATA_ENVS.has(credentialsEnvironment)) {
    reasons.push("credentials_environment_invalid");
  }
  if (!PROJECT_REF_PATTERN.test(projectRef)) {
    reasons.push("supabase_project_identity_invalid");
  }
  if (!PROJECT_REF_PATTERN.test(productionProjectRef)) {
    reasons.push("production_project_identity_invalid");
  }

  if (RUNTIME_ENVS.has(runtimeEnv) && dataEnvironment !== runtimeEnv) {
    reasons.push("runtime_data_environment_mismatch");
  }
  if (DATA_ENVS.has(dataEnvironment) && credentialsEnvironment !== dataEnvironment) {
    reasons.push("credentials_data_environment_mismatch");
  }
  if (runtimeEnv === "staging" && projectRef === productionProjectRef) {
    reasons.push("staging_production_project_rejected");
  }
  if (runtimeEnv === "production" && projectRef !== productionProjectRef) {
    reasons.push("production_project_identity_mismatch");
  }

  let hasSupabaseUrl = false;
  for (const name of SUPABASE_URL_VARIABLES) {
    const configuredUrl = envValue(env, name);
    if (!configuredUrl) {
      continue;
    }

    hasSupabaseUrl = true;
    const identity = projectRefFromUrl(configuredUrl);
    if (identity.kind === "invalid") {
      reasons.push("supabase_endpoint_invalid");
      continue;
    }
    if (identity.kind === "fixture" && runtimeEnv !== "staging") {
      reasons.push("production_fixture_endpoint_rejected");
      continue;
    }
    if (identity.kind === "supabase" && identity.projectRef !== projectRef) {
      reasons.push("supabase_endpoint_identity_mismatch");
    }
  }

  if (!hasSupabaseUrl) {
    reasons.push("supabase_endpoint_missing");
  }

  return {
    ready: reasons.length === 0,
    runtimeEnv: RUNTIME_ENVS.has(runtimeEnv) ? runtimeEnv : "invalid",
    sideEffectsMode: SIDE_EFFECTS_MODES.has(sideEffectsMode)
      ? sideEffectsMode
      : "disabled",
    dataEnvironment: DATA_ENVS.has(dataEnvironment) ? dataEnvironment : "invalid",
    credentialsEnvironment: DATA_ENVS.has(credentialsEnvironment)
      ? credentialsEnvironment
      : "invalid",
    code: reasons[0] ?? "ready",
  };
}

/**
 * Resolve the process-wide runtime/data boundary without returning configured
 * URLs, project identities, credentials, or tokens. It is safe to expose the
 * returned status in readiness responses and test output.
 */
export function getRuntimeSafetyPolicy(env = process.env) {
  return Object.freeze(basePolicy(env));
}

export class RuntimeSafetyError extends Error {
  constructor(code, message = "Runtime safety policy refused this operation.") {
    super(message);
    this.name = "RuntimeSafetyError";
    this.code = code;
  }
}

function refuse(code, message) {
  throw new RuntimeSafetyError(code, message);
}

export function assertRuntimeReady(env = process.env) {
  const policy = getRuntimeSafetyPolicy(env);
  if (!policy.ready) {
    refuse(policy.code, "Runtime is not ready because its safety policy is invalid.");
  }
  return policy;
}

export function getSafeReadiness(env = process.env) {
  const policy = getRuntimeSafetyPolicy(env);
  return Object.freeze({
    ready: policy.ready,
    runtimeEnv: policy.runtimeEnv,
    sideEffectsMode: policy.sideEffectsMode,
    code: policy.code,
  });
}

export function assertDataRead(operation = "data-read", env = process.env) {
  void operation;
  return assertRuntimeReady(env);
}

export function assertProductionOperation(operation = "production-operation", env = process.env) {
  void operation;
  const policy = assertRuntimeReady(env);
  if (policy.runtimeEnv !== "production" || policy.sideEffectsMode !== "live") {
    refuse(
      "production_operation_required",
      "This operation is disabled outside the live production runtime.",
    );
  }
  return policy;
}

export function assertOAuthCallback(
  operation = "oauth-callback",
  requestUrl = "",
  env = process.env,
) {
  void operation;
  const policy = assertRuntimeReady(env);

  if (policy.runtimeEnv === "production" && policy.sideEffectsMode === "live") {
    return policy;
  }

  const expectedOrigin = "https://staging.nutsnews.com";
  const authUrl = envValue(env, "AUTH_URL");
  const legacyAuthUrl = envValue(env, "NEXTAUTH_URL");
  const configuredAuthUrl = authUrl || legacyAuthUrl;
  const authUrlsConflict = authUrl && legacyAuthUrl && authUrl !== legacyAuthUrl;
  const stagingCredentials =
    envValue(env, "NUTSNEWS_OAUTH_CREDENTIALS_ENV") === "staging" &&
    envValue(env, "AUTH_GOOGLE_ID") !== "" &&
    envValue(env, "AUTH_GOOGLE_SECRET") !== "";

  if (
    policy.runtimeEnv === "staging" &&
    policy.sideEffectsMode === "disabled" &&
    stagingCredentials &&
    !authUrlsConflict &&
    exactOrigin(configuredAuthUrl, expectedOrigin) &&
    requestUsesOrigin(requestUrl, expectedOrigin)
  ) {
    return policy;
  }

  refuse(
    "oauth_callback_identity_required",
    "OAuth callbacks are disabled for this runtime identity.",
  );
}

export function assertDataMutation(operation = "data-mutation", env = process.env) {
  return assertProductionOperation(operation, env);
}

export function assertIsolatedDataMutation(operation = "isolated-data-mutation", env = process.env) {
  void operation;
  const policy = assertRuntimeReady(env);
  if (
    (policy.runtimeEnv === "production" && policy.sideEffectsMode === "live") ||
    (policy.runtimeEnv === "staging" && policy.sideEffectsMode === "sandbox")
  ) {
    return policy;
  }
  refuse(
    "isolated_data_mutation_blocked",
    "Data mutations are disabled for this runtime.",
  );
}

export function assertSyntheticFixtureMutation(namespace, env = process.env) {
  const policy = assertRuntimeReady(env);
  if (
    policy.runtimeEnv !== "staging" ||
    policy.sideEffectsMode !== "sandbox" ||
    !SYNTHETIC_NAMESPACE_PATTERN.test(String(namespace ?? ""))
  ) {
    refuse(
      "synthetic_fixture_required",
      "Only uniquely namespaced synthetic fixtures may be mutated in staging.",
    );
  }
  return policy;
}

export function assertSyntheticTestUser(namespace, env = process.env) {
  return assertSyntheticFixtureMutation(namespace, env);
}

export function isSandboxEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return ["http:", "https:"].includes(url.protocol) && isLocalOrTestHost(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function assertExternalSideEffect(operation, endpoint, env = process.env) {
  const policy = assertRuntimeReady(env);
  if (policy.runtimeEnv === "production" && policy.sideEffectsMode === "live") {
    return policy;
  }
  if (policy.runtimeEnv === "staging" && policy.sideEffectsMode === "sandbox" && isSandboxEndpoint(endpoint)) {
    return policy;
  }
  refuse(
    "external_side_effect_blocked",
    "External side effects are disabled for this runtime.",
  );
}

export function isTelemetryDeliveryAllowed(env = process.env) {
  try {
    const policy = assertProductionOperation("telemetry-delivery", env);
    return policy.runtimeEnv === "production";
  } catch {
    return false;
  }
}

export function isProductionLiveRuntime(env = process.env) {
  try {
    assertProductionOperation("production-runtime-check", env);
    return true;
  } catch {
    return false;
  }
}
