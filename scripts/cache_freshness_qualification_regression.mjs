#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const runbook = read(".github/deployment/cache-freshness-recovery-runbook.md");
const policies = read("web/lib/cacheHeaders.ts");
const observability = read("web/cache-observability.config.json");
const revalidation = read("web/app/api/internal/cache/revalidate/route.ts");
const targetedPurge = read("scripts/cloudflare_purge_cache.mjs");
const pruner = read("web/scripts/prune-next-image-cache.mjs");

for (const scenario of [
  "Normal publication",
  "Failed invalidation fallback",
  "Edit/removal",
  "Eight-day KV fallback",
  "Origin outage",
  "Image formats",
  "Protected bypass",
]) {
  assert(runbook.includes(`| ${scenario} |`), `Runbook is missing ${scenario} qualification.`);
}

for (const token of ["within two minutes", "two-hour TTL", "70%", "10 GB", "purge_everything"]) {
  assert(runbook.includes(token), `Runbook is missing recovery/alert contract ${token}.`);
}

assert.match(policies, /"NUTSNEWS_PUBLIC_FEED_EDGE_TTL_SECONDS",\s*2 \* HOUR/);
assert.match(policies, /"public-feed":\s*{[\s\S]*?staleIfErrorSeconds:\s*7 \* DAY/);
assert.match(policies, /"NUTSNEWS_PUBLIC_CONTENT_EDGE_TTL_SECONDS",\s*30 \* DAY/);
assert.match(revalidation, /CACHE_REVALIDATION_MAX_AGE_SECONDS/);
assert.match(revalidation, /seenRequestIds/);
assert.match(targetedPurge, /purge-everything-production/);
assert.match(pruner, /MAX_BYTES = 10 \* 1024 \* 1024 \* 1024/);

const configuredRoutes = JSON.parse(observability).routes;
const requiredRouteKeys = new Set([
  "homepage",
  "articles-api",
  "home-feed-api",
  "search-api",
  "article-page",
  "article-api",
  "sitemap",
  "sitemap-index",
  "article-sitemap",
  "optimized-image",
]);
for (const key of requiredRouteKeys) {
  assert(configuredRoutes.some((route) => route.key === key), `Observability is missing ${key}.`);
}

console.log("Cache freshness qualification and recovery regression checks passed.");
