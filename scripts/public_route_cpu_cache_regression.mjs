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
    throw new Error(`${label} is missing required public CPU cache token: ${needle}`);
  }
}

function assertExcludes(content, needle, label) {
  if (content.includes(needle)) {
    throw new Error(`${label} reintroduced public CPU cache regression token: ${needle}`);
  }
}

const articlePage = read("web/app/articles/[id]/page.tsx");
const articleOgImage = read("web/app/articles/[id]/opengraph-image.tsx");
const cacheHeaders = read("web/lib/cacheHeaders.ts");
const nextConfig = read("web/next.config.ts");
const packageJson = JSON.parse(read("web/package.json"));

assertIncludes(articlePage, "export const revalidate = 3600", "article page");
assertIncludes(articlePage, "generateStaticParams", "article page");
assertIncludes(articlePage, "getRecentArticleSitemapItems(100)", "article page");
assertIncludes(articlePage, 'const socialImageUrl = "/opengraph-image"', "article page");
assertExcludes(articlePage, "searchParams", "article page");
assertExcludes(articlePage, "/opengraph-image`", "article page");

assertIncludes(articleOgImage, "export const revalidate = 3600", "article OG image");
assertIncludes(articleOgImage, "Positive news", "article OG image");
assertExcludes(articleOgImage, "getArticleById", "article OG image");

assertIncludes(cacheHeaders, "ARTICLE_API_BROWSER_CACHE_CONTROL", "cacheHeaders.ts");
assertIncludes(cacheHeaders, '"public, s-maxage=300, stale-while-revalidate=3600"', "cacheHeaders.ts");
assertIncludes(nextConfig, "ARTICLE_API_BROWSER_CACHE_CONTROL", "next.config.ts");

if (packageJson.scripts?.["test:public-route-cpu-cache"] !== "node ../scripts/public_route_cpu_cache_regression.mjs") {
  throw new Error("package.json is missing test:public-route-cpu-cache script");
}

console.log("Public route CPU cache regression safeguards passed.");
