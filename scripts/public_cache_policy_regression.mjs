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
    throw new Error(`${label} is missing required cache policy token: ${needle}`);
  }
}

function assertExcludes(content, needle, label) {
  if (content.includes(needle)) {
    throw new Error(`${label} contains forbidden public cache token: ${needle}`);
  }
}

function assertRouteUsesNoStore(config, source, policy) {
  assertIncludes(config, `source: "${source}"`, "next.config.ts");
  assertIncludes(config, `headers: noStoreHeaders("${policy}")`, "next.config.ts");
}

const cacheHeaders = read("web/lib/cacheHeaders.ts");
const nextConfig = read("web/next.config.ts");
const articlesApi = read("web/app/api/articles/route.ts");
const homeFeedApi = read("web/app/api/home-feed/route.ts");
const cacheObservability = read("web/cache-observability.config.json");
const middleware = read("web/middleware.ts");

assertIncludes(cacheHeaders, "DEFAULT_PUBLIC_CDN_S_MAXAGE_SECONDS = 3600", "cacheHeaders.ts");
assertIncludes(
  cacheHeaders,
  "DEFAULT_PUBLIC_CDN_STALE_WHILE_REVALIDATE_SECONDS = 86400",
  "cacheHeaders.ts",
);
assertIncludes(cacheHeaders, "NUTSNEWS_PUBLIC_CDN_S_MAXAGE_SECONDS", "cacheHeaders.ts");
assertIncludes(
  cacheHeaders,
  "NUTSNEWS_PUBLIC_CDN_STALE_WHILE_REVALIDATE_SECONDS",
  "cacheHeaders.ts",
);
assertIncludes(cacheHeaders, '"public, max-age=0, must-revalidate"', "cacheHeaders.ts");
assertIncludes(cacheHeaders, "s-maxage=${PUBLIC_CDN_S_MAXAGE_SECONDS}", "cacheHeaders.ts");
assertIncludes(
  cacheHeaders,
  "stale-while-revalidate=${PUBLIC_CDN_STALE_WHILE_REVALIDATE_SECONDS}",
  "cacheHeaders.ts",
);

for (const header of [
  '"CDN-Cache-Control": PUBLIC_CDN_CACHE_CONTROL',
  '"Cloudflare-CDN-Cache-Control": PUBLIC_CDN_CACHE_CONTROL',
  '"Vercel-CDN-Cache-Control": PUBLIC_CDN_CACHE_CONTROL',
]) {
  assertIncludes(cacheHeaders, header, "cacheHeaders.ts");
}

for (const policy of [
  "public-home-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s",
  "public-article-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s",
  "public-api-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s",
  "public-home-feed-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s",
]) {
  assertIncludes(nextConfig, policy, "next.config.ts");
}

assertIncludes(articlesApi, "public-home-feed-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s", "articles API");
assertIncludes(homeFeedApi, "public-home-feed-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s", "home-feed API");

for (const route of [
  '"/"',
  '"/articles/:path*"',
  '"/api/articles"',
  '"/api/home-feed"',
]) {
  assertIncludes(nextConfig, `source: ${route}`, "next.config.ts");
}

assertRouteUsesNoStore(nextConfig, "/admin/:path*", "bypass-admin-cache");
assertRouteUsesNoStore(nextConfig, "/api/auth/:path*", "bypass-auth-cache");
assertRouteUsesNoStore(nextConfig, "/api/contact", "bypass-contact-api-cache");
assertRouteUsesNoStore(nextConfig, "/monitoring", "bypass-monitoring-cache");
assertRouteUsesNoStore(nextConfig, "/monitoring/:path*", "bypass-monitoring-cache");

assertIncludes(middleware, '"Cloudflare-CDN-Cache-Control": "no-store"', "middleware.ts");
assertIncludes(cacheObservability, '"expectedPolicy": "public-home-cache-3600s"', "cache-observability.config.json");
assertIncludes(cacheObservability, '"expectedPolicy": "public-article-cache-3600s"', "cache-observability.config.json");
assertIncludes(cacheObservability, '"expectedPolicy": "public-api-cache-3600s"', "cache-observability.config.json");
assertIncludes(cacheObservability, '"s-maxage=3600"', "cache-observability.config.json");
assertExcludes(cacheObservability, '"s-maxage=300"', "cache-observability.config.json");

console.log("Public cache policy regression safeguards passed.");
