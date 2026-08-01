import type { MetadataRoute } from "next";

import {
  getArticleSitemapItemsPage,
  getPublishedArticleSitemapCount,
  SITE_URL,
} from "@/lib/articles";
import {
  getArticleSitemapShardIds,
  parseArticleSitemapShardId,
} from "@/lib/sitemapConfig";


type ArticleSitemapProps = {
  id: Promise<string>;
};

function getSitemapDate(value?: string | null) {
  return new Date(value ?? Date.now());
}

export async function generateSitemaps() {
  const articleCount = await getPublishedArticleSitemapCount();
  const shardIds = getArticleSitemapShardIds(articleCount);

  // Cache Components requires one build-time metadata parameter even when an
  // offline build cannot count published rows. Shard zero is valid and emits
  // an empty sitemap until the data source is reachable.
  return (shardIds.length > 0 ? shardIds : [0]).map((id) => ({ id }));
}

export default async function sitemap({
  id,
}: ArticleSitemapProps): Promise<MetadataRoute.Sitemap> {
  const shardId = parseArticleSitemapShardId(await id);

  if (shardId === null) {
    return [];
  }

  const articles = await getArticleSitemapItemsPage(shardId);

  return articles.map((article) => ({
    url: `${SITE_URL}/articles/${article.id}`,
    lastModified: getSitemapDate(article.published_on_site_at ?? article.published_at),
    changeFrequency: "weekly",
    priority: 0.8,
  }));
}
