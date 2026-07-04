#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const helperPath = path.join(repoRoot, "web", "lib", "fallbackThumbnails.ts");
const imagePath = path.join(repoRoot, "web", "app", "components", "OptimizedArticleImage.tsx");
const feedPath = path.join(repoRoot, "web", "app", "components", "ArticleFeed.tsx");
const footerPath = path.join(repoRoot, "web", "app", "components", "SiteFooter.tsx");
const adminArticlesPath = path.join(repoRoot, "web", "app", "admin", "(protected)", "articles", "page.tsx");

const files = {
  helper: fs.readFileSync(helperPath, "utf8"),
  image: fs.readFileSync(imagePath, "utf8"),
  feed: fs.readFileSync(feedPath, "utf8"),
  footer: fs.readFileSync(footerPath, "utf8"),
  adminArticles: fs.readFileSync(adminArticlesPath, "utf8"),
};

function assert(condition, message, details = undefined) {
  if (!condition) {
    const error = new Error(message);
    if (details !== undefined) {
      error.details = details;
    }
    throw error;
  }
}

function assertIncludes(source, needle, message) {
  assert(source.includes(needle), message, { needle });
}

try {
  console.log("▶ Checking category fallback thumbnail mappings");
  for (const id of [
    "community",
    "animals",
    "science",
    "wellness",
    "travel",
    "culture",
    "achievements",
    "uplifting",
  ]) {
    assertIncludes(files.helper, `${id}: {`, `Missing fallback thumbnail mapping for ${id}.`);
  }
  assertIncludes(files.helper, "Non-photographic", "Fallback labels must state that they are not article photos.");
  assertIncludes(files.helper, "getFallbackThumbnailVisual", "Fallback selection helper is missing.");
  console.log("✓ Category mappings are centralized");

  console.log("▶ Checking public thumbnail rendering uses the centralized fallback");
  assertIncludes(files.image, "data-fallback-thumbnail", "Fallback component must expose stable fallback IDs for regression coverage.");
  assertIncludes(files.image, "No article image", "Fallback visual must clearly say when no article image is available.");
  assertIncludes(files.feed, "category={article.category}", "Homepage/category cards must pass article category to fallback thumbnails.");
  assertIncludes(files.footer, "<OptimizedArticleImage", "Footer search cards must use the centralized image/fallback component.");
  assertIncludes(files.footer, "category={article.category}", "Footer search fallback must be category-aware.");
  console.log("✓ Reader-facing cards use centralized category-aware fallbacks");

  console.log("▶ Checking admin no-image publication warning");
  assertIncludes(files.adminArticles, "Published without a thumbnail", "Admin review cards must warn about published rows without thumbnails.");
  assertIncludes(files.adminArticles, "Missing thumbnail", "Published article cards must flag missing thumbnails.");
  console.log("✓ Admin dashboard flags accidental no-image publication risk");

  console.log("\n✅ Fallback thumbnail regression passed.");
} catch (error) {
  console.error("\n❌ Fallback thumbnail regression failed.");
  console.error(error?.stack || error?.message || error);
  if (error?.details !== undefined) {
    console.error(JSON.stringify(error.details, null, 2));
  }
  process.exitCode = 1;
}
