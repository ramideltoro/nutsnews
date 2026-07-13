import * as runtimeReadiness from "../runtimeReadiness.mjs";

export type RuntimeReadiness = {
  ready: boolean;
  runtimeEnv: "staging" | "production" | "invalid";
  sideEffectsMode: "disabled" | "sandbox" | "live";
  code: string;
  sourceCommit: string;
  buildId: string;
  deploymentTarget: string;
  expectedImageDigest: string;
  configGeneration: string;
};

type RuntimeReadinessOptions = {
  env?: NodeJS.ProcessEnv;
  readSchemaVersion?: () => Promise<string | null | undefined> | string | null | undefined;
};

const typedRuntimeReadiness = runtimeReadiness as unknown as {
  evaluateRuntimeReadiness(options?: RuntimeReadinessOptions): Promise<RuntimeReadiness>;
  getRuntimeIdentity(env?: NodeJS.ProcessEnv): {
    sourceCommit: string;
    buildId: string;
    deploymentTarget: string;
    expectedImageDigest: string;
    configGeneration: string;
  };
};

export const evaluateRuntimeReadiness = typedRuntimeReadiness.evaluateRuntimeReadiness;
export const getRuntimeIdentity = typedRuntimeReadiness.getRuntimeIdentity;
