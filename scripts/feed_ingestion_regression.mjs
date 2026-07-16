#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(repoRoot, "tests", "fixtures", "ingestion");

function readFixture(filename) {
  return fs.readFileSync(path.join(fixtureRoot, filename), "utf8");
}

function decodeXmlEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function textFromTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
  return match ? decodeXmlEntities(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()) : "";
}

function enclosureUrl(xml) {
  const match = xml.match(/<enclosure\b[^>]*\burl=(["'])(.*?)\1/i);
  return match ? decodeXmlEntities(match[2].trim()) : "";
}

function parseRssFixture(xml, sourceId) {
  const itemBlocks = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);

  if (itemBlocks.length === 0) {
    throw new Error("feed_parse_failed");
  }

  return itemBlocks.map((item, index) => ({
    sourceId,
    sourceIndex: index,
    title: textFromTag(item, "title"),
    originalUrl: textFromTag(item, "link"),
    publishedAt: textFromTag(item, "pubDate"),
    summary: textFromTag(item, "description"),
    imageUrl: enclosureUrl(item) || null,
  }));
}

function parseApiFixture(json, sourceId) {
  const payload = JSON.parse(json);
  const items = Array.isArray(payload.items) ? payload.items : [];

  return items.map((item, index) => ({
    sourceId,
    sourceIndex: index,
    title: typeof item.title === "string" ? item.title : "",
    originalUrl: typeof item.url === "string" ? item.url : "",
    publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : "",
    summary: typeof item.summary === "string" ? item.summary : "",
    imageUrl: typeof item.imageUrl === "string" && item.imageUrl.trim() ? item.imageUrl : null,
  }));
}

function canonicalArticleUrl(value) {
  const parsed = new URL(value);

  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_")) {
      parsed.searchParams.delete(key);
    }
  }

  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  return parsed.toString();
}

function normalizeCandidate(candidate) {
  const errors = [];
  const warnings = [];
  const title = candidate.title.trim().replace(/\s+/g, " ");
  const summary = candidate.summary.trim().replace(/\s+/g, " ");
  let originalUrl = "";
  let publishedOnSiteAt = "";

  if (!title) {
    errors.push("missing_title");
  }

  try {
    originalUrl = canonicalArticleUrl(candidate.originalUrl.trim());
  } catch {
    errors.push("invalid_original_url");
  }

  const parsedDate = Date.parse(candidate.publishedAt);
  if (Number.isNaN(parsedDate)) {
    errors.push("invalid_published_at");
  } else {
    publishedOnSiteAt = new Date(parsedDate).toISOString();
  }

  if (!candidate.imageUrl) {
    warnings.push("missing_image");
  }

  if (errors.length > 0) {
    return {
      accepted: false,
      sourceId: candidate.sourceId,
      sourceIndex: candidate.sourceIndex,
      errors,
    };
  }

  return {
    accepted: true,
    article: {
      source: candidate.sourceId,
      title,
      original_url: originalUrl,
      image_url: candidate.imageUrl,
      published_on_site_at: publishedOnSiteAt,
      ai_summary: summary || null,
      ingestion_warnings: warnings,
    },
  };
}

function ingestSources(sources) {
  const accepted = [];
  const rejected = [];
  const sourceFailures = [];
  const seenCanonicalUrls = new Set();

  for (const source of sources) {
    let candidates;
    try {
      candidates = source.read();
    } catch {
      sourceFailures.push({
        sourceId: source.id,
        code: "feed_parse_failed",
      });
      continue;
    }

    for (const candidate of candidates) {
      const normalized = normalizeCandidate(candidate);

      if (!normalized.accepted) {
        rejected.push(normalized);
        continue;
      }

      const articleKey = normalized.article.original_url;
      if (seenCanonicalUrls.has(articleKey)) {
        rejected.push({
          accepted: false,
          sourceId: candidate.sourceId,
          sourceIndex: candidate.sourceIndex,
          errors: ["duplicate_original_url"],
        });
        continue;
      }

      seenCanonicalUrls.add(articleKey);
      accepted.push(normalized.article);
    }
  }

  return { accepted, rejected, sourceFailures };
}

const report = ingestSources([
  {
    id: "rss-good",
    read: () => parseRssFixture(readFixture("good-feed.xml"), "rss-good"),
  },
  {
    id: "rss-bad",
    read: () => parseRssFixture(readFixture("bad-feed.xml"), "rss-bad"),
  },
  {
    id: "api-good-with-duplicates",
    read: () => parseApiFixture(readFixture("api-feed.json"), "api-good-with-duplicates"),
  },
]);

assert.deepEqual(
  report.accepted.map((article) => article.original_url),
  [
    "https://publisher.example/community-garden",
    "https://publisher.example/weather-sensors",
    "https://api-publisher.example/tool-library",
  ],
  "Accepted fixture articles must be deterministic and canonicalized.",
);

assert.deepEqual(
  report.accepted.map((article) => article.image_url),
  [
    "https://cdn.publisher.example/community-garden.jpg",
    null,
    "https://api-publisher.example/tool-library.jpg",
  ],
  "Image handling must preserve valid images and represent missing images as null.",
);

assert.deepEqual(
  report.accepted[1].ingestion_warnings,
  ["missing_image"],
  "Missing images must be visible as stable warnings without rejecting otherwise valid rows.",
);

assert.deepEqual(
  report.rejected.map((entry) => ({
    sourceId: entry.sourceId,
    sourceIndex: entry.sourceIndex,
    errors: entry.errors,
  })),
  [
    {
      sourceId: "api-good-with-duplicates",
      sourceIndex: 0,
      errors: ["duplicate_original_url"],
    },
    {
      sourceId: "api-good-with-duplicates",
      sourceIndex: 2,
      errors: ["missing_title"],
    },
    {
      sourceId: "api-good-with-duplicates",
      sourceIndex: 3,
      errors: ["invalid_published_at"],
    },
  ],
  "Rejected fixture rows must have stable source IDs, item indexes, and error codes.",
);

assert.deepEqual(
  report.sourceFailures,
  [{ sourceId: "rss-bad", code: "feed_parse_failed" }],
  "Malformed feed source failures must be reported without blocking unrelated valid sources.",
);

assert(!JSON.stringify(report).includes("Broken item without a safe ending"), "Malformed source output must not include raw feed bodies.");
assert(!JSON.stringify(report).includes("Thursday-ish"), "Rejected row output must not include malformed date values.");

const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "web", "package.json"), "utf8"));
assert.equal(
  packageJson.scripts?.["test:feed-ingestion"],
  "node ../scripts/feed_ingestion_regression.mjs",
  "web/package.json must expose the feed ingestion regression test.",
);

console.log("Feed ingestion regression checks passed.");
