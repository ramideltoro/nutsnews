#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function articleIdentityKey(article) {
  const id = article.id?.trim();

  if (id) {
    return `id:${id}`;
  }

  const originalUrl = article.original_url?.trim();

  if (originalUrl) {
    return `url:${originalUrl}`;
  }

  const title = article.title?.trim();
  const source = article.source?.trim();
  const publishedAt =
    article.published_on_site_at?.trim() ?? article.published_at?.trim();

  if (title && (source || publishedAt)) {
    return `fallback:${source ?? ""}|${publishedAt ?? ""}|${title}`;
  }

  return null;
}

function dedupeArticles(articles) {
  const seenArticleKeys = new Set();
  const uniqueArticles = [];

  for (const article of articles) {
    const articleKey = articleIdentityKey(article);

    if (articleKey) {
      if (seenArticleKeys.has(articleKey)) {
        continue;
      }

      seenArticleKeys.add(articleKey);
    }

    uniqueArticles.push(article);
  }

  return uniqueArticles;
}

function dedupePageSections(sections, pageArticles) {
  const seenArticleKeys = new Set(
    pageArticles.map(articleIdentityKey).filter(Boolean),
  );

  return sections.map((section) => {
    const uniqueArticles = [];

    for (const article of section.articles) {
      const articleKey = articleIdentityKey(article);

      if (articleKey && seenArticleKeys.has(articleKey)) {
        continue;
      }

      uniqueArticles.push(article);

      if (articleKey) {
        seenArticleKeys.add(articleKey);
      }
    }

    return {
      ...section,
      articles: uniqueArticles,
    };
  });
}

function backfillEmptySections(sections, pageArticles, backfillsBySection) {
  const seenArticleKeys = new Set(
    pageArticles.map(articleIdentityKey).filter(Boolean),
  );

  for (const section of sections) {
    for (const article of section.articles) {
      const articleKey = articleIdentityKey(article);

      if (articleKey) {
        seenArticleKeys.add(articleKey);
      }
    }
  }

  return sections.map((section) => {
    if (section.articles.length > 0) {
      return section;
    }

    const uniqueArticles = [];

    for (const article of backfillsBySection.get(section.id) ?? []) {
      const articleKey = articleIdentityKey(article);

      if (articleKey && seenArticleKeys.has(articleKey)) {
        continue;
      }

      uniqueArticles.push(article);

      if (articleKey) {
        seenArticleKeys.add(articleKey);
      }
    }

    return { ...section, articles: uniqueArticles };
  });
}

const multiCategoryArticle = {
  id: "story-1",
  original_url: "https://publisher.example/story-1",
  source: "Publisher",
  title: "Community garden restores a park",
  published_on_site_at: "2026-07-04T00:00:00Z",
  published_at: "2026-07-03T00:00:00Z",
  category: "Community | Wellness",
};
const sameUrlWithoutId = {
  id: "",
  original_url: "https://publisher.example/story-2",
  source: "Publisher",
  title: "A school celebrates science",
  published_on_site_at: "2026-07-04T01:00:00Z",
};
const sameUrlDuplicate = {
  ...sameUrlWithoutId,
  title: "A localized school celebrates science",
};
const similarTitleDifferentArticle = {
  id: "story-3",
  original_url: "https://publisher.example/story-3",
  source: "Publisher",
  title: "A school celebrates science",
  published_on_site_at: "2026-07-04T02:00:00Z",
};

assert.deepEqual(
  dedupeArticles([
    multiCategoryArticle,
    { ...multiCategoryArticle, category: "Wellness | Community" },
    sameUrlWithoutId,
    sameUrlDuplicate,
    similarTitleDifferentArticle,
  ]).map((article) => article.original_url),
  [
    "https://publisher.example/story-1",
    "https://publisher.example/story-2",
    "https://publisher.example/story-3",
  ],
  "Dedupe must prefer id, fall back to original_url, and keep legitimate different articles with similar titles.",
);

const animalArticleOutsideGlobalSnapshotScan = {
  id: "animal-story-1",
  original_url: "https://publisher.example/animal-story-1",
  source: "Publisher",
  title: "Volunteers reunite a lost dog with its family",
  published_on_site_at: "2026-07-04T03:00:00Z",
  category: "Animals | Uplifting",
};

assert.deepEqual(
  backfillEmptySections(
    [
      { id: "community", articles: [multiCategoryArticle] },
      { id: "animals", articles: [] },
    ],
    [sameUrlWithoutId],
    new Map([
      [
        "animals",
        [
          sameUrlDuplicate,
          animalArticleOutsideGlobalSnapshotScan,
        ],
      ],
    ]),
  ).map((section) => ({ id: section.id, articleIds: section.articles.map((article) => article.id) })),
  [
    { id: "community", articleIds: ["story-1"] },
    { id: "animals", articleIds: ["animal-story-1"] },
  ],
  "An empty category must be backfilled from its filtered snapshot query without duplicating a story already on the page.",
);

