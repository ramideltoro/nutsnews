export const ROOT_SITEMAP_RECENT_ARTICLE_LIMIT = 100;
export const ARTICLE_SITEMAP_PAGE_SIZE = 1000;
export const MAX_ARTICLE_SITEMAP_SHARDS = 50;
export const ROOT_SITEMAP_PATH = "/sitemap.xml";
export const SITEMAP_INDEX_PATH = "/sitemap-index.xml";

export function getArticleSitemapShardIds(articleCount: number) {
  if (!Number.isFinite(articleCount) || articleCount <= 0) {
    return [];
  }

  const shardCount = Math.min(
    Math.ceil(articleCount / ARTICLE_SITEMAP_PAGE_SIZE),
    MAX_ARTICLE_SITEMAP_SHARDS,
  );

  return Array.from({ length: shardCount }, (_value, index) => index);
}

export function parseArticleSitemapShardId(value: string | number) {
  const numericValue = Number(value);

  if (
    !Number.isInteger(numericValue) ||
    numericValue < 0 ||
    numericValue >= MAX_ARTICLE_SITEMAP_SHARDS
  ) {
    return null;
  }

  return numericValue;
}

export function getArticleSitemapRange(shardId: number) {
  return {
    from: shardId * ARTICLE_SITEMAP_PAGE_SIZE,
    to: shardId * ARTICLE_SITEMAP_PAGE_SIZE + ARTICLE_SITEMAP_PAGE_SIZE - 1,
  };
}

export function getArticleSitemapUrl(siteUrl: string, shardId: number) {
  return `${siteUrl}/articles/sitemap/${shardId}.xml`;
}
