import {
  RuntimeSafetyError,
  getDatabaseProviderMode,
} from "./runtimeSafety.mjs";

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 15000;
const LOG_SERVICE_NAME = "nutsnews-web";

function safeLogValue(value, maxLength = 160) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return undefined;
  }

  const safe = raw.replace(/[^\w./:@+-]/g, "_");
  return safe.slice(0, maxLength);
}

function firstSafeLogValue(env, names, maxLength = 160) {
  for (const name of names) {
    const safe = safeLogValue(env[name], maxLength);
    if (safe) {
      return safe;
    }
  }

  return undefined;
}

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

function safeDeploymentIdentity(env) {
  const identity = {
    source_commit: firstSafeLogValue(
      env,
      ["NUTSNEWS_SOURCE_COMMIT", "NEXT_PUBLIC_NUTSNEWS_SOURCE_COMMIT", "VERCEL_GIT_COMMIT_SHA"],
      80,
    ),
    build_id: firstSafeLogValue(env, ["NUTSNEWS_BUILD_ID", "NEXT_PUBLIC_NUTSNEWS_BUILD_ID"], 120),
    deployment_target: safeLogValue(env.NUTSNEWS_DEPLOYMENT_TARGET, 80),
    vercel_env: safeLogValue(env.VERCEL_ENV, 40),
    vercel_region: safeLogValue(env.VERCEL_REGION, 40),
    vercel_deployment_id: safeLogValue(env.VERCEL_DEPLOYMENT_ID, 120),
  };

  return Object.fromEntries(
    Object.entries(identity).filter(([, value]) => value !== undefined),
  );
}

function backendFailureClass({ status, error }) {
  if (error?.name === "AbortError") {
    return "timeout";
  }

  if (typeof status === "number") {
    if (status === 404) {
      return "unknown_operation";
    }
    if (status === 401 || status === 403) {
      return "auth_failure";
    }
    if (status >= 500) {
      return "backend_internal_error";
    }
    if (status >= 400) {
      return "backend_request_error";
    }
    return "unexpected_backend_status";
  }

  return "network_error";
}

function logBackendDatabaseOperationFailure({
  operation,
  url,
  status,
  providerMode,
  durationMs,
  failureClass,
  error,
  env,
}) {
  const deployment = safeDeploymentIdentity(env);
  const payload = {
    dt: new Date().toISOString(),
    level: "error",
    service: LOG_SERVICE_NAME,
    event: "backend_database_operation_failed",
    message: "Backend database operation failed.",
    operation,
    backend_url_host: url.host,
    backend_url_path: url.pathname,
    http_status: status ?? null,
    provider_mode: providerMode,
    duration_ms: durationMs,
    failure_class: failureClass,
    ...(error?.name ? { error_name: safeLogValue(error.name, 80) } : {}),
    ...(Object.keys(deployment).length ? { deployment } : {}),
  };

  console.error(JSON.stringify(payload));
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
  const url = operationUrl(config.baseUrl, operation);
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

  const startedAt = Date.now();

  try {
    const response = await fetchImpl(url, requestInit);
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      logBackendDatabaseOperationFailure({
        operation,
        url,
        status: response.status,
        providerMode: config.providerMode,
        durationMs,
        failureClass: backendFailureClass({ status: response.status }),
        env,
      });

      throw new RuntimeSafetyError(
        "backend_api_request_failed",
        `Backend database API request failed with status ${response.status}.`,
      );
    }

    try {
      return await response.json();
    } catch (error) {
      logBackendDatabaseOperationFailure({
        operation,
        url,
        status: response.status,
        providerMode: config.providerMode,
        durationMs,
        failureClass: "invalid_json",
        error,
        env,
      });

      throw new RuntimeSafetyError(
        "backend_api_request_failed",
        "Backend database API response was not valid JSON.",
      );
    }
  } catch (error) {
    if (error instanceof RuntimeSafetyError) {
      throw error;
    }

    const durationMs = Date.now() - startedAt;
    logBackendDatabaseOperationFailure({
      operation,
      url,
      status: null,
      providerMode: config.providerMode,
      durationMs,
      failureClass: backendFailureClass({ error }),
      error,
      env,
    });

    throw new RuntimeSafetyError(
      "backend_api_request_failed",
      "Backend database API request failed before a response was returned.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
