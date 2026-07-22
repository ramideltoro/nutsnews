import type { MetadataRoute } from "next";
import { getRecentArticleSitemapItems, SITE_URL } from "@/lib/articles";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getRecentArticleSitemapItems();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const articleRoutes: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${SITE_URL}/articles/${article.id}`,
    lastModified: new Date(
      article.published_on_site_at ?? article.published_at ?? new Date(),
    ),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...articleRoutes];
}
