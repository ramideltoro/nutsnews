import { connection } from "next/server";
import { NextResponse } from "next/server";

import { getRuntimePublicConfig } from "@/lib/runtimePublicConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  await connection();

  return NextResponse.json(getRuntimePublicConfig(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
      "X-NutsNews-Cache-Policy": "runtime-public-config-no-store",
    },
  });
}
