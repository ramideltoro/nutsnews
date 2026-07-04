#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label} is missing required CPU safeguard: ${needle}`);
  }
}

function assertExcludes(content, needle, label) {
  if (content.includes(needle)) {
    throw new Error(`${label} reintroduced forbidden CPU regression token: ${needle}`);
  }
}

const articleFeed = read("web/app/components/ArticleFeed.tsx");
const homepage = read("web/app/page.tsx");
const articles = read("web/lib/articles.ts");
const articlesApi = read("web/app/api/articles/route.ts");
const articlePage = read("web/app/articles/[id]/page.tsx");
const articleOgImage = read("web/app/articles/[id]/opengraph-image.tsx");
const siteOgImage = read("web/app/opengraph-image.tsx");
const homeFeedApi = read("web/app/api/home-feed/route.ts");
const healthz = read("web/app/healthz/route.ts");
const searchApi = read("web/app/api/search/route.ts");
const cacheHeaders = read("web/lib/cacheHeaders.ts");
const logger = read("web/lib/logger.ts");
const middleware = read("web/middleware.ts");
const nextConfig = read("web/next.config.ts");

for (const forbidden of [
  'query.set("_", String(Date.now()))',
  'cache: forceFresh ? "no-store" : "default"',
  'forceFresh: true',
]) {
  assertExcludes(articleFeed, forbidden, "ArticleFeed.tsx");
}

assertIncludes(articleFeed, "/api/home-feed?", "ArticleFeed.tsx");
assertExcludes(articleFeed, "loadCategorySections", "ArticleFeed.tsx");
assertIncludes(homepage, "getHomeFeedDataWithEdgeFallback", "homepage");
assertExcludes(homepage, "categorySections.map", "homepage");
assertIncludes(homepage, "export const revalidate = 900", "homepage");

assertIncludes(articles, "HOME_FEED_SNAPSHOT_SCAN_LIMIT = 250", "articles.ts");
assertIncludes(articles, "CURSOR_PAGE_SIZE = 15", "articles.ts");
assertIncludes(articles, "getHomeFeedFromSnapshot", "articles.ts");
assertIncludes(articles, ".limit(HOME_FEED_SNAPSHOT_SCAN_LIMIT)", "articles.ts");
assertIncludes(articles, "pageSize: CURSOR_PAGE_SIZE", "articles.ts");
assertIncludes(articles, "unstable_cache", "articles.ts");
assertIncludes(articles, "published-article-by-id", "articles.ts");
assertIncludes(articles, "revalidate: 3600", "articles.ts");

assertIncludes(cacheHeaders, "s-maxage=${PUBLIC_CDN_S_MAXAGE_SECONDS}", "cacheHeaders.ts");
assertIncludes(homeFeedApi, "export const revalidate = 900", "home-feed API");
assertIncludes(articlesApi, "export const revalidate = 900", "articles API");
assertIncludes(articlePage, "export const revalidate = 3600", "article page");
assertIncludes(articlePage, "generateStaticParams", "article page");
assertIncludes(articleOgImage, "export const revalidate = 3600", "article OG image");
assertIncludes(siteOgImage, "export const revalidate = 3600", "site OG image");
assertExcludes(articleOgImage, 'runtime = "edge"', "article OG image");
assertExcludes(siteOgImage, 'runtime = "edge"', "site OG image");
assertIncludes(healthz, 'dynamic = "force-static"', "healthz route");
assertIncludes(healthz, "public-healthz-cache-60s", "healthz route");

assertExcludes(articlesApi, "request_started", "articles API");
assertExcludes(searchApi, "request_started", "search API");
assertIncludes(articlesApi, "logInfoSampled", "articles API");
assertIncludes(searchApi, "logInfoSampled", "search API");
assertIncludes(logger, "DEFAULT_INFO_SAMPLE_RATE = 0.05", "logger.ts");
assertIncludes(logger, "shouldSampleInfoEvent", "logger.ts");

assertIncludes(nextConfig, 'source: "/:path*"', "next.config.ts");
assertIncludes(nextConfig, "GLOBAL_SECURITY_HEADERS", "next.config.ts");
assertIncludes(nextConfig, "public-home-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s", "next.config.ts");
assertIncludes(nextConfig, "public-privacy-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s", "next.config.ts");
assertIncludes(middleware, '"/admin/:path*"', "middleware.ts");
assertExcludes(middleware, '"/api/', "middleware.ts");
assertExcludes(middleware, '"/monitoring', "middleware.ts");
assertExcludes(nextConfig, 'tunnelRoute: "/monitoring"', "next.config.ts");
assertExcludes(middleware, 'matcher: ["/((?!_next/static', "middleware.ts");

console.log("Fluid Active CPU regression safeguards passed.");
