import { NextResponse } from "next/server";

import { getPublishedArticles } from "@/lib/articles";
import { logError, logInfo } from "@/lib/logger";

export const revalidate = 300;

const ARTICLE_API_CACHE_CONTROL =
    "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);

  const pageParam = searchParams.get("page") ?? "0";
  const category = searchParams.get("category");
  const page = Number(pageParam);

  await logInfo("api.articles.request_started", "Articles API request started", {
    route: "/api/articles",
    method: "GET",
    page,
    category: category ?? "all",
  });

  try {
    const result = await getPublishedArticles(page, category);

    await logInfo(
        "api.articles.request_completed",
        "Articles API request completed",
        {
          route: "/api/articles",
          method: "GET",
          status: 200,
          page,
          category: category ?? "all",
          articleCount: result.articles.length,
          nextPage: result.nextPage,
          durationMs: Date.now() - startedAt,
        },
    );

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": ARTICLE_API_CACHE_CONTROL,
        "CDN-Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "Vercel-CDN-Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    await logError(
        "api.articles.request_failed",
        "Articles API request failed",
        error,
        {
          route: "/api/articles",
          method: "GET",
          status: 500,
          page,
          category: category ?? "all",
          durationMs: Date.now() - startedAt,
        },
    );

    return NextResponse.json(
        {
          articles: [],
          nextPage: null,
          error: "Failed to load articles",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        },
    );
  }
}