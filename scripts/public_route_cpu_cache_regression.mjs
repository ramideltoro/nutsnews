#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const requireText = (content, token, label) => {
  if (!content.includes(token)) throw new Error(`${label} is missing ${token}`);
};

const articlePage = read("web/app/articles/[id]/page.tsx");
const articleOgImage = read("web/app/articles/[id]/opengraph-image.tsx");
const articles = read("web/lib/articles.ts");
const publicCachedData = read("web/lib/publicCachedData.ts");
const nextConfig = read("web/next.config.ts");
const packageJson = JSON.parse(read("web/package.json"));

requireText(articlePage, "generateStaticParams", "article page");
requireText(articlePage, "getRecentArticleSitemapItems(100)", "article page");
requireText(articlePage, 'const socialImageUrl = "/opengraph-image"', "article page");
requireText(articleOgImage, "Positive news", "article OG image");
requireText(articles, '"use cache"', "article data");
requireText(articles, "cacheTag(articleCacheTag(id))", "article data");
requireText(articles, "revalidate: 2_592_000", "article data");
requireText(publicCachedData, "revalidate: 7_200", "public feed data");
requireText(nextConfig, "cacheComponents: true", "next.config.ts");

if (packageJson.scripts?.["test:public-route-cpu-cache"] !== "node ../scripts/public_route_cpu_cache_regression.mjs") {
  throw new Error("package.json is missing test:public-route-cpu-cache script");
}

console.log("Public route CPU cache regression safeguards passed.");
