import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  resolveRuntimeFeatureFlags,
  type RuntimeFeatureFlagKey,
  type RuntimeFeatureFlagState,
} from "@/lib/runtimeFeatureFlagDefinitions";

type RuntimeFeatureFlagReader = () => Promise<unknown>;

function getServerSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

async function readRuntimeFeatureFlagRows() {
  const config = getServerSupabaseConfig();

  if (!config) {
    throw new Error("Runtime feature-flag storage is not configured.");
  }

  const client = createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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
