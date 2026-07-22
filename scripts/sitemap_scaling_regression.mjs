#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(content, needle, label) {
  assert(content.includes(needle), `${label} is missing required token: ${needle}`);
}

function assertExcludes(content, needle, label) {
  assert(!content.includes(needle), `${label} contains forbidden token: ${needle}`);
}

const sitemapConfig = read("web/lib/sitemapConfig.ts");
const rootSitemap = read("web/app/sitemap.ts");
const articleSitemap = read("web/app/articles/sitemap.ts");
const sitemapIndex = read("web/app/sitemap-index.xml/route.ts");
const robots = read("web/app/robots.ts");
const seoAudit = read("web/scripts/seo-structured-data-audit.mjs");
const sitemapRobotsCheck = read("scripts/check_sitemap_robots.mjs");
const nextConfig = read("web/next.config.ts");
const packageJson = JSON.parse(read("web/package.json"));

assertIncludes(sitemapConfig, "ROOT_SITEMAP_RECENT_ARTICLE_LIMIT = 100", "sitemapConfig.ts");
assertIncludes(sitemapConfig, "ARTICLE_SITEMAP_PAGE_SIZE = 1000", "sitemapConfig.ts");
assertIncludes(sitemapConfig, "MAX_ARTICLE_SITEMAP_SHARDS = 50", "sitemapConfig.ts");
assertIncludes(sitemapConfig, "getArticleSitemapShardIds", "sitemapConfig.ts");
assertIncludes(sitemapConfig, "getArticleSitemapRange", "sitemapConfig.ts");
assertIncludes(sitemapConfig, "numericValue >= MAX_ARTICLE_SITEMAP_SHARDS", "sitemapConfig.ts");

assertIncludes(rootSitemap, "ROOT_SITEMAP_RECENT_ARTICLE_LIMIT", "app/sitemap.ts");
assertIncludes(rootSitemap, 'export const dynamic = "force-dynamic"', "app/sitemap.ts");
assertIncludes(
  rootSitemap,
  "getRecentArticleSitemapItems(ROOT_SITEMAP_RECENT_ARTICLE_LIMIT)",
  "app/sitemap.ts",
);
assertExcludes(rootSitemap, "getRecentArticleSitemapItems(1000)", "app/sitemap.ts");

assertIncludes(articleSitemap, "export async function generateSitemaps()", "app/articles/sitemap.ts");
assertIncludes(articleSitemap, 'export const dynamic = "force-dynamic"', "app/articles/sitemap.ts");
assertIncludes(articleSitemap, "id: Promise<string>", "app/articles/sitemap.ts");
assertIncludes(articleSitemap, "getPublishedArticleSitemapCount", "app/articles/sitemap.ts");
assertIncludes(articleSitemap, "getArticleSitemapItemsPage(shardId)", "app/articles/sitemap.ts");

assertIncludes(sitemapIndex, "buildSitemapIndexXml", "app/sitemap-index.xml/route.ts");
assertIncludes(sitemapIndex, 'export const dynamic = "force-dynamic"', "app/sitemap-index.xml/route.ts");
assertIncludes(sitemapIndex, "<sitemapindex", "app/sitemap-index.xml/route.ts");
assertIncludes(sitemapIndex, "getArticleSitemapShardIds(articleCount)", "app/sitemap-index.xml/route.ts");
assertIncludes(sitemapIndex, "getArticleSitemapUrl(SITE_URL, shardId)", "app/sitemap-index.xml/route.ts");

assertIncludes(robots, "SITEMAP_INDEX_PATH", "app/robots.ts");
assertIncludes(robots, "ROOT_SITEMAP_PATH", "app/robots.ts");

assertIncludes(seoAudit, "MAX_SITEMAP_FETCHES = 25", "seo-structured-data-audit.mjs");
assertIncludes(seoAudit, "function isSitemapIndex", "seo-structured-data-audit.mjs");
assertIncludes(seoAudit, "async function collectSitemapUrls", "seo-structured-data-audit.mjs");
assertIncludes(seoAudit, "`${baseUrl}/sitemap-index.xml`", "seo-structured-data-audit.mjs");

assertIncludes(sitemapRobotsCheck, "/sitemap-index.xml", "check_sitemap_robots.mjs");
assertIncludes(sitemapRobotsCheck, "/articles/sitemap/", "check_sitemap_robots.mjs");

assertIncludes(nextConfig, 'source: "/sitemap-index.xml"', "next.config.ts");
assertIncludes(nextConfig, 'source: "/articles/sitemap/:path*"', "next.config.ts");
assertIncludes(nextConfig, "public-sitemap-index-cache-3600s", "next.config.ts");
assertIncludes(nextConfig, "public-article-sitemap-cache-3600s", "next.config.ts");

assert.equal(
  packageJson.scripts?.["test:sitemap-scaling"],
  "node ../scripts/sitemap_scaling_regression.mjs",
  "web/package.json must expose the sitemap scaling regression.",
);

console.log("Sitemap scaling regression safeguards passed.");
