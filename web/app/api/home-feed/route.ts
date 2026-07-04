import { NextResponse } from "next/server";

import {
  ARTICLE_API_CACHE_HEADERS,
  BYPASS_CACHE_HEADERS,
  PUBLIC_CDN_S_MAXAGE_SECONDS,
} from "@/lib/cacheHeaders";
import { getHomeFeedDataWithEdgeFallback } from "@/lib/edgeFeedSnapshot";
import { normalizeLanguageCode } from "@/lib/languages";
import { logError, logInfoSampled } from "@/lib/logger";

export const revalidate = 900;

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const languageCode = normalizeLanguageCode(searchParams.get("lang"));

  try {
    const result = await getHomeFeedDataWithEdgeFallback(languageCode);

    await logInfoSampled("api.home_feed.request_completed", "Home feed API request completed", {
      route: "/api/home-feed",
      method: "GET",
      status: 200,
      languageCode,
      articleCount: result.articles.length,
      sectionCount: result.sections.length,
      dataSource: result.dataSource,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(result, {
      headers: {
        ...ARTICLE_API_CACHE_HEADERS,
        "X-NutsNews-Cache-Policy": `public-home-feed-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s`,
      },
    });
  } catch (error) {
    await logError("api.home_feed.request_failed", "Home feed API request failed", error, {
      route: "/api/home-feed",
      method: "GET",
      status: 500,
      languageCode,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        articles: [],
        nextPage: null,
        nextCursor: null,
        sections: [],
        error: "Failed to load home feed",
      },
      { status: 500, headers: BYPASS_CACHE_HEADERS },
    );
  }
}
