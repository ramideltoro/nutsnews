import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/articles";
import { ROOT_SITEMAP_PATH, SITEMAP_INDEX_PATH } from "@/lib/sitemapConfig";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: [`${SITE_URL}${SITEMAP_INDEX_PATH}`, `${SITE_URL}${ROOT_SITEMAP_PATH}`],
  };
}
