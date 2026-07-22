import "server-only";

import * as backendDatabase from "../backendDatabase.mjs";

export type DatabaseProviderMode =
  | "supabase_primary"
  | "backend_postgres_shadow"
  | "backend_postgres_primary";

export type BackendDatabaseApiConfig = {
  baseUrl: string;
  token: string;
  providerMode: Exclude<DatabaseProviderMode, "supabase_primary">;
  timeoutMs: number;
};

export type BackendDatabaseOperationOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  cache?: RequestCache;
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
};

const typedBackendDatabase = backendDatabase as unknown as {
  getBackendDatabaseApiConfig(): BackendDatabaseApiConfig;
  callBackendDatabaseOperation<T>(
    operation: string,
    body?: Record<string, unknown>,
    options?: BackendDatabaseOperationOptions,
  ): Promise<T>;
};

export const getBackendDatabaseApiConfig =
  typedBackendDatabase.getBackendDatabaseApiConfig;
export const callBackendDatabaseOperation =
  typedBackendDatabase.callBackendDatabaseOperation;
