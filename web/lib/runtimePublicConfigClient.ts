"use client";

import { useEffect, useState } from "react";

export type RuntimePublicConfig = {
  runtimeEnv: "staging" | "production" | "unknown";
  sideEffectsMode: "disabled" | "sandbox" | "live";
  databaseProviderMode:
    | "supabase_primary"
    | "backend_postgres_shadow"
    | "backend_postgres_primary"
    | "invalid";
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  turnstileSiteKey: string | null;
  sentryDsn: string | null;
  gaId: string | null;
  iosAppStoreUrl: string | null;
  sourceCommit: string;
  buildId: string;
  deploymentTarget: string;
  expectedImageDigest: string;
  configGeneration: string;
  telemetryEnabled: boolean;
};

let pendingConfig: Promise<RuntimePublicConfig> | null = null;

export function loadRuntimePublicConfig() {
  if (!pendingConfig) {
    pendingConfig = fetch("/api/runtime-config", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Runtime configuration returned HTTP ${response.status}`);
      }

      return (await response.json()) as RuntimePublicConfig;
    });
  }

  return pendingConfig;
}

export function useRuntimePublicConfig() {
  const [config, setConfig] = useState<RuntimePublicConfig | null>(null);

  useEffect(() => {
    let active = true;

    void loadRuntimePublicConfig()
      .then((runtimeConfig) => {
        if (active) {
          setConfig(runtimeConfig);
        }
      })
      .catch(() => {
        if (active) {
          setConfig(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return config;
}
