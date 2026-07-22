import "server-only";

import {
  callBackendDatabaseOperation,
  type BackendDatabaseOperationOptions,
  type DatabaseProviderMode,
} from "@/lib/backendDatabase";
import { RuntimeSafetyError, getDatabaseProviderMode, getRuntimeSafetyPolicy } from "@/lib/runtimeSafety";
import { getServerSupabase, getServerSupabaseConfig } from "@/lib/supabase";

export const ADMIN_DATABASE_READ_OPERATIONS = [
  "load-admin-production-readiness",
  "load-admin-article-reviews",
  "load-admin-article-engagement",
  "load-admin-ai-usage",
  "load-admin-local-ai",
  "load-admin-translation-quality",
  "load-admin-guardrails",
  "load-admin-worker-shards",
  "load-admin-rss-feed-health",
  "load-admin-feed-management",
  "load-admin-audit-log",
  "load-admin-runtime-feature-flags",
] as const;

export const ADMIN_DATABASE_MUTATION_OPERATIONS = [
  "set-admin-rss-feed-active-status",
  "set-admin-rss-feed-trust-tier",
  "insert-admin-audit-log-event",
] as const;

export type AdminDatabaseReadOperation =
  (typeof ADMIN_DATABASE_READ_OPERATIONS)[number];

export type AdminDatabaseMutationOperation =
  (typeof ADMIN_DATABASE_MUTATION_OPERATIONS)[number];

export type AdminDatabaseOperation =
  | AdminDatabaseReadOperation
  | AdminDatabaseMutationOperation;

export type AdminDatabaseJsonValue =
  | string
  | number
  | boolean
  | null
  | AdminDatabaseJsonValue[]
  | AdminDatabaseJsonObject;

export type AdminDatabaseJsonObject = {
  [key: string]: AdminDatabaseJsonValue;
};

export type AdminDatabaseReadParams = {
  limit?: number;
  offset?: number;
  cursor?: string | null;
  range?: string;
  filters?: AdminDatabaseJsonObject;
  [key: string]: AdminDatabaseJsonValue | undefined;
};

export type AdminFeedActiveStatusMutation = {
  feedUrl: string;
  active: boolean;
  actorEmail: string;
  reason?: string;
};

export type AdminFeedTrustTierMutation = {
  feedUrl: string;
  sourceTrustTier: string;
  publisherAllowlistStatus: string;
  actorEmail: string;
  reason?: string;
};

export type AdminAuditLogInsertMutation = {
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: AdminDatabaseJsonObject | null;
  after?: AdminDatabaseJsonObject | null;
  metadata?: AdminDatabaseJsonObject | null;
};

export type AdminDatabaseOperationBodyMap = {
  [Operation in AdminDatabaseReadOperation]: AdminDatabaseReadParams;
} & {
  "set-admin-rss-feed-active-status": AdminFeedActiveStatusMutation;
  "set-admin-rss-feed-trust-tier": AdminFeedTrustTierMutation;
  "insert-admin-audit-log-event": AdminAuditLogInsertMutation;
};

export type AdminDatabaseRowsResult<
  Row extends AdminDatabaseJsonObject = AdminDatabaseJsonObject,
> = {
  rows: Row[];
  rowCount?: number;
  generatedAt?: string;
};

export type AdminMutationResult = {
  ok: boolean;
  id?: string;
  message?: string;
  changed?: boolean;
  auditEventId?: string | null;
  nextSourceTrustTier?: string | null;
  nextPublisherAllowlistStatus?: string | null;
};

export type AdminDatabaseOperationResultMap = {
  [Operation in AdminDatabaseReadOperation]: AdminDatabaseRowsResult;
} & {
  "set-admin-rss-feed-active-status": AdminMutationResult;
  "set-admin-rss-feed-trust-tier": AdminMutationResult;
  "insert-admin-audit-log-event": AdminMutationResult;
};

export type AdminSupabaseDatabaseContext = {
  operation: AdminDatabaseOperation;
  providerMode: Extract<DatabaseProviderMode, "supabase_primary" | "backend_postgres_shadow">;
  getClient: typeof getServerSupabase;
  getConfig: typeof getServerSupabaseConfig;
};

export type AdminSupabaseDatabaseHandler<Operation extends AdminDatabaseOperation> = (
  context: AdminSupabaseDatabaseContext,
) =>
  | AdminDatabaseOperationResultMap[Operation]
  | Promise<AdminDatabaseOperationResultMap[Operation]>;

export type AdminDatabaseAccessOptions = Pick<
  BackendDatabaseOperationOptions,
  "cache" | "env" | "fetchImpl" | "next"
>;

export class AdminDatabaseAccessError extends Error {
  readonly code: string;
  readonly operation: string;
  readonly providerMode: DatabaseProviderMode | "invalid" | "unknown";
  readonly cause?: unknown;

