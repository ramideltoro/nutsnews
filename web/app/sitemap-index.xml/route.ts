import { getPublishedArticleSitemapCount, SITE_URL } from "@/lib/articles";
import {
  ROOT_SITEMAP_PATH,
  getArticleSitemapShardIds,
  getArticleSitemapUrl,
} from "@/lib/sitemapConfig";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildSitemapIndexXml(entries: { loc: string; lastmod: string }[]) {
  const sitemapEntries = entries
    .map(
      (entry) => `  <sitemap>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>
  </sitemap>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>
`;
}

export async function GET() {
  const articleCount = await getPublishedArticleSitemapCount();
  const now = new Date().toISOString();
  const entries = [
    {
      loc: `${SITE_URL}${ROOT_SITEMAP_PATH}`,
      lastmod: now,
    },
    ...getArticleSitemapShardIds(articleCount).map((shardId) => ({
      loc: getArticleSitemapUrl(SITE_URL, shardId),
      lastmod: now,
    })),
  ];

  return new Response(buildSitemapIndexXml(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
