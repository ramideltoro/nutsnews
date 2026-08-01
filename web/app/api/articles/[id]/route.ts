import { NextResponse } from "next/server";

import { getArticleById, type Article } from "@/lib/articles";
import {
  BYPASS_CACHE_HEADERS,
  getPublicCacheHeaders,
} from "@/lib/cacheHeaders";
import { articleCacheTag } from "@/lib/cacheTags";
import { normalizeLanguageCode } from "@/lib/languages";
import { logError, logInfoSampled } from "@/lib/logger";

type ArticleDetailRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function buildArticleDetailHeaders(articleId: string, article: Article, languageCode: string) {
  return {
    ...getPublicCacheHeaders("public-article", {
      cacheTags: [articleCacheTag(articleId)],
    }),
    "X-NutsNews-Article-Fields": "detail",
    "X-NutsNews-Article-Language": languageCode,
    "X-NutsNews-Article-Resolved-Language": article.language_code ?? "en",
    "X-NutsNews-Article-Translation-Available": String(article.translation_available === true),
  };
}

export async function GET(request: Request, { params }: ArticleDetailRouteContext) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const languageCode = normalizeLanguageCode(searchParams.get("lang"));
  const { id } = await params;
  const articleId = id.trim();

  if (!articleId) {
    return NextResponse.json(
      { error: "Article not found" },
      {
        status: 404,
        headers: BYPASS_CACHE_HEADERS,
      },
    );
  }

  try {
    const article = await getArticleById(articleId, languageCode);

    if (!article) {
      return NextResponse.json(
        { error: "Article not found" },
        {
          status: 404,
          headers: BYPASS_CACHE_HEADERS,
        },
      );
    }

    await logInfoSampled(
      "api.article_detail.request_completed",
      "Article detail API request completed",
      {
        route: "/api/articles/[id]",
        method: "GET",
        status: 200,
        articleId,
        languageCode,
        resolvedLanguageCode: article.language_code ?? null,
        translationAvailable: article.translation_available ?? null,
        durationMs: Date.now() - startedAt,
      },
    );

    return NextResponse.json(article, {
      headers: buildArticleDetailHeaders(articleId, article, languageCode),
    });
  } catch (error) {
    await logError(
      "api.article_detail.request_failed",
      "Article detail API request failed",
      error,
      {
        route: "/api/articles/[id]",
        method: "GET",
        status: 500,
        articleId,
        languageCode,
        durationMs: Date.now() - startedAt,
      },
    );

    return NextResponse.json(
      { error: "Failed to load article" },
      {
        status: 500,
        headers: BYPASS_CACHE_HEADERS,
      },
    );
  }
}
