import { NextResponse } from "next/server";

import { getPublishedArticles } from "@/lib/articles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page") ?? "0";
  const category = searchParams.get("category");
  const page = Number(pageParam);

  const result = await getPublishedArticles(page, category);

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}