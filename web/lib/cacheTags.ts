export const PUBLIC_FEED_CACHE_TAG = "public-feed";
export const SITE_SHELL_CACHE_TAG = "site-shell";

const ARTICLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export function normalizeArticleIdForCache(articleId: string) {
  const normalized = articleId.trim();

  if (!ARTICLE_ID_PATTERN.test(normalized)) {
    throw new Error("Article ID is not safe for a cache tag");
  }

  return normalized;
}

export function articleCacheTag(articleId: string) {
  return `article:${normalizeArticleIdForCache(articleId)}`;
}

export function isAllowlistedCacheTag(tag: string) {
  return (
    tag === PUBLIC_FEED_CACHE_TAG ||
    tag === SITE_SHELL_CACHE_TAG ||
    (tag.startsWith("article:") && ARTICLE_ID_PATTERN.test(tag.slice("article:".length)))
  );
}
