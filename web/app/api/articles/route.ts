import { NextResponse } from "next/server";

import {
  getPublishedArticlesByCursor,
  PAGE_SIZE,
  type PublishedArticlesResult,
} from "@/lib/articles";
import {
  getEdgeFeedSnapshotPage,
  getPublishedArticlesWithEdgeFallback,
} from "@/lib/edgeFeedSnapshot";
import { normalizeLanguageCode } from "@/lib/languages";
import { ARTICLE_API_CACHE_HEADERS, BYPASS_CACHE_HEADERS } from "@/lib/cacheHeaders";
import { logError, logInfo } from "@/lib/logger";

export const revalidate = 300;

const MAX_SAFE_OFFSET_PAGE = 1000;

function buildArticleApiHeaders({
  result,
  paginationMode,
  languageCode,
}: {
  result: PublishedArticlesResult;
  paginationMode: string;
  languageCode: string;
}) {
  const feedSnapshotStatus =
    result.dataSource === "public_feed_snapshot"
      ? "hit"
      : result.dataSource === "edge_feed_snapshot"
        ? "edge-fallback"
        : "fallback";

  const headers: Record<string, string> = {
    ...ARTICLE_API_CACHE_HEADERS,
    "X-NutsNews-Article-Page-Size": String(PAGE_SIZE),
    "X-NutsNews-Article-Pagination": paginationMode,
    "X-NutsNews-Article-Fields": "card",
    "X-NutsNews-Article-Language": languageCode,
    "X-NutsNews-Article-Data-Source": result.dataSource,
    "X-NutsNews-Feed-Snapshot": feedSnapshotStatus,
    "X-NutsNews-Edge-Snapshot": result.edgeSnapshot?.status ?? "not-used",
  };

  if (result.edgeSnapshot?.updatedAt) {
    headers["X-NutsNews-Edge-Snapshot-Updated-At"] = result.edgeSnapshot.updatedAt;
  }

  if (typeof result.edgeSnapshot?.ageSeconds === "number") {
    headers["X-NutsNews-Edge-Snapshot-Age-Seconds"] = String(result.edgeSnapshot.ageSeconds);
  }

  if (typeof result.edgeSnapshot?.articleCount === "number") {
    headers["X-NutsNews-Edge-Snapshot-Article-Count"] = String(result.edgeSnapshot.articleCount);
  }

  if (typeof result.edgeSnapshot?.version === "number") {
    headers["X-NutsNews-Edge-Snapshot-Version"] = String(result.edgeSnapshot.version);
  }

  return headers;
}

function parsePage(value: string | null) {
  const parsedPage = Number(value ?? "0");

  if (!Number.isFinite(parsedPage) || parsedPage < 0) {
    return 0;
  }

  return Math.min(Math.floor(parsedPage), MAX_SAFE_OFFSET_PAGE);
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);

  const page = parsePage(searchParams.get("page"));
  const cursor = searchParams.get("cursor");
  const category = searchParams.get("category");
  const languageCode = normalizeLanguageCode(searchParams.get("lang"));
  const paginationMode = cursor ? "cursor" : "offset";

  await logInfo("api.articles.request_started", "Articles API request started", {
    route: "/api/articles",
    method: "GET",
    page,
    hasCursor: Boolean(cursor),
    paginationMode,
    pageSize: PAGE_SIZE,
    category: category ?? "all",
    languageCode,
  });

  try {
    const result = cursor
      ? await getPublishedArticlesByCursor(cursor, category, languageCode)
      : await getPublishedArticlesWithEdgeFallback(page, category, languageCode);

    await logInfo(
      "api.articles.request_completed",
      "Articles API request completed",
      {
        route: "/api/articles",
        method: "GET",
        status: 200,
        page,
        hasCursor: Boolean(cursor),
        paginationMode,
        pageSize: PAGE_SIZE,
        category: category ?? "all",
        languageCode,
        articleCount: result.articles.length,
        nextPage: result.nextPage,
        hasNextCursor: Boolean(result.nextCursor),
        dataSource: result.dataSource,
        durationMs: Date.now() - startedAt,
      },
    );

    return NextResponse.json(result, {
      headers: buildArticleApiHeaders({
        result,
        paginationMode,
        languageCode,
      }),
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
        hasCursor: Boolean(cursor),
        paginationMode,
        pageSize: PAGE_SIZE,
        category: category ?? "all",
        languageCode,
        durationMs: Date.now() - startedAt,
      },
    );

    if (!cursor) {
      const edgeResult = await getEdgeFeedSnapshotPage({
        page,
        category,
        requestedLanguageCode: languageCode,
      });

      if (edgeResult) {
        await logInfo(
          "api.articles.edge_snapshot_recovered",
          "Articles API recovered from Cloudflare edge feed snapshot",
          {
            route: "/api/articles",
            method: "GET",
            status: 200,
            page,
            paginationMode,
            pageSize: PAGE_SIZE,
            category: category ?? "all",
            languageCode,
            articleCount: edgeResult.articles.length,
            nextPage: edgeResult.nextPage,
            dataSource: edgeResult.dataSource,
            edgeSnapshotAgeSeconds: edgeResult.edgeSnapshot?.ageSeconds ?? null,
            durationMs: Date.now() - startedAt,
          },
        );

        return NextResponse.json(edgeResult, {
          headers: buildArticleApiHeaders({
            result: edgeResult,
            paginationMode,
            languageCode,
          }),
        });
      }
    }

    return NextResponse.json(
      {
        articles: [],
        nextPage: null,
        nextCursor: null,
        error: "Failed to load articles",
      },
      {
        status: 500,
        headers: BYPASS_CACHE_HEADERS,
      },
    );
  }
}
