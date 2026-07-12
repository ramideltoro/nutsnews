import { NextResponse } from "next/server";

import { SEARCH_PAGE_SIZE, searchPublishedArticles } from "@/lib/articles";
import { BYPASS_CACHE_HEADERS } from "@/lib/cacheHeaders";
import { normalizeLanguageCode } from "@/lib/languages";
import { logError, logInfoSampled } from "@/lib/logger";
import { isRuntimeFeatureFlagEnabled } from "@/lib/runtimeFeatureFlags";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_SAFE_SEARCH_PAGE = 1000;

const SEARCH_API_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
  "CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  "Cloudflare-CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  "Vercel-CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  "X-NutsNews-Cache-Policy": "public-search-cache-60s",
  "X-NutsNews-Search-Fields": "title,ai_summary,source,category",
} as const;

function cleanSearchQuery(value: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function parsePage(value: string | null) {
  const parsedPage = Number(value ?? "0");

  if (!Number.isFinite(parsedPage) || parsedPage < 0) {
    return 0;
  }

  return Math.min(Math.floor(parsedPage), MAX_SAFE_SEARCH_PAGE);
}

function parseLimit(value: string | null) {
  const parsedLimit = Number(value ?? String(SEARCH_PAGE_SIZE));

  if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
    return SEARCH_PAGE_SIZE;
  }

  return Math.min(Math.floor(parsedLimit), 50);
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);

  const query = cleanSearchQuery(searchParams.get("q"));
  const page = parsePage(searchParams.get("page"));
  const limit = parseLimit(searchParams.get("limit"));
  const languageCode = normalizeLanguageCode(searchParams.get("lang"));

  if (!(await isRuntimeFeatureFlagEnabled("reader_archive_search"))) {
    return NextResponse.json(
      {
        articles: [],
        nextPage: null,
        query,
        page,
        pageSize: limit,
        languageCode,
        error: "Archive search is temporarily unavailable",
      },
      {
        status: 503,
        headers: BYPASS_CACHE_HEADERS,
      },
    );
  }

  try {
    const result = await searchPublishedArticles(query, page, limit, languageCode);

    await logInfoSampled("api.search.request_completed", "Search API request completed", {
      route: "/api/search",
      method: "GET",
      status: 200,
      queryLength: query.length,
      page,
      limit,
      languageCode,
      articleCount: result.articles.length,
      nextPage: result.nextPage,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(result, {
      headers: SEARCH_API_CACHE_HEADERS,
    });
  } catch (error) {
    await logError("api.search.request_failed", "Search API request failed", error, {
      route: "/api/search",
      method: "GET",
      status: 500,
      queryLength: query.length,
      page,
      limit,
      languageCode,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        articles: [],
        nextPage: null,
        query,
        page,
        pageSize: limit,
        languageCode,
        error: "Failed to search articles",
      },
      {
        status: 500,
        headers: BYPASS_CACHE_HEADERS,
      },
    );
  }
}
