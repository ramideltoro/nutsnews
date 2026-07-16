import type { MetadataRoute } from "next";

import { getRecentArticleSitemapItems, SITE_URL } from "@/lib/articles";
import { ROOT_SITEMAP_RECENT_ARTICLE_LIMIT } from "@/lib/sitemapConfig";

export const revalidate = 3600;

function getSitemapDate(value?: string | null) {
  return new Date(value ?? Date.now());
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getRecentArticleSitemapItems(ROOT_SITEMAP_RECENT_ARTICLE_LIMIT);
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/apps`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  const articleRoutes: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${SITE_URL}/articles/${article.id}`,
    lastModified: getSitemapDate(article.published_on_site_at ?? article.published_at),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...articleRoutes];
}
