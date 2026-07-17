#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(source, expected, filePath) {
  assert.ok(
    source.includes(expected),
    `${filePath} must include ${JSON.stringify(expected)}.`,
  );
}

function assertExcludes(source, unexpected, filePath) {
  assert.ok(
    !source.toLowerCase().includes(unexpected.toLowerCase()),
    `${filePath} must not include ${JSON.stringify(unexpected)}.`,
  );
}

const migration = read(
  "supabase/migrations/20260717113000_add_article_engagement_analytics.sql",
);
const migrationContract = read("web/migrationContract.mjs");
const containerWorkflow = read(".github/workflows/container-image.yml");
const apiRoute = read("web/app/api/engagement/route.ts");
const serverHelper = read("web/lib/articleEngagement.ts");
const clientHelper = read("web/lib/engagementAnalytics.ts");
const articleFeed = read("web/app/components/ArticleFeed.tsx");
const adminLib = read("web/lib/adminArticleEngagement.ts");
const adminPage = read("web/app/admin/(protected)/engagement/page.tsx");
const adminHome = read("web/app/admin/(protected)/page.tsx");
const privacyPolicy = read("web/app/privacy/LocalizedPrivacyPolicyPage.tsx");
const packageJson = read("web/package.json");

for (const expected of [
  "create table if not exists public.article_engagement_daily",
  "event_type in ('outbound_click', 'category_interest')",
  "enable row level security",
  "grant select, insert, update on public.article_engagement_daily to service_role",
  "create or replace function public.record_article_engagement_event",
  "security definer",
  "create or replace view public.article_engagement_source_category_summary",
  "create or replace view public.article_engagement_article_summary",
  "grant select on public.article_engagement_source_category_summary to service_role",
  "grant select on public.article_engagement_article_summary to service_role",
  "select public.nutsnews_record_migration_head('20260717113000');",
]) {
  assertIncludes(migration, expected, "20260717113000_add_article_engagement_analytics.sql");
}

for (const expected of [
  "assertIsolatedDataMutation(\"article-engagement-event\")",
  "record_article_engagement_event",
  "RuntimeSafetyError",
  "runtime_disabled",
]) {
  assertIncludes(serverHelper, expected, "web/lib/articleEngagement.ts");
}

for (const expected of [
  "MAX_REQUEST_BYTES = 2_048",
  "normalizeEventType",
  "UUID_PATTERN",
  "isAllowedOrigin",
  "recordArticleEngagementEvent",
  "BYPASS_CACHE_HEADERS",
]) {
  assertIncludes(apiRoute, expected, "web/app/api/engagement/route.ts");
}

for (const unexpected of [
  "user-agent",
  "x-forwarded-for",
  "cf-connecting-ip",
  "x-real-ip",
  "referer",
  "referrer",
  "cookie",
  "raw_url",
]) {
  assertExcludes(apiRoute, unexpected, "web/app/api/engagement/route.ts");
}

for (const expected of [
  "browserRequestsAnalyticsOptOut",
  "getAnalyticsConsentState() === \"granted\"",
  "navigator.sendBeacon",
  "keepalive: true",
  "eventType: \"outbound_click\"",
  "eventType: \"category_interest\"",
]) {
  assertIncludes(clientHelper, expected, "web/lib/engagementAnalytics.ts");
}

for (const expected of [
  "recordArticleOutboundClick",
  "onClick={handleArticleClick}",
]) {
  assertIncludes(articleFeed, expected, "web/app/components/ArticleFeed.tsx");
}

for (const expected of [
  "article_engagement_source_category_summary",
  "article_engagement_article_summary",
  "topSources",
  "topCategories",
  "topArticles",
  "sourceCategorySql",
]) {
  assertIncludes(adminLib, expected, "web/lib/adminArticleEngagement.ts");
}

for (const expected of [
  "Article Engagement",
  "Aggregate outbound clicks and category interest",
  "Privacy scope: aggregate counters only",
  "data.sourceCategorySql",
  "data.articleSql",
]) {
  assertIncludes(adminPage, expected, "web/app/admin/(protected)/engagement/page.tsx");
}

for (const expected of [
  "Article Engagement",
  "/admin/engagement",
  "privacy-friendly aggregate outbound clicks",
]) {
  assertIncludes(adminHome, expected, "web/app/admin/(protected)/page.tsx");
}

for (const expected of [
  "first-party aggregate counters",
  "outbound article clicks and category interest",
  "event type, article ID, source, and category",
  "raw URLs, article titles, referrers, IP addresses, user agents, cookies, or visitor identifiers",
  "NutsNews does not define custom analytics events for likes, saved stories, searches, personal profiles, or cross-device tracking.",
]) {
  assertIncludes(privacyPolicy, expected, "web/app/privacy/LocalizedPrivacyPolicyPage.tsx");
}

assertIncludes(
  migrationContract,
  'MIGRATION_HEAD = "20260717113000"',
  "web/migrationContract.mjs",
);
assertIncludes(
  containerWorkflow,
  '"migration_head":"20260717113000"',
  ".github/workflows/container-image.yml",
);
assertIncludes(
  packageJson,
  '"test:article-engagement-analytics": "node ../scripts/article_engagement_analytics_regression.mjs"',
  "web/package.json",
);

console.log("Article engagement analytics regression checks passed.");