  constructor({
    code,
    message,
    operation,
    providerMode,
    cause,
  }: {
    code: string;
    message: string;
    operation: string;
    providerMode: DatabaseProviderMode | "invalid" | "unknown";
    cause?: unknown;
  }) {
    super(message);
    this.name = "AdminDatabaseAccessError";
    this.code = code;
    this.operation = operation;
    this.providerMode = providerMode;
    this.cause = cause;
  }
}

function isDatabaseProviderMode(value: string): value is DatabaseProviderMode {
  return (
    value === "supabase_primary" ||
    value === "backend_postgres_shadow" ||
    value === "backend_postgres_primary"
  );
}

function errorCode(error: unknown) {
  if (
    error instanceof RuntimeSafetyError ||
    (error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string")
  ) {
    return error.code;
  }

  return "admin_database_operation_failed";
}

function inferredProviderMode(env: NodeJS.ProcessEnv) {
  try {
    const providerMode = getRuntimeSafetyPolicy(env).databaseProviderMode;

    return isDatabaseProviderMode(providerMode) ? providerMode : "invalid";
  } catch {
    return "unknown";
  }
}

function adminDatabaseErrorMessage({
  code,
  operation,
  providerMode,
}: {
  code: string;
  operation: string;
  providerMode: DatabaseProviderMode | "invalid" | "unknown";
}) {
  if (code === "backend_api_config_missing") {
    return `Admin database operation "${operation}" is configured for ${providerMode}, but the protected backend database API config is missing. Set NUTSNEWS_BACKEND_API_URL and NUTSNEWS_BACKEND_API_TOKEN.`;
  }

  if (code === "backend_api_request_failed") {
    return `Admin database operation "${operation}" failed through the protected backend database API. Check the backend API logs and operation contract.`;
  }

  if (code === "backend_api_disabled_for_supabase_primary") {
    return `Admin database operation "${operation}" attempted a backend API call while Supabase is the configured primary.`;
  }

  if (code === "supabase_access_disabled_for_backend_primary") {
    return `Admin database operation "${operation}" attempted Supabase service-role access while backend PostgreSQL is primary.`;
  }

  return `Admin database operation "${operation}" could not run for provider mode ${providerMode}. Readiness code: ${code}.`;
}

function toAdminDatabaseAccessError(
  error: unknown,
  operation: AdminDatabaseOperation,
  providerMode: DatabaseProviderMode | "invalid" | "unknown",
) {
  if (error instanceof AdminDatabaseAccessError) {
    return error;
  }

  const code = errorCode(error);
  return new AdminDatabaseAccessError({
    code,
    message: adminDatabaseErrorMessage({ code, operation, providerMode }),
    operation,
    providerMode,
    cause: error,
  });
}

function supabaseContext(
  operation: AdminDatabaseOperation,
  providerMode: Extract<DatabaseProviderMode, "supabase_primary" | "backend_postgres_shadow">,
): AdminSupabaseDatabaseContext {
  return {
    operation,
    providerMode,
    getClient: getServerSupabase,
    getConfig: getServerSupabaseConfig,
  };
}

async function runAdminDatabaseOperation<Operation extends AdminDatabaseOperation>(
  operation: Operation,
  body: AdminDatabaseOperationBodyMap[Operation],
  supabaseHandler: AdminSupabaseDatabaseHandler<Operation>,
  options: AdminDatabaseAccessOptions = {},
): Promise<AdminDatabaseOperationResultMap[Operation]> {
  const env = options.env ?? process.env;
  let providerMode: DatabaseProviderMode;

  try {
    const configuredProviderMode = getDatabaseProviderMode(env);
    if (!isDatabaseProviderMode(configuredProviderMode)) {
      throw new RuntimeSafetyError(
        "database_provider_mode_invalid",
        "Admin database provider mode is invalid.",
      );
    }
    providerMode = configuredProviderMode;
  } catch (error) {
    throw toAdminDatabaseAccessError(error, operation, inferredProviderMode(env));
  }

  if (providerMode === "backend_postgres_primary") {
    try {
      return await callBackendDatabaseOperation<AdminDatabaseOperationResultMap[Operation]>(
        operation,
        body,
        options,
      );
    } catch (error) {
      throw toAdminDatabaseAccessError(error, operation, providerMode);
    }
  }

  return supabaseHandler(supabaseContext(operation, providerMode));
}

export function readAdminDatabase<Operation extends AdminDatabaseReadOperation>(
  operation: Operation,
  body: AdminDatabaseOperationBodyMap[Operation],
  supabaseHandler: AdminSupabaseDatabaseHandler<Operation>,
  options?: AdminDatabaseAccessOptions,
) {
  return runAdminDatabaseOperation(operation, body, supabaseHandler, options);
}

export function mutateAdminDatabase<Operation extends AdminDatabaseMutationOperation>(
  operation: Operation,
  body: AdminDatabaseOperationBodyMap[Operation],
  supabaseHandler: AdminSupabaseDatabaseHandler<Operation>,
  options?: AdminDatabaseAccessOptions,
) {
  return runAdminDatabaseOperation(operation, body, supabaseHandler, options);
}
