export type RuntimeEnvironment = "staging" | "production" | "invalid";
export type SideEffectsMode = "disabled" | "sandbox" | "live";

export interface RuntimeSafetyPolicy {
  ready: boolean;
  runtimeEnv: RuntimeEnvironment;
  sideEffectsMode: SideEffectsMode;
  dataEnvironment: RuntimeEnvironment;
  credentialsEnvironment: RuntimeEnvironment;
  code: string;
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
  code: string;
}>;
export function assertDataRead(operation?: string, env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function assertProductionOperation(operation?: string, env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function assertDataMutation(operation?: string, env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function assertIsolatedDataMutation(operation?: string, env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function assertSyntheticFixtureMutation(namespace: string, env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function assertSyntheticTestUser(namespace: string, env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function isSandboxEndpoint(endpoint: string): boolean;
export function assertExternalSideEffect(operation: string, endpoint: string, env?: NodeJS.ProcessEnv): RuntimeSafetyPolicy;
export function isTelemetryDeliveryAllowed(env?: NodeJS.ProcessEnv): boolean;
export function isProductionLiveRuntime(env?: NodeJS.ProcessEnv): boolean;
