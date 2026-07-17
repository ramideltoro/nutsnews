import { NextResponse } from "next/server";

import {
  ARTICLE_API_CACHE_HEADERS,
  PUBLIC_CDN_S_MAXAGE_SECONDS,
} from "@/lib/cacheHeaders";
import {
  createMaintenanceHomeFeedPayload,
  getHomeFeedDataWithEdgeFallback,
} from "@/lib/edgeFeedSnapshot";
import type { FeedDegradationStatus } from "@/lib/articles";
import { normalizeLanguageCode } from "@/lib/languages";
import { logError, logInfoSampled, logWarn } from "@/lib/logger";

export const revalidate = 900;

function buildHomeFeedHeaders(degradation?: FeedDegradationStatus | null) {
  const headers: Record<string, string> = {
    ...ARTICLE_API_CACHE_HEADERS,
    "X-NutsNews-Cache-Policy": `public-home-feed-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s`,
  };

  if (degradation) {
    headers["X-NutsNews-Degradation-Mode"] = degradation.mode;
    headers["X-NutsNews-Degradation-Reason"] = degradation.reason;
  }

  return headers;
}

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
      headers: buildHomeFeedHeaders(result.degradation),
    });
  } catch (error) {
    await logError("api.home_feed.request_failed", "Home feed API request failed", error, {
      route: "/api/home-feed",
      method: "GET",
      status: 500,
      languageCode,
      durationMs: Date.now() - startedAt,
    });

    const result = createMaintenanceHomeFeedPayload(languageCode, {
      reason: "home_feed_exception",
    });

    await logWarn(
      "api.home_feed.maintenance_returned",
      "Home feed API returned a maintenance payload after all feed sources failed.",
      {
        route: "/api/home-feed",
        method: "GET",
        status: 200,
        languageCode,
        degradationMode: result.degradation?.mode ?? null,
        degradationReason: result.degradation?.reason ?? null,
        durationMs: Date.now() - startedAt,
      },
    );

    return NextResponse.json(result, {
      status: 200,
      headers: buildHomeFeedHeaders(result.degradation),
    });
  }
}
