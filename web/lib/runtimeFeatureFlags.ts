import "server-only";

import { getServerSupabase } from "@/lib/supabase";

import {
  resolveRuntimeFeatureFlags,
  type RuntimeFeatureFlagKey,
  type RuntimeFeatureFlagState,
} from "@/lib/runtimeFeatureFlagDefinitions";

type RuntimeFeatureFlagReader = () => Promise<unknown>;

async function readRuntimeFeatureFlagRows() {
  const client = getServerSupabase();
  const { data, error } = await client
    .from("runtime_feature_flags")
    .select("key, enabled");

  if (error) {
    throw error;
  }

  return data;
}

export async function getRuntimeFeatureFlags(
  readRows: RuntimeFeatureFlagReader = readRuntimeFeatureFlagRows,
): Promise<RuntimeFeatureFlagState[]> {
  try {
    return resolveRuntimeFeatureFlags(await readRows());
  } catch {
    return resolveRuntimeFeatureFlags([]);
  }
}

export async function isRuntimeFeatureFlagEnabled(
  key: RuntimeFeatureFlagKey,
  readRows?: RuntimeFeatureFlagReader,
): Promise<boolean> {
  const flags = await getRuntimeFeatureFlags(readRows);
  return flags.find((flag) => flag.key === key)?.enabled ?? false;
}
