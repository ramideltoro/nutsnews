import { NextResponse } from "next/server";

import { BYPASS_CACHE_HEADERS } from "@/lib/cacheHeaders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "nutsnews",
    },
    {
      status: 200,
      headers: BYPASS_CACHE_HEADERS,
    },
  );
}
