#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [workflow, backupWorkflow, request, runner, migrationContract, verifier, regressionWorkflow] = await Promise.all([
  read(".github/workflows/production-supabase-migration.yml"),
  read(".github/workflows/supabase-backup.yml"),
  read("scripts/production_migration_request.mjs"),
  read("scripts/locked_migration_workflow.mjs"),
  read("scripts/migration_contract.mjs"),
  read("scripts/verify_production_migration_contract.mjs"),
  read(".github/workflows/production-supabase-migration-regression.yml"),
]);

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

for (const fragment of [
  "workflow_dispatch:",
  "apply-production-supabase-migrations",
  "backup_run_id:",
  "group: nutsnews-production-supabase-migration",
  "cancel-in-progress: false",
  "environment: production-supabase",
  "NUTSNEWS_PRODUCTION_SUPABASE_ACCESS_TOKEN",
  "NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF",
  "Supabase Backup",
  "production-supabase-schema-before-",
  "node automation/scripts/locked_migration_workflow.mjs",
  "node automation/scripts/verify_production_migration_contract.mjs",
  "NUTSNEWS_PRODUCTION_MIGRATION_APPROVAL: approved",
  "NUTSNEWS_PRODUCTION_BACKUP_COMPLETED_AT",
  "NUTSNEWS_MIGRATION_USE_LINKED_PROJECT: \"true\"",
  "ref: ${{ needs.preflight.outputs.source_commit }}",
  "persist-credentials: false",
]) {
  requireText(workflow, fragment, `Production migration workflow is missing ${fragment}.`);
}

assert.ok(
  workflow.indexOf("Validate main source, schema contract, and fresh backup") < workflow.indexOf("environment: production-supabase"),
  "Untrusted request data must be validated before protected environment access.",
);
assert.ok(
  workflow.indexOf("environment: production-supabase") < workflow.indexOf("NUTSNEWS_PRODUCTION_SUPABASE_ACCESS_TOKEN"),
  "Only the protected job may read the production access token.",
);
assert.ok(
  workflow.indexOf("Capture a pre-migration production schema snapshot") <
    workflow.indexOf("Derive a fresh temporary database connection for the migration lock") &&
    workflow.indexOf("Derive a fresh temporary database connection for the migration lock") <
      workflow.indexOf("Apply only forward migrations under the production database advisory lock"),
  "The short-lived lock credential must be derived after the schema snapshot and immediately before migration.",
);
assert.ok(
  workflow.indexOf("Apply only forward migrations under the production database advisory lock") <
    workflow.indexOf("Refresh the temporary database connection for contract verification") &&
    workflow.indexOf("Refresh the temporary database connection for contract verification") <
      workflow.indexOf("Verify production reports the approved schema contract with the fresh connection"),
  "Contract verification must derive a separate fresh short-lived credential after migration.",
);
assert.equal(
  workflow.match(/supabase db dump --linked --dry-run/g)?.length,
  2,
  "Production migration must derive exactly two short-lived direct database connections.",
);
assert.doesNotMatch(workflow, /supabase db reset|migration_direction:\s*down/i, "Production workflow must never reset or reverse the database.");
assert.doesNotMatch(workflow, /echo\s+\"?\$SUPABASE_ACCESS_TOKEN|cat\s+.*database/i, "Production workflow must not print protected credentials.");

requireText(
  backupWorkflow,
  "SUPABASE_URL: ${{ vars.NUTSNEWS_PRODUCTION_SUPABASE_URL }}",
  "Production backup must use the explicit production Supabase endpoint.",
);
requireText(
  backupWorkflow,
  "SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.NUTSNEWS_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY }}",
  "Production backup must use the explicit production Supabase service credential.",
);
assert.doesNotMatch(
  backupWorkflow,
  /(?:SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY):\s*\$\{\{\s*secrets\.(?:SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)(?:\s|\})/,
  "Production backup must not fall back to a legacy generic Supabase endpoint or credential.",
);

for (const fragment of ["backupRunId", "Supabase Backup", "workflow_dispatch", "MAX_BACKUP_AGE_MS", "origin/main"]) {
  requireText(request, fragment, `Production request validation is missing ${fragment}.`);
}
requireText(runner, "production-protected", "Locked runner must retain its protected production policy.");
requireText(runner, "NOTIFY pgrst, 'reload schema'", "Locked runner must refresh PostgREST after migration.");
requireText(runner, "recorded atomically by its head migration", "Linked production must rely on atomic head recording.");
requireText(migrationContract, "must atomically record its migration contract", "Migration validation must require atomic head recording.");
requireText(verifier, "nutsnews_migration_schema_contract", "Production verifier must query the database contract.");
requireText(verifier, "NOTIFY pgrst, 'reload schema'", "Production verifier must refresh PostgREST with its fresh connection.");
requireText(verifier, "legacy_schema_version", "Production verifier must preserve the rollback-compatible schema marker.");
requireText(regressionWorkflow, "node scripts/production_migration_workflow_regression.mjs", "Regression workflow must run its guard.");

console.log("Production Supabase migration workflow guardrails passed.");
