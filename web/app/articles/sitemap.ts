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

export const revalidate = 3600;
export const dynamic = "force-dynamic";

type ArticleSitemapProps = {
  id: Promise<string>;
};

function getSitemapDate(value?: string | null) {
  return new Date(value ?? Date.now());
}

export async function generateSitemaps() {
  const articleCount = await getPublishedArticleSitemapCount();
  return getArticleSitemapShardIds(articleCount).map((id) => ({ id }));
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
