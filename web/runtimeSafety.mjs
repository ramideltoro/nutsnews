const RUNTIME_ENVS = new Set(["staging", "production"]);
const SIDE_EFFECTS_MODES = new Set(["disabled", "sandbox", "live"]);
const DATA_ENVS = new Set(["staging", "production"]);
const DATABASE_PROVIDER_MODES = new Set([
  "supabase_primary",
  "backend_postgres_shadow",
  "backend_postgres_primary",
]);
const PROJECT_REF_PATTERN = /^[a-z0-9][a-z0-9-]{2,62}$/;
const SYNTHETIC_NAMESPACE_PATTERN = /^nutsnews-test-[a-z0-9][a-z0-9-]{5,96}$/;
const BACKEND_POSTGRES_PRIMARY_CONFIRMATION = "enable-backend-postgres-primary";
const TRUTHY_CONFIG_VALUES = new Set(["1", "true", "yes", "on"]);
const PRODUCTION_ADMIN_CANONICAL_ORIGIN = "https://www.nutsnews.com";
const PRODUCTION_ADMIN_DIRECT_ORIGIN = "https://vps.nutsnews.com";
const PRODUCTION_VPS_DEPLOYMENT_TARGETS = new Set(["production-vps", "vps"]);

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

function isBareHttpsOrigin(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
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

function normalizedBareHttpsOrigin(value) {
  return isBareHttpsOrigin(value) ? new URL(value).origin : "";
}

function authUrlsConflict(authUrl, legacyAuthUrl) {
  if (!authUrl || !legacyAuthUrl) {
    return false;
  }

  return (
    (normalizedBareHttpsOrigin(authUrl) || authUrl) !==
    (normalizedBareHttpsOrigin(legacyAuthUrl) || legacyAuthUrl)
  );
}

function firstForwardedValue(value) {
  return String(value ?? "").split(",", 1)[0]?.trim() ?? "";
}

function requestOrigin(value) {
  if (value && typeof value === "object") {
    try {
      const fallback = value.url ? new URL(value.url) : null;
      const forwardedProto =
        firstForwardedValue(value.forwardedProto) ||
        fallback?.protocol.slice(0, -1) ||
        "";
      const host = firstForwardedValue(value.host) || fallback?.host || "";
      if (!forwardedProto || !host) {
        return "";
      }

      return new URL(`${forwardedProto}://${host}`).origin;
    } catch {
      return "";
    }
  }

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function requestUsesOrigin(value, expectedOrigin) {
  return requestOrigin(value) === expectedOrigin;
}

function requestUsesAnyOrigin(value, expectedOrigins) {
  const origin = requestOrigin(value);
  return expectedOrigins.includes(origin);
}

function getDatabaseProviderModeValue(env) {
  return envValue(env, "NUTSNEWS_DATABASE_PROVIDER_MODE") || "supabase_primary";
}

function isProductionWritesPaused(env) {
  return TRUTHY_CONFIG_VALUES.has(
    envValue(env, "NUTSNEWS_PRODUCTION_WRITES_PAUSED").toLowerCase(),
  );
}

function hasBackendApiConfig(env) {
  return envValue(env, "NUTSNEWS_BACKEND_API_URL") !== "" && envValue(env, "NUTSNEWS_BACKEND_API_TOKEN") !== "";
}

function isBackendApiUrlValid(env) {
  const value = envValue(env, "NUTSNEWS_BACKEND_API_URL");
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.username === "" &&
      url.password === "" &&
      url.hash === "" &&
      (url.protocol === "https:" || isLocalOrTestHost(url.hostname.toLowerCase()))
    );
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
  const databaseProviderMode = getDatabaseProviderModeValue(env);
  const supabasePrimaryRequired = databaseProviderMode !== "backend_postgres_primary";
  const backendApiRequired = databaseProviderMode !== "supabase_primary";
  const productionWritesPaused = isProductionWritesPaused(env);

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
  if (supabasePrimaryRequired && !DATA_ENVS.has(credentialsEnvironment)) {
    reasons.push("credentials_environment_invalid");
  }
  if (!DATABASE_PROVIDER_MODES.has(databaseProviderMode)) {
    reasons.push("database_provider_mode_invalid");
  }
  if (supabasePrimaryRequired && !PROJECT_REF_PATTERN.test(projectRef)) {
    reasons.push("supabase_project_identity_invalid");
  }
  if (supabasePrimaryRequired && !PROJECT_REF_PATTERN.test(productionProjectRef)) {
    reasons.push("production_project_identity_invalid");
  }

  if (RUNTIME_ENVS.has(runtimeEnv) && dataEnvironment !== runtimeEnv) {
    reasons.push("runtime_data_environment_mismatch");
  }
  if (
    supabasePrimaryRequired &&
    DATA_ENVS.has(dataEnvironment) &&
    credentialsEnvironment !== dataEnvironment
  ) {
    reasons.push("credentials_data_environment_mismatch");
  }
  if (supabasePrimaryRequired && runtimeEnv === "staging" && projectRef === productionProjectRef) {
    reasons.push("staging_production_project_rejected");
  }
  if (supabasePrimaryRequired && runtimeEnv === "production" && projectRef !== productionProjectRef) {
    reasons.push("production_project_identity_mismatch");
  }

  let hasSupabaseUrl = false;
  if (supabasePrimaryRequired) {
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
  }

  if (supabasePrimaryRequired && !hasSupabaseUrl) {
    reasons.push("supabase_endpoint_missing");
  }
  if (backendApiRequired && !hasBackendApiConfig(env)) {
    reasons.push("backend_api_config_missing");
  }
  if (backendApiRequired && hasBackendApiConfig(env) && !isBackendApiUrlValid(env)) {
    reasons.push("backend_api_url_invalid");
  }
  if (
    databaseProviderMode === "backend_postgres_primary" &&
    envValue(env, "NUTSNEWS_BACKEND_POSTGRES_PRIMARY_CONFIRMATION") !== BACKEND_POSTGRES_PRIMARY_CONFIRMATION
  ) {
    reasons.push("backend_postgres_primary_confirmation_missing");
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
    databaseProviderMode: DATABASE_PROVIDER_MODES.has(databaseProviderMode)
      ? databaseProviderMode
      : "invalid",
    productionWritesPaused,
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

function assertProductionWritesNotPaused(policy) {
  if (policy.productionWritesPaused) {
    refuse(
      "production_writes_paused",
      "Production writes and external side effects are paused for a database cutover window.",
    );
  }
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
    databaseProviderMode: policy.databaseProviderMode,
    productionWritesPaused: policy.productionWritesPaused,
    code: policy.code,
  });
}

export function getDatabaseProviderMode(env = process.env) {
  const policy = assertRuntimeReady(env);
  return policy.databaseProviderMode;
}

export function isSupabasePrimaryRequired(env = process.env) {
  return getDatabaseProviderModeValue(env) !== "backend_postgres_primary";
}

export function assertSupabasePrimaryAllowed(operation = "supabase-access", env = process.env) {
  void operation;
  const policy = assertRuntimeReady(env);
  if (policy.databaseProviderMode === "backend_postgres_primary") {
    refuse(
      "supabase_access_disabled_for_backend_primary",
      "Supabase access is disabled while backend PostgreSQL is the configured primary.",
    );
  }
  return policy;
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
  assertProductionWritesNotPaused(policy);
  return policy;
}

/**
 * @param {string} [operation]
 * @param {string | { url: string, host: string, forwardedProto: string }} [requestIdentity]
 * @param {NodeJS.ProcessEnv} [env]
 */
export function assertOAuthCallback(
  operation = "oauth-callback",
  requestIdentity = "",
  env = process.env,
) {
  void operation;
  const policy = assertRuntimeReady(env);
  const authUrl = envValue(env, "AUTH_URL");
  const legacyAuthUrl = envValue(env, "NEXTAUTH_URL");
  const configuredAuthUrl = authUrl || legacyAuthUrl;
  const hasConflictingAuthUrls = authUrlsConflict(authUrl, legacyAuthUrl);

  if (
    policy.runtimeEnv === "production" &&
    policy.sideEffectsMode === "live" &&
    PRODUCTION_VPS_DEPLOYMENT_TARGETS.has(envValue(env, "NUTSNEWS_DEPLOYMENT_TARGET"))
  ) {
    const configuredCanonicalOrigin =
      envValue(env, "NUTSNEWS_ADMIN_CANONICAL_ORIGIN") ||
      PRODUCTION_ADMIN_CANONICAL_ORIGIN;
    const configuredDirectOrigin =
      envValue(env, "NUTSNEWS_ADMIN_DIRECT_ORIGIN") ||
      PRODUCTION_ADMIN_DIRECT_ORIGIN;
    const canonicalOrigin = normalizedBareHttpsOrigin(configuredCanonicalOrigin);
    const directOrigin = normalizedBareHttpsOrigin(configuredDirectOrigin);
    const trustHost = envValue(env, "AUTH_TRUST_HOST").toLowerCase();

    if (!canonicalOrigin || !directOrigin) {
      refuse(
        "oauth_admin_origin_invalid",
        "Production admin OAuth origins must be bare HTTPS origins.",
      );
    }
    if (hasConflictingAuthUrls) {
      refuse(
        "oauth_auth_url_conflict",
        "Production AUTH_URL and NEXTAUTH_URL must resolve to the same canonical admin origin.",
      );
    }
    if (!authUrl || !exactOrigin(authUrl, canonicalOrigin)) {
      refuse(
        "oauth_canonical_origin_mismatch",
        "Production AUTH_URL must match the canonical admin origin.",
      );
    }
    if (legacyAuthUrl && !exactOrigin(legacyAuthUrl, canonicalOrigin)) {
      refuse(
        "oauth_canonical_origin_mismatch",
        "Production NEXTAUTH_URL must match the canonical admin origin when set.",
      );
    }
    if (trustHost && !TRUTHY_CONFIG_VALUES.has(trustHost)) {
      refuse(
        "oauth_trust_host_disabled",
        "Production Auth.js host trust must stay enabled behind the VPS proxy.",
      );
    }
    if (!requestUsesAnyOrigin(requestIdentity, [canonicalOrigin, directOrigin])) {
      refuse(
        "oauth_request_origin_mismatch",
        "Production OAuth requests must arrive through the canonical or direct VPS admin origin.",
      );
    }
    return policy;
  }

  if (policy.runtimeEnv === "production" && policy.sideEffectsMode === "live") {
    return policy;
  }

  const expectedOrigin = "https://staging.nutsnews.com";
  const stagingCredentials =
    envValue(env, "NUTSNEWS_OAUTH_CREDENTIALS_ENV") === "staging" &&
    envValue(env, "AUTH_GOOGLE_ID") !== "" &&
    envValue(env, "AUTH_GOOGLE_SECRET") !== "";

  if (
    policy.runtimeEnv === "staging" &&
    policy.sideEffectsMode === "disabled" &&
    stagingCredentials &&
    !hasConflictingAuthUrls &&
    exactOrigin(configuredAuthUrl, expectedOrigin) &&
    requestUsesOrigin(requestIdentity, expectedOrigin)
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
    if (policy.runtimeEnv === "production" && policy.productionWritesPaused) {
      assertProductionWritesNotPaused(policy);
    }
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
  const policy = assertRuntimeReady(env);
  if (policy.runtimeEnv === "production" && policy.sideEffectsMode === "live") {
    refuse(
      "synthetic_test_user_production_live_rejected",
      "Admin test auth bypass is disabled in live production runtime.",
    );
  }

  if (
    policy.runtimeEnv === "staging" &&
    SYNTHETIC_NAMESPACE_PATTERN.test(String(namespace ?? ""))
  ) {
    return policy;
  }

  refuse(
    "synthetic_test_user_required",
    "Admin test auth bypass requires a uniquely namespaced staging runtime.",
  );
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
    assertProductionWritesNotPaused(policy);
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
