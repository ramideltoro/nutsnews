import { NextResponse } from "next/server";

import { BYPASS_CACHE_HEADERS } from "@/lib/cacheHeaders";
import { getSafeReadiness } from "@/lib/runtimeSafety";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const readiness = getSafeReadiness();

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
      headers: BYPASS_CACHE_HEADERS,
    },
  );
}
