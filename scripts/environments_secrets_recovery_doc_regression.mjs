#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docPath = ".github/deployment/environments-secrets-recovery.md";
const doc = await readFile(resolve(root, docPath), "utf8");
const containerWorkflow = await readFile(resolve(root, ".github/workflows/container-image.yml"), "utf8");

const targetJobs = [
  "pr-release-artifact",
  "deploy-vps-staging",
  "ui-smoke-vps-staging",
  "deploy-vercel-staging",
  "ui-smoke-vercel-staging",
  "deploy-vercel-production",
  "ui-smoke-vercel-production",
  "deploy-vps-production",
  "ui-smoke-vps-production",
];

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

function collectMatches(text, pattern) {
  return [...text.matchAll(pattern)].map((match) => match[1]);
}

function workflowJob(text, name) {
  const marker = `  ${name}:\n`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `Workflow job not found: ${name}`);
  const rest = text.slice(start + marker.length);
  const next = rest.search(/\n  [A-Za-z0-9_-]+:\n/);
  return text.slice(start, next === -1 ? text.length : start + marker.length + next);
}

const targetWorkflowText = targetJobs.map((jobName) => workflowJob(containerWorkflow, jobName)).join("\n");
const targetSecrets = new Set(collectMatches(targetWorkflowText, /secrets\.([A-Z0-9_]+)/g).filter((name) => name !== "GITHUB_TOKEN"));
const targetVariables = new Set(collectMatches(targetWorkflowText, /vars\.([A-Z0-9_]+)/g));
const targetEnvironments = new Set(collectMatches(targetWorkflowText, /^\s+environment:\s+(.+)$/gm).map((name) => name.trim()));

for (const secretName of [...targetSecrets].sort()) {
  requireText(doc, `\`${secretName}\``, `${docPath} must list normal VPS/Vercel secret ${secretName}.`);
}

for (const variableName of [...targetVariables].sort()) {
  requireText(doc, `\`${variableName}\``, `${docPath} must list normal VPS/Vercel repository variable ${variableName}.`);
}

for (const environmentName of [...targetEnvironments].sort()) {
  requireText(doc, `\`${environmentName}\``, `${docPath} must list normal VPS/Vercel GitHub environment ${environmentName}.`);
}

for (const fragment of [
  "The staging deployment jobs intentionally do not use a GitHub environment.",
  "`staging-supabase`",
  "`production-supabase`",
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
]) {
  requireText(doc, fragment, `${docPath} must document environment or recovery dependency ${fragment}.`);
}

for (const fragment of [
  "`NUTSNEWS_VPS_STAGING_URL`",
  "https://staging.nutsnews.com/",
  "`deploy-vercel-staging.outputs.target_url`",
  "`NUTSNEWS_VERCEL_PRODUCTION_ALIASES`",
  "https://www.nutsnews.com/",
  "https://nutsnews.com/",
  "`NUTSNEWS_VPS_PRODUCTION_URL`",
  "https://vps.nutsnews.com/",
]) {
  requireText(doc, fragment, `${docPath} must document target URL source ${fragment}.`);
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
  "rerun the `Container Image` workflow",
  "`nutsnews-premerge-deploy-pr-<pr_number>`",
  "`pr-<pr_number>-<source_commit>-<target_type>`",
  "stale PR head",
  "`Pre-merge deployment gate`",
]) {
  requireText(doc, fragment, `${docPath} must document rerun and stale-head recovery ${fragment}.`);
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
  "`supabase-backup.yml`",
  "`supabase-rest-backup`",
  "`supabase-restore-fire-drill-report`",
]) {
  requireText(doc, fragment, `${docPath} must document manual recovery path ${fragment}.`);
}

for (const fragment of [
  "Normal release deployment happens before merge.",
  "A `main` merge is not a deployment trigger",
  "Do not add a custom workflow that pushes to `main`, merges the PR, or deploys from `main` after merge.",
]) {
  requireText(doc, fragment, `${docPath} must document merge handoff rule ${fragment}.`);
}

console.log("Deployment environments, secrets, and recovery runbook regression passed.");
