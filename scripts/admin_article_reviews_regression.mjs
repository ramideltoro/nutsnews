import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const adminReviewLib = readFileSync(
  path.join(repoRoot, "web/lib/adminArticleReviews.ts"),
  "utf8",
);
const adminArticlesPage = readFileSync(
  path.join(repoRoot, "web/app/admin/(protected)/articles/page.tsx"),
  "utf8",
);
const siteFooter = readFileSync(
  path.join(repoRoot, "web/app/components/SiteFooter.tsx"),
  "utf8",
);
const articleFeed = readFileSync(
  path.join(repoRoot, "web/app/components/ArticleFeed.tsx"),
  "utf8",
);

assert.match(
  adminReviewLib,
  /from\("articles"\)[\s\S]*?\.eq\("status", "published"\)[\s\S]*?\.order\("published_on_site_at", \{ ascending: false, nullsFirst: false \}\)[\s\S]*?\.order\("published_at", \{ ascending: false, nullsFirst: false \}\)[\s\S]*?\.limit\(RECENT_PUBLISHED_ARTICLE_LIMIT\)/,
  "Admin articles dashboard must load recent published articles from public.articles ordered by site publish time.",
);

assert.match(
  adminReviewLib,
  /from public\.articles[\s\S]*where status = 'published'[\s\S]*published_on_site_at desc nulls last[\s\S]*published_at desc nulls last/,
  "Dashboard SQL evidence must reproduce the recent published article freshness query.",
);

assert.match(
  adminArticlesPage,
  /Latest Published Articles[\s\S]*Sorted by published_on_site_at/,
  "Admin articles page must expose the latest published article freshness section.",
);

assert.match(
  siteFooter,
  /<Link[\s\S]*href="\/#top"[\s\S]*data-testid="nutsnews-footer-home"[\s\S]*onClick=\{handleHomeClick\}/,
  "Footer home control must have a native /#top fallback so pre-hydration test clicks scroll home.",
);

assert.match(
  readFileSync(path.join(repoRoot, "web/app/page.tsx"), "utf8"),
  /<main[\s\S]*id="top"/,
  "Home page must expose the #top target used by the footer home fallback.",
);

assert.match(
  articleFeed,
  /const initialEnglishArticlesRef = useRef\(initialUniqueArticles\)/,
  "Article feed must retain the initial English article order for language reset stability.",
);

assert.match(
  articleFeed,
  /storedLanguage !== DEFAULT_LANGUAGE_CODE \|\|[\s\S]*initialEnglishArticlesRef\.current\.length === 0[\s\S]*void loadLocalizedHomeFeed\(storedLanguage\)/,
  "Article feed must not force-refresh the initial English feed immediately after hydration.",
);

assert.match(
  articleFeed,
  /if \(nextLanguage === DEFAULT_LANGUAGE_CODE\) \{[\s\S]*setArticles\(initialEnglishArticlesRef\.current\)/,
  "Article feed must restore the initial English feed when switching back to English.",
);

console.log("Admin article freshness regression checks passed.");
