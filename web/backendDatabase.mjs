import {
  RuntimeSafetyError,
  getDatabaseProviderMode,
} from "./runtimeSafety.mjs";

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 15000;

function configuredValue(env, name) {
  return String(env[name] ?? "").trim();
}

function boundedTimeoutMs(env) {
  const raw = configuredValue(env, "NUTSNEWS_BACKEND_API_TIMEOUT_MS");
  if (!raw) {
    return DEFAULT_TIMEOUT_MS;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(parsed, MAX_TIMEOUT_MS);
}

function assertBackendMode(providerMode) {
  if (providerMode === "supabase_primary") {
    throw new RuntimeSafetyError(
      "backend_api_disabled_for_supabase_primary",
      "Backend database API calls are disabled while Supabase is the configured primary.",
    );
  }
}

function operationUrl(baseUrl, operation) {
  if (!/^[a-z0-9][a-z0-9-]{1,96}$/i.test(operation)) {
    throw new RuntimeSafetyError(
      "backend_api_operation_invalid",
      "Backend database API operation is invalid.",
    );
  }

  return new URL(`${baseUrl.replace(/\/+$/, "")}/${operation}`);
}

export function getBackendDatabaseApiConfig(env = process.env) {
  const providerMode = getDatabaseProviderMode(env);
  assertBackendMode(providerMode);

  const baseUrl = configuredValue(env, "NUTSNEWS_BACKEND_API_URL");
  const token = configuredValue(env, "NUTSNEWS_BACKEND_API_TOKEN");
  if (!baseUrl || !token) {
    throw new RuntimeSafetyError(
      "backend_api_config_missing",
      "Backend database API URL and token are required for backend PostgreSQL provider modes.",
    );
  }

  return Object.freeze({
    baseUrl,
    token,
    providerMode,
    timeoutMs: boundedTimeoutMs(env),
  });
}

export async function callBackendDatabaseOperation(
  operation,
  body = {},
  {
    env = process.env,
    fetchImpl = fetch,
    cache = "no-store",
    next,
  } = {},
) {
  const config = getBackendDatabaseApiConfig(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const requestInit = {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
      "x-nutsnews-db-client": "web",
    },
    body: JSON.stringify({
      ...body,
      providerMode: config.providerMode,
    }),
    cache,
    signal: controller.signal,
  };

  if (next) {
    requestInit.next = next;
  }

  try {
    const response = await fetchImpl(operationUrl(config.baseUrl, operation), requestInit);

    if (!response.ok) {
      throw new RuntimeSafetyError(
        "backend_api_request_failed",
        `Backend database API request failed with status ${response.status}.`,
      );
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
