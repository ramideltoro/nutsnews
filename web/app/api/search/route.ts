import { NextResponse } from "next/server";

import { SEARCH_PAGE_SIZE } from "@/lib/articles";
import { BYPASS_CACHE_HEADERS, getPublicCacheHeaders } from "@/lib/cacheHeaders";
import { PUBLIC_FEED_CACHE_TAG } from "@/lib/cacheTags";
import { normalizeLanguageCode } from "@/lib/languages";
import { logError, logInfoSampled } from "@/lib/logger";
import { isRuntimeFeatureFlagEnabled } from "@/lib/runtimeFeatureFlags";
import { getCachedSearchResults } from "@/lib/publicCachedData";

const MAX_SAFE_SEARCH_PAGE = 100;
const ALLOWED_SEARCH_LIMITS = [10, SEARCH_PAGE_SIZE, 50] as const;

const SEARCH_API_CACHE_HEADERS = {
  ...getPublicCacheHeaders("public-search", { cacheTags: [PUBLIC_FEED_CACHE_TAG] }),
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

  const boundedLimit = Math.min(Math.floor(parsedLimit), 50);
  return ALLOWED_SEARCH_LIMITS.reduce((closest, candidate) =>
    Math.abs(candidate - boundedLimit) < Math.abs(closest - boundedLimit)
      ? candidate
      : closest,
  SEARCH_PAGE_SIZE);
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
    const result = await getCachedSearchResults(query, page, limit, languageCode);

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
