#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(content, needle, label) {
  assert(
    content.includes(needle),
    `${label} is missing required source-policy text: ${needle}`,
  );
}

const policySql = read("supabase/rss_source_policy.sql");
const migration = read(
  "supabase/migrations/20260717032000_keep_google_news_discovery_only.sql",
);
const migrationContract = read("web/migrationContract.mjs");
const feedHealthReport = read("scripts/feed_health_report.mjs");
const containerWorkflow = read(".github/workflows/container-image.yml");
const packageJson = JSON.parse(read("web/package.json"));

for (const required of [
  "Google News RSS is discovery-only",
  "active_google_feeds",
  "news.google.com",
  "update public.rss_feeds",
  "set is_active = false",
]) {
  assertIncludes(policySql, required, "supabase/rss_source_policy.sql");
}

for (const required of [
  "rss_feeds_google_news_discovery_only_check",
  "news.google.com",
  "is_active = false",
  "validate constraint rss_feeds_google_news_discovery_only_check",
  "Google News RSS URLs may be stored for discovery only",
  "select public.nutsnews_record_migration_head('20260717032000');",
]) {
  assertIncludes(
    migration,
    required,
    "20260717032000_keep_google_news_discovery_only.sql",
  );
}

assertIncludes(
  migrationContract,
  'MIGRATION_HEAD = "20260717103000"',
  "web/migrationContract.mjs",
);
assertIncludes(
  containerWorkflow,
  '"migration_head":"20260717103000"',
  ".github/workflows/container-image.yml",
);
assertIncludes(feedHealthReport, "activeGoogleFeedCount", "feed_health_report.mjs");
assertIncludes(feedHealthReport, "Active Google News RSS feeds", "feed_health_report.mjs");

assert.equal(
  packageJson.scripts?.["test:rss-source-policy"],
  "node ../scripts/rss_source_policy_regression.mjs",
  "web/package.json must expose test:rss-source-policy",
);

console.log("RSS source policy regression checks passed.");
