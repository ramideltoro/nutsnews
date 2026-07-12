export const RUNTIME_FEATURE_FLAGS = {
  reader_archive_search: {
    defaultValue: true,
    description: "Makes the public footer archive-search API available to readers.",
  },
  worker_public_feed_edge_snapshot_publish: {
    defaultValue: true,
    description:
      "Allows Worker runs to publish the optional Cloudflare KV public-feed snapshot after a successful durable refresh.",
  },
} as const;

export type RuntimeFeatureFlagKey = keyof typeof RUNTIME_FEATURE_FLAGS;

export type RuntimeFeatureFlagState = {
  key: RuntimeFeatureFlagKey;
  enabled: boolean;
  defaultValue: boolean;
  description: string;
  source: "runtime" | "default";
};

type RuntimeFeatureFlagRow = {
  key?: unknown;
  enabled?: unknown;
};

export function isRuntimeFeatureFlagKey(value: string): value is RuntimeFeatureFlagKey {
  return Object.hasOwn(RUNTIME_FEATURE_FLAGS, value);
}

export function resolveRuntimeFeatureFlags(rows: unknown): RuntimeFeatureFlagState[] {
  const enabledByKey = new Map<RuntimeFeatureFlagKey, boolean>();

  if (Array.isArray(rows)) {
    for (const row of rows as RuntimeFeatureFlagRow[]) {
      if (
        typeof row?.key === "string" &&
        isRuntimeFeatureFlagKey(row.key) &&
        typeof row.enabled === "boolean"
      ) {
        enabledByKey.set(row.key, row.enabled);
      }
    }
  }

  return (Object.keys(RUNTIME_FEATURE_FLAGS) as RuntimeFeatureFlagKey[]).map((key) => {
    const definition = RUNTIME_FEATURE_FLAGS[key];
    const enabled = enabledByKey.get(key);

    return {
      key,
      enabled: enabled ?? definition.defaultValue,
      defaultValue: definition.defaultValue,
      description: definition.description,
      source: enabled === undefined ? "default" : "runtime",
    };
  });
}
