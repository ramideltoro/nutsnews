#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [workflow, regressionWorkflow, requestValidator, migrationRunner, verifier, containerWorkflow] = await Promise.all([
  read(".github/workflows/staging-supabase-migration.yml"),
  read(".github/workflows/staging-supabase-migration-regression.yml"),
  read("scripts/staging_migration_request.mjs"),
  read("scripts/locked_migration_workflow.mjs"),
  read("scripts/verify_staging_migration_contract.mjs"),
  read(".github/workflows/container-image.yml"),
]);

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

for (const fragment of [
  "workflow_dispatch:",
  "apply-staging-supabase-migrations",
  "group: nutsnews-staging-supabase-migration",
  "cancel-in-progress: false",
  "environment: staging-supabase",
  "NUTSNEWS_STAGING_MIGRATION_DATABASE_URL",
  "node automation/scripts/locked_migration_workflow.mjs",
  "node automation/scripts/verify_staging_migration_contract.mjs",
  "ref: ${{ needs.preflight.outputs.source_commit }}",
  "persist-credentials: false",
  "path: automation",
  "path: approved-source",
  "NUTSNEWS_MIGRATION_SOURCE_ROOT: ${{ github.workspace }}/approved-source",
]) {
  requireText(workflow, fragment, `Staging migration workflow is missing ${fragment}.`);
}

assert.doesNotMatch(workflow, /repository_dispatch:|staging-vps|NUTSNEWS_INFRA_RELEASE_TOKEN/i, "Staging migration workflow must not expose VPS promotion paths.");
assert.doesNotMatch(workflow, /environment:\s*production|NUTSNEWS_MIGRATION_TARGET:\s*production|NUTSNEWS_MIGRATION_PURPOSE:\s*production-protected/i, "Staging migration workflow must not configure a production migration path.");
assert.ok(workflow.indexOf("Validate trusted main source and migration request") < workflow.indexOf("environment: staging-supabase"), "Request validation must occur before protected environment access.");
assert.ok(workflow.indexOf("environment: staging-supabase") < workflow.indexOf("NUTSNEWS_STAGING_MIGRATION_DATABASE_URL"), "Only the protected job may read the staging database secret.");

for (const fragment of [
  "sourceCommit, migrationHead, and confirmation",
  "full lowercase 40-character SHA",
  "14-digit migration version",
  "merge-base",
  "origin/main",
]) {
  requireText(requestValidator, fragment, `Staging migration request validator is missing ${fragment}.`);
}

requireText(migrationRunner, "NOTIFY pgrst, 'reload schema'", "Migration runner must reload the PostgREST schema cache after a staging migration.");
requireText(migrationRunner, "NUTSNEWS_MIGRATION_SOURCE_ROOT", "Migration runner must use only the approved source migration files.");
requireText(migrationRunner, "--output=L", "The Linux migration lock client must line-buffer its lock-acquired marker.");
requireText(verifier, "nutsnews_migration_schema_contract", "Staging migration verifier must query the migration contract.");
requireText(regressionWorkflow, "node scripts/staging_migration_workflow_regression.mjs", "Regression workflow must run the staging migration workflow guard.");
requireText(containerWorkflow, "tests/staging-migration-request.test.mjs", "The container-image migration gate must run staging migration request tests.");

console.log("Staging Supabase migration workflow regression checks passed.");
