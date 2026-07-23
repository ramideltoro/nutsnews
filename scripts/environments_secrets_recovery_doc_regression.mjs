#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docPath = ".github/deployment/environments-secrets-recovery.md";
const doc = await readFile(resolve(root, docPath), "utf8");
const containerWorkflow = await readFile(resolve(root, ".github/workflows/container-image.yml"), "utf8");

const removedContainerJobs = [
  "trusted-pr-deployment-eligibility",
  "pr-release-artifact",
  "deploy-vps-staging",
  "ui-smoke-vps-staging",
  "deploy-vercel-staging",
  "ui-smoke-vercel-staging",
  "deploy-vercel-production",
  "ui-smoke-vercel-production",
  "deploy-vps-production",
  "ui-smoke-vps-production",
  "pre-merge-deployment-gate",
  "release-candidate",
];

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

requireText(doc, "Normal PR merges do not deploy", `${docPath} must document that ordinary PRs do not deploy.`);
requireText(doc, "manual or explicit release-only", `${docPath} must keep deployment validation out of default PR checks.`);
requireText(doc, "`Merge Gate`", `${docPath} must name the required merge check.`);
requireText(doc, "`Release candidate` is no longer required", `${docPath} must document that Release candidate is no longer required.`);
assert.doesNotMatch(doc, /Container Image` pull-request workflow/, `${docPath} must not describe Container Image as a pull-request deployment workflow.`);

for (const job of removedContainerJobs) {
  assert.doesNotMatch(containerWorkflow, new RegExp(`^  ${job}:`, "m"), `.github/workflows/container-image.yml must not contain removed PR job ${job}.`);
}
assert.doesNotMatch(containerWorkflow, /^\s+pull_request:/m, ".github/workflows/container-image.yml must not run on pull_request.");
assert.doesNotMatch(containerWorkflow, /^\s+environment:\s+Production\b/m, ".github/workflows/container-image.yml must not invoke Production.");

for (const fragment of [
  "`staging-supabase`",
  "`production-supabase`",
  "`supabase-standby`",
  "`NUTSNEWS_INFRA_STAGING_TOKEN`",
  "`NUTSNEWS_INFRA_PRODUCTION_TOKEN`",
  "`NUTSNEWS_BACKEND_API_TOKEN`",
  "`CLOUDFLARE_API_TOKEN`",
  "`CLOUDFLARE_ZONE_ID`",
  "`NUTSNEWS_RULESET_AUDIT_TOKEN`",
  "`NUTSNEWS_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY`",
  "`NUTSNEWS_STAGING_MIGRATION_DATABASE_URL`",
  "`NUTSNEWS_PRODUCTION_SUPABASE_ACCESS_TOKEN`",
  "`NUTSNEWS_PRODUCTION_SUPABASE_URL`",
  "`NUTSNEWS_STANDBY_SUPABASE_PROJECT_REF`",
  "`NUTSNEWS_STANDBY_SUPABASE_URL`",
  "`NUTSNEWS_STANDBY_SUPABASE_DB_URL`",
  "`NUTSNEWS_STANDBY_SUPABASE_SERVICE_ROLE_KEY`",
  "`NUTSNEWS_STANDBY_SUPABASE_ANON_KEY`",
  "existing production Supabase",
  "must match `NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF`",
  "lag <= 30 seconds, parity, schema, sequence, writer-pause, and split-brain checks must pass first",
]) {
  requireText(doc, fragment, `${docPath} must document environment or recovery dependency ${fragment}.`);
}
assert.doesNotMatch(
  doc,
  /fresh standby project|fresh project ref|must differ from `NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF`/,
  `${docPath} must not require a fresh standby Supabase project for issue #496.`,
);

for (const fragment of [
  "`NUTSNEWS_VPS_STAGING_URL`",
  "https://staging.nutsnews.com/",
  "`deploy-vercel-staging.outputs.target_url`",
  "`NUTSNEWS_VERCEL_SECONDARY_PRODUCTION_URLS`",
  "`NUTSNEWS_VERIFY_VERCEL_FAILOVER_ALIASES`",
  "`NUTSNEWS_VERCEL_FAILOVER_PRODUCTION_ALIASES`",
  "`NUTSNEWS_VPS_PRODUCTION_URL`",
  "`NUTSNEWS_PRIMARY_PRODUCTION_URL`",
  "https://www.nutsnews.com/",
  "https://nutsnews.com/",
  "`NUTSNEWS_VPS_PRODUCTION_DIRECT_URL`",
  "https://vps.nutsnews.com/",
]) {
  requireText(doc, fragment, `${docPath} must document target URL source ${fragment}.`);
}

for (const fragment of [
  "`NUTSNEWS_FAILOVER_HEALTH_CHECK_INTERVAL_SECONDS`",
  "`15` seconds",
  "`NUTSNEWS_FAILOVER_CONSECUTIVE_VPS_FAILURES`",
  "`3` consecutive VPS failures",
  "`NUTSNEWS_FAILBACK_DNS_STATE_GATE`",
  "`current_dns_state_is_vercel_fallback_and_vps_ready`",
]) {
  requireText(doc, fragment, `${docPath} must document failover controller setting ${fragment}.`);
}

for (const fragment of [
  "Cloudflare Access",
  "`CF-Access-Client-Id`",
  "`CF-Access-Client-Secret`",
  "Vercel Deployment Protection",
  "`x-vercel-protection-bypass`",
  "`x-vercel-set-bypass-cookie`",
  "`VERCEL_PROTECTION_BYPASS_SECRET`",
  "Playwright traces are disabled",
]) {
  requireText(doc, fragment, `${docPath} must document protected-target auth behavior ${fragment}.`);
}

for (const fragment of [
  "explicit deployment or recovery stage fails",
  "`nutsnews-premerge-deploy-pr-<pr_number>`",
  "`pr-<pr_number>-<source_commit>-<target_type>`",
  "same stale-source and idempotency discipline",
]) {
  requireText(doc, fragment, `${docPath} must document rerun and stale-source recovery ${fragment}.`);
}

for (const fragment of [
  "`staging-release.yml`",
  "`request-vps-staging-recovery`",
  "`vercel-production-release.yml`",
  "`nutsnews-vercel-production-release`",
  "`protected-nutsnews-rollback.yml`",
  "`rollback-recorded-last-known-good`",
  "`cloudflare-production-cache-purge.yml`",
  "`purge-production-cache`",
  "`vercel-backend-token-sync.yml`",
  "`sync-backend-api-token-to-vercel-production`",
  "`staging-supabase-migration.yml`",
  "`apply-staging-supabase-migrations`",
  "`production-supabase-migration.yml`",
  "`apply-production-supabase-migrations`",
  "`supabase-standby-readiness.yml`",
  "`verify-supabase-standby-readiness`",
  "`supabase-backup.yml`",
  "`supabase-rest-backup`",
  "`supabase-restore-fire-drill-report`",
]) {
  requireText(doc, fragment, `${docPath} must document manual recovery path ${fragment}.`);
}

for (const fragment of [
  "A `main` merge is not a deployment trigger",
  "Do not add a custom workflow that pushes to `main`, merges the PR, or deploys from `main` after merge.",
]) {
  requireText(doc, fragment, `${docPath} must document merge handoff rule ${fragment}.`);
}

console.log("Deployment environments, secrets, and recovery runbook regression passed.");
