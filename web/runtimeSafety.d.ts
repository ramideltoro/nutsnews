export type RuntimeEnvironment = "staging" | "production" | "invalid";
export type SideEffectsMode = "disabled" | "sandbox" | "live";
export type DatabaseProviderMode =
  | "supabase_primary"
  | "backend_postgres_shadow"
  | "backend_postgres_primary"
  | "invalid";

export interface RuntimeSafetyPolicy {
  ready: boolean;
  runtimeEnv: RuntimeEnvironment;
  sideEffectsMode: SideEffectsMode;
  dataEnvironment: RuntimeEnvironment;
  credentialsEnvironment: RuntimeEnvironment;
  databaseProviderMode: DatabaseProviderMode;
  productionWritesPaused: boolean;
  code: string;
}

export interface OAuthCallbackRequestIdentity {
  url: string;
  host: string;
  forwardedProto: string;
}

export class RuntimeSafetyError extends Error {
  code: string;
}

export function getRuntimeSafetyPolicy(env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function assertRuntimeReady(env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function getSafeReadiness(env?: NodeJS.ProcessEnv): Readonly<{
  ready: boolean;
  runtimeEnv: RuntimeEnvironment;
  sideEffectsMode: SideEffectsMode;
  databaseProviderMode: DatabaseProviderMode;
  productionWritesPaused: boolean;
  code: string;
}>;
export function assertDataRead(operation?: string, env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function assertProductionOperation(operation?: string, env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function assertOAuthCallback(
  operation?: string,
  requestIdentity?: string | OAuthCallbackRequestIdentity,
  env?: NodeJS.ProcessEnv,
): RuntimeSafetyPolicy;
export function assertDataMutation(operation?: string, env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function assertIsolatedDataMutation(operation?: string, env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function assertSyntheticFixtureMutation(namespace: string, env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function assertSyntheticTestUser(namespace: string, env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function isSandboxEndpoint(endpoint: string): boolean;
export function assertExternalSideEffect(operation: string, endpoint: string, env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function isTelemetryDeliveryAllowed(env?: NodeJS.ProcessEnv): boolean;
export function isProductionLiveRuntime(env?: NodeJS.ProcessEnv): boolean;
