#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");

const [
  manifest,
  validator,
  testSource,
  workflow,
  databaseMigrationGate,
  inventory,
  recoveryDoc,
  packageJson,
] = await Promise.all([
  read("supabase/standby_manifest.json"),
  read("scripts/supabase_standby_manifest.mjs"),
  read("tests/supabase-standby-manifest.test.mjs"),
  read(".github/workflows/supabase-standby-manifest-regression.yml"),
  read(".github/workflows/database-migration-gate.yml"),
  read(".github/deployment/workflow-check-inventory.md"),
  read(".github/deployment/environments-secrets-recovery.md"),
  read("web/package.json"),
]);

function requireText(text, fragment, label) {
  assert.ok(text.includes(fragment), `${label} is missing ${fragment}.`);
}

for (const fragment of [
  "\"policy\": \"backend-postgres-primary-to-existing-production-supabase-standby\"",
  "\"standbyTarget\": \"existing-production-supabase\"",
  "\"primaryDatabase\": \"backend-postgres-primary-read-write\"",
  "\"existingProductionSupabaseProject\": true",
  "\"createNewSupabaseProject\": false",
  "\"createNutsnewsStandbyDatabase\": false",
  "\"appWorkerSupabaseWritesBeforeApprovedFailover\": false",
  "\"destructiveSupabaseRetirementBlockedUntilManifestExists\": true",
  "\"rowReplicationContains\": \"base-tables-only\"",
  "\"excludedRelationKinds\"",
  "\"schemaFingerprint\"",
  "\"sequence-safety-verified\"",
  "https://github.com/ramideltoro/nutsnews/issues/223",
  "https://github.com/ramideltoro/nutsnews/issues/497",
]) {
  requireText(manifest, fragment, "standby manifest");
}

for (const fragment of [
  "REQUIRED_FAILOVER_GATES",
  "deriveStandbySchema",
  "buildExpectedStandbyManifest",
  "validateStandbyManifest",
  "schemaFingerprintForManifest",
  "rowReplicationContains: \"base-tables-only\"",
  "createNewSupabaseProject: false",
  "createNutsnewsStandbyDatabase: false",
  "appWorkerSupabaseWritesBeforeApprovedFailover: false",
  "destructiveSupabaseRetirementBlockedUntilManifestExists: true",
  "lacks a primary key or explicit replica identity",
  "schema fingerprint mismatch; standby promotion must remain blocked",
]) {
  requireText(validator, fragment, "standby manifest validator");
}

for (const fragment of [
  "repository standby manifest matches the Supabase migration contract",
  "manifest excludes views from row replication",
  "missing primary key or replica identity fails",
  "schema fingerprint mismatch blocks standby promotion",
]) {
  requireText(testSource, fragment, "standby manifest test");
}

for (const fragment of [
  "name: Supabase Standby Manifest Regression",
  "pull_request:",
  "push:",
  "paths:",
  "supabase/standby_manifest.json",
  "supabase/migrations/**",
  "scripts/supabase_standby_manifest.mjs",
  "scripts/supabase_standby_manifest_regression.mjs",
  "tests/supabase-standby-manifest.test.mjs",
  "node --test tests/supabase-standby-manifest.test.mjs",
  "node scripts/supabase_standby_manifest.mjs",
  "node scripts/supabase_standby_manifest_regression.mjs",
  "runs-on: ubuntu-latest",
]) {
  requireText(workflow, fragment, "standby manifest regression workflow");
}

assert.doesNotMatch(workflow, /environment:\s*(?:supabase-standby|production|Production|production-supabase)/, "Standby manifest regression must not use protected environments.");
assert.doesNotMatch(workflow, /secrets\./, "Standby manifest regression must not read secrets.");

for (const fragment of [
  "scripts/supabase_standby_manifest.mjs",
  "tests/supabase-standby-manifest.test.mjs",
  "node scripts/supabase_standby_manifest.mjs",
  "tests/supabase-standby-manifest.test.mjs",
]) {
  requireText(databaseMigrationGate, fragment, "database migration gate");
}

requireText(packageJson, "../tests/supabase-standby-manifest.test.mjs", "web package migration tests");

for (const fragment of [
  "`supabase-standby-manifest-regression.yml` | PR-required",
  "standby manifest validator",
  "`supabase/standby_manifest.json`",
]) {
  requireText(inventory, fragment, "workflow inventory");
}

for (const fragment of [
  "`supabase/standby_manifest.json`",
  "schema fingerprint",
  "sequence",
  "Destructive Supabase retirement work is blocked",
  "existing production Supabase",
  "no new Supabase project or `nutsnews-standby` database",
]) {
  requireText(recoveryDoc, fragment, "deployment recovery doc");
}

assert.doesNotMatch(
  manifest + validator + workflow + recoveryDoc,
  /fresh standby project|fresh project ref|must differ from `NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF`|nutsnews-standby database is required/,
  "Standby manifest policy must not require a fresh standby project or separate nutsnews-standby database.",
);

console.log("Supabase standby manifest regression guardrails passed.");
