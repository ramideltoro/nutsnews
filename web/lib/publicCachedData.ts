import { cacheLife, cacheTag } from "next/cache";

import {
  getPublishedArticlesByCursor,
  searchPublishedArticles,
} from "@/lib/articles";
import {
  getHomeFeedDataWithEdgeFallback,
  getPublishedArticlesWithEdgeFallback,
} from "@/lib/edgeFeedSnapshot";
import { PUBLIC_FEED_CACHE_TAG } from "@/lib/cacheTags";

export async function getCachedHomeFeedData(
  requestedLanguageCode?: string | null,
) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 7_200, expire: 604_800 });
  cacheTag(PUBLIC_FEED_CACHE_TAG);
  return getHomeFeedDataWithEdgeFallback(requestedLanguageCode);
}

export async function getCachedPublishedArticles(
  page = 0,
  category?: string | null,
  requestedLanguageCode?: string | null,
) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 7_200, expire: 604_800 });
  cacheTag(PUBLIC_FEED_CACHE_TAG);
  return getPublishedArticlesWithEdgeFallback(page, category, requestedLanguageCode);
}

export async function getCachedPublishedArticlesByCursor(
  cursor?: string | null,
  category?: string | null,
  requestedLanguageCode?: string | null,
) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 7_200, expire: 604_800 });
  cacheTag(PUBLIC_FEED_CACHE_TAG);
  return getPublishedArticlesByCursor(cursor, category, requestedLanguageCode);
}

export async function getCachedSearchResults(
  query: string,
  page: number,
  pageSize: number,
  requestedLanguageCode?: string | null,
) {
  // searchPublishedArticles owns the six-hour cache entry. This wrapper gives
  // route callers a stable seam and keeps raw database search private.
  return searchPublishedArticles(query, page, pageSize, requestedLanguageCode);
}
