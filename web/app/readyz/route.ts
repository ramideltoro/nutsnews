import { connection, NextResponse } from "next/server";

import { BYPASS_CACHE_HEADERS } from "@/lib/cacheHeaders";
import { evaluateRuntimeReadiness } from "@/lib/runtimeReadiness";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readSchemaVersion() {
  const { data, error } = await getSupabase()
    .from("release_readiness")
    .select("schema_version")
    .eq("singleton", true)
    .maybeSingle();

  if (error || !data || typeof data.schema_version !== "string") {
    throw new Error("Readiness schema dependency is unavailable.");
  }

  return data.schema_version;
}

export async function GET() {
  await connection();

  const readiness = await evaluateRuntimeReadiness({ readSchemaVersion });

  return NextResponse.json(
    {
      ok: readiness.ready,
      service: "nutsnews-web",
      runtimeEnv: readiness.runtimeEnv,
      sideEffectsMode: readiness.sideEffectsMode,
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
        "X-NutsNews-Config-Generation": readiness.configGeneration,
        "X-NutsNews-Expected-Image-Digest": readiness.expectedImageDigest,
      },
    },
  );
}