const dedupedSections = dedupePageSections(
  [
    { id: "community", articles: [multiCategoryArticle] },
    {
      id: "wellness",
      articles: [
        { ...multiCategoryArticle, category: "Wellness | Community" },
        similarTitleDifferentArticle,
      ],
    },
  ],
  [multiCategoryArticle],
);

assert.deepEqual(
  dedupedSections.map((section) => section.articles.map((article) => article.id)),
  [[], ["story-3"]],
  "A multi-category article already rendered on the page must not render again in another section.",
);

const articleIdentity = read("web/lib/articleIdentity.ts");
const articleFeed = read("web/app/components/ArticleFeed.tsx");
const articlesLib = read("web/lib/articles.ts");
const edgeFeedSnapshot = read("web/lib/edgeFeedSnapshot.ts");
const siteFooter = read("web/app/components/SiteFooter.tsx");
const packageJson = JSON.parse(read("web/package.json"));

assert.match(
  articleIdentity,
  /if \(id\) \{[\s\S]*return `id:\$\{id\}`;/,
  "Article identity must use article id first.",
);
assert.match(
  articleIdentity,
  /if \(originalUrl\) \{[\s\S]*return `url:\$\{originalUrl\}`;/,
  "Article identity must fall back to original_url.",
);
assert.doesNotMatch(
  articleIdentity,
  /return `title:/,
  "Article identity must not dedupe by title alone.",
);

assert.match(
  articleFeed,
  /dedupeCategorySectionsForPage\([\s\S]*pageArticles[\s\S]*seenArticleKeys/,
  "ArticleFeed must dedupe category sections against articles already rendered on the page.",
);
assert.match(
  articleFeed,
  /dedupeArticlesByIdentity\(\[\.\.\.currentArticles, \.\.\.data\.articles\]\)/,
  "ArticleFeed infinite scroll must not append duplicate articles.",
);
assert.match(
  articleFeed,
  /const uniqueArticles = dedupeArticlesByIdentity\(data\.articles\);[\s\S]*dedupeCategorySectionsForPage\(data\.sections, uniqueArticles\)/,
  "ArticleFeed localized/home reloads must dedupe API articles and sections before rendering.",
);

assert.match(
  articlesLib,
  /const uniqueRows = dedupeArticlesByIdentity\(rows\);/,
  "Article API shaping must dedupe duplicate source rows before returning articles.",
);
assert.match(
  articlesLib,
  /const seenArticleKeys = new Set\([\s\S]*mainBaseArticles[\s\S]*getArticleIdentityKey/,
  "Homepage data assembly must track articles already used in the main feed.",
);
assert.match(
  articlesLib,
  /if \(articleKey && seenArticleKeys\.has\(articleKey\)\) \{[\s\S]*continue;/,
  "Homepage category sections must skip articles already rendered elsewhere on the page.",
);
assert.match(
  articlesLib,
  /async function backfillEmptyHomeFeedSections\([\s\S]*emptySectionIds\.size === 0/,
  "Homepage assembly must avoid additional category reads when every bounded snapshot section is populated.",
);
assert.match(
  articlesLib,
  /getPublishedArticlesForSection\(section\.query, requestedLanguageCode\)/,
  "An empty homepage category must be backfilled by its filtered snapshot query.",
);
assert.match(
  articlesLib,
  /const completedSections = await backfillEmptyHomeFeedSections\([\s\S]*sections: completedSections\.map/,
  "Homepage output must render the backfilled category sections.",
);

assert.match(
  edgeFeedSnapshot,
  /dedupeArticlesByIdentity\(articles\)\.map/,
  "Cloudflare edge fallback articles must be deduped before returning.",
);
assert.match(
  edgeFeedSnapshot,
  /const uniqueSections = sections\.map/,
  "Cloudflare edge fallback home sections must be deduped against the main feed.",
);

assert.match(
  siteFooter,
  /dedupeArticlesByIdentity\(data\.articles\)/,
  "Footer search must dedupe first-page API results.",
);
assert.match(
  siteFooter,
  /dedupeArticlesByIdentity\(\[\.\.\.currentArticles, \.\.\.data\.articles\]\)/,
  "Footer search pagination must not append duplicate articles.",
);

assert.equal(
  packageJson.scripts?.["test:article-dedupe"],
  "node ../scripts/article_dedupe_regression.mjs",
  "web/package.json must expose the article dedupe regression test.",
);

console.log("Article dedupe regression checks passed.");
