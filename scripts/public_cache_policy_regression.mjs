#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const requireText = (content, token, label) => {
  if (!content.includes(token)) throw new Error(`${label} is missing ${token}`);
};

const cacheHeaders = read("web/lib/cacheHeaders.ts");
const cacheTags = read("web/lib/cacheTags.ts");
const nextConfig = read("web/next.config.ts");
const publicCachedData = read("web/lib/publicCachedData.ts");
const articles = read("web/lib/articles.ts");
const revalidation = read("web/app/api/internal/cache/revalidate/route.ts");
const middleware = read("web/middleware.ts");
const observability = read("web/cache-observability.config.json");
const observabilityCli = read("web/scripts/cache-observability.mjs");

for (const token of [
  '"public-feed"',
  '"public-article"',
  '"public-static-page"',
  '"public-search"',
  '"public-sitemap"',
  "2 * HOUR",
  "30 * DAY",
  "6 * HOUR",
  "staleIfErrorSeconds: 7 * DAY",
  '"public, max-age=0, must-revalidate"',
  '"Cloudflare-CDN-Cache-Control"',
  '"X-NutsNews-Cache-Policy"',
]) requireText(cacheHeaders, token, "cacheHeaders.ts");

for (const token of ["PUBLIC_FEED_CACHE_TAG", "SITE_SHELL_CACHE_TAG", "articleCacheTag", "isAllowlistedCacheTag"]) {
  requireText(cacheTags, token, "cacheTags.ts");
}

for (const token of [
  "cacheComponents: true",
  'publicCacheHeaders("public-feed"',
  'publicCacheHeaders("public-article"',
  'publicCacheHeaders("public-static-page"',
  'publicCacheHeaders("public-search"',
  'publicCacheHeaders("public-sitemap"',
  'source: "/apps"',
  'source: "/saved"',
  'source: "/_next/image"',
  'source: "/api/internal/:path*"',
]) requireText(nextConfig, token, "next.config.ts");

requireText(publicCachedData, 'cacheTag(PUBLIC_FEED_CACHE_TAG)', "publicCachedData.ts");
requireText(publicCachedData, "revalidate: 7_200", "publicCachedData.ts");
requireText(articles, "revalidate: 2_592_000", "articles.ts");
requireText(articles, "revalidate: 21_600", "articles.ts");
requireText(revalidation, "verifyCacheRevalidationSignature", "revalidation route");
requireText(revalidation, "seenRequestIds", "revalidation route");
requireText(revalidation, "revalidateTag(tag, { expire: 0 })", "revalidation route");
requireText(middleware, 'response.headers.set(', "middleware.ts");
requireText(middleware, '"Cache-Tag"', "middleware.ts");

for (const policy of [
  "public-feed-cache-7200s",
  "public-article-cache-2592000s",
  "public-static-page-cache-2592000s",
  "public-search-cache-21600s",
  "public-sitemap-cache-7200s",
]) requireText(observability, policy, "cache observability config");
requireText(observability, '"requireCloudflareCacheable": true', "cache observability config");
requireText(observabilityCli, "route.requireCloudflareCacheable", "cache observability CLI");

console.log("Public cache policy regression safeguards passed.");
