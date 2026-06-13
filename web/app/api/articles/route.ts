import { NextResponse } from "next/server";

import { getPublishedArticles } from "@/lib/articles";

export const revalidate = 300;

const ARTICLE_API_CACHE_CONTROL =
    "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const pageParam = searchParams.get("page") ?? "0";
  const category = searchParams.get("category");
  const page = Number(pageParam);

  const result = await getPublishedArticles(page, category);

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": ARTICLE_API_CACHE_CONTROL,
      "CDN-Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "Vercel-CDN-Cache-Control":
          "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}