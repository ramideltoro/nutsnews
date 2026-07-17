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
    `${label} is missing required source-trust text: ${needle}`,
  );
}

const migration = read("supabase/migrations/20260717093000_add_source_trust_tiers.sql");
const migrationContract = read("web/migrationContract.mjs");
const containerWorkflow = read(".github/workflows/container-image.yml");
const feedManagement = read("web/lib/adminFeedManagement.ts");
const feedsPage = read("web/app/admin/(protected)/feeds/page.tsx");
const auditLog = read("web/lib/adminAuditLog.ts");
const adminHome = read("web/app/admin/(protected)/page.tsx");
const packageJson = JSON.parse(read("web/package.json"));

for (const required of [
  "source_trust_tier text not null default 'experimental'",
  "publisher_allowlist_status text not null default 'candidate'",
  "rss_feeds_source_trust_tier_check",
  "trusted', 'watchlist', 'experimental', 'disabled'",
  "rss_feeds_publisher_allowlist_status_check",
  "allowlisted', 'candidate', 'blocked'",
  "rss_feeds_disabled_tier_inactive_check",
  "create or replace view public.feed_quality_scores",
  "recommended_trust_tier",
  "tier_recommendation_reason",
  "create or replace function public.set_rss_feed_trust_tier_with_audit",
  "rss_feed.trust_tier_update",
  "set_source_trust_tier",
  "select public.nutsnews_record_migration_head('20260717093000');",
]) {
  assertIncludes(migration, required, "source trust migration");
}

for (const required of [
  "source_trust_tier",
  "publisher_allowlist_status",
  "recommended_trust_tier",
  "tier_recommendation_reason",
  "SourceTrustTier",
  "PublisherAllowlistStatus",
  "/rest/v1/rpc/set_rss_feed_trust_tier_with_audit",
  "p_source_trust_tier",
  "p_publisher_allowlist_status",
]) {
  assertIncludes(feedManagement, required, "adminFeedManagement.ts");
}

for (const required of [
  "updateTrustTierAction",
  "setAdminRssFeedTrustTier",
  "SourceTrustPill",
  "PublisherAllowlistPill",
  "SourceTrustTierForm",
  "Tier recommendation",
  "revalidatePath(\"/admin/audit\")",
]) {
  assertIncludes(feedsPage, required, "admin feeds page");
}

assertIncludes(auditLog, "RSS source trust tier updated", "adminAuditLog.ts");
assertIncludes(adminHome, "source trust tiers", "admin home");
assertIncludes(migrationContract, 'MIGRATION_HEAD = "20260717103000"', "web/migrationContract.mjs");
assertIncludes(containerWorkflow, '"migration_head":"20260717103000"', ".github/workflows/container-image.yml");

assert.equal(
  packageJson.scripts?.["test:source-trust-tiers"],
  "node ../scripts/source_trust_tiers_regression.mjs",
  "web/package.json must expose test:source-trust-tiers",
);

console.log("Source trust tier regression checks passed.");
