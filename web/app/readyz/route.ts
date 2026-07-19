import { connection, NextResponse } from "next/server";

import { BYPASS_CACHE_HEADERS } from "@/lib/cacheHeaders";
import { evaluateRuntimeReadiness } from "@/lib/runtimeReadiness";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readSchemaContract() {
  const { data, error } = await getSupabase().rpc("nutsnews_migration_schema_contract");

  const contract = Array.isArray(data) ? data[0] : data;
  if (!contract || typeof contract !== "object") {
    throw new Error("Readiness schema dependency is unavailable.");
  }

  const row = contract as Record<string, unknown>;
  if (
    error ||
    typeof row.legacy_schema_version !== "string" ||
    typeof row.migration_head !== "string" ||
    typeof row.expected_schema_fingerprint !== "string" ||
    typeof row.actual_schema_fingerprint !== "string"
  ) {
    throw new Error("Readiness schema dependency is unavailable.");
  }

  return {
    legacySchemaVersion: row.legacy_schema_version,
    migrationHead: row.migration_head,
    expectedSchemaFingerprint: row.expected_schema_fingerprint,
    actualSchemaFingerprint: row.actual_schema_fingerprint,
  };
}

export async function GET() {
  await connection();

  const readiness = await evaluateRuntimeReadiness({ readSchemaContract });

  return NextResponse.json(
    {
      ok: readiness.ready,
      service: "nutsnews-web",
      runtimeEnv: readiness.runtimeEnv,
      sideEffectsMode: readiness.sideEffectsMode,
      databaseProviderMode: readiness.databaseProviderMode,
      productionWritesPaused: readiness.productionWritesPaused,
      code: readiness.code,
    },
    {
      status: readiness.ready ? 200 : 503,
      headers: {
        ...BYPASS_CACHE_HEADERS,
        "X-NutsNews-Source-Commit": readiness.sourceCommit,
        "X-NutsNews-Build-Id": readiness.buildId,
        "X-NutsNews-Deployment-Target": readiness.deploymentTarget,
        "X-NutsNews-Runtime-Environment": readiness.runtimeEnv,
        "X-NutsNews-Database-Provider-Mode": readiness.databaseProviderMode,
        "X-NutsNews-Production-Writes-Paused": String(readiness.productionWritesPaused),
        "X-NutsNews-Config-Generation": readiness.configGeneration,
        "X-NutsNews-Expected-Image-Digest": readiness.expectedImageDigest,
      },
    },
  );
}
