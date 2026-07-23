#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = resolve(root, ".github/workflows");
const read = (path) => readFile(resolve(root, path), "utf8");

const [workflow, regressionWorkflow, validator, inventory, recoveryDoc] = await Promise.all([
  read(".github/workflows/supabase-standby-readiness.yml"),
  read(".github/workflows/supabase-standby-readiness-regression.yml"),
  read("scripts/supabase_standby_readiness.mjs"),
  read(".github/deployment/workflow-check-inventory.md"),
  read(".github/deployment/environments-secrets-recovery.md"),
]);

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

for (const fragment of [
  "workflow_dispatch:",
  "verify-supabase-standby-readiness",
  "group: nutsnews-supabase-standby-readiness",
  "cancel-in-progress: false",
  "environment: supabase-standby",
  "NUTSNEWS_STANDBY_PROJECT_POLICY: fresh-project",
  "NUTSNEWS_STANDBY_SUPABASE_PROJECT_REF",
  "NUTSNEWS_STANDBY_SUPABASE_URL",
  "NUTSNEWS_STANDBY_SUPABASE_DB_URL",
  "NUTSNEWS_STANDBY_SUPABASE_SERVICE_ROLE_KEY",
  "NUTSNEWS_STANDBY_SUPABASE_ANON_KEY",
  "NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF",
  "node scripts/supabase_standby_readiness.mjs",
  "psql --no-psqlrc",
  "begin read only;",
  "Raw URLs, keys, database users, passwords, and row data were not printed.",
  "persist-credentials: false",
]) {
  requireText(workflow, fragment, `Standby readiness workflow is missing ${fragment}.`);
}

assert.ok(
  workflow.indexOf("Validate typed operator confirmation") < workflow.indexOf("environment: supabase-standby"),
  "Operator confirmation must be validated before protected environment access.",
);
assert.ok(
  workflow.indexOf("environment: supabase-standby") < workflow.indexOf("NUTSNEWS_STANDBY_SUPABASE_DB_URL"),
  "Only the protected standby job may read the direct database URL.",
);
assert.doesNotMatch(workflow, /pull_request:|push:/, "Standby readiness must be manual-only.");
assert.doesNotMatch(workflow, /cat\s+.*NUTSNEWS_STANDBY|echo\s+["']?\$NUTSNEWS_STANDBY/, "Standby readiness must not print protected values.");
assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SERVICE_ROLE_KEY/, "Standby readiness must not use legacy production service-role fallback secrets.");

for (const fragment of [
  "STANDBY_PROJECT_POLICY = \"fresh-project\"",
  "Standby project ref must differ from the production Supabase project ref",
  "direct standby Supabase database host",
  "sslmode=require",
  "standbyReadinessSummary",
]) {
  requireText(validator, fragment, `Standby readiness validator is missing ${fragment}.`);
}

for (const fragment of [
  "node --test tests/supabase-standby-readiness.test.mjs",
  "node scripts/supabase_standby_readiness_regression.mjs",
]) {
  requireText(regressionWorkflow, fragment, `Standby readiness regression workflow is missing ${fragment}.`);
}

for (const fragment of [
  "`supabase-standby-readiness-regression.yml` | PR-required",
  "`supabase-standby-readiness.yml` | manual recovery",
]) {
  requireText(inventory, fragment, `Workflow inventory is missing ${fragment}.`);
}

for (const fragment of [
  "`supabase-standby`",
  "`NUTSNEWS_STANDBY_SUPABASE_PROJECT_REF`",
  "`NUTSNEWS_STANDBY_SUPABASE_URL`",
  "`NUTSNEWS_STANDBY_SUPABASE_DB_URL`",
  "`NUTSNEWS_STANDBY_SUPABASE_SERVICE_ROLE_KEY`",
  "`NUTSNEWS_STANDBY_SUPABASE_ANON_KEY`",
  "`supabase-standby-readiness.yml`",
  "`verify-supabase-standby-readiness`",
]) {
  requireText(recoveryDoc, fragment, `Recovery doc is missing ${fragment}.`);
}

const allowedSecretWorkflow = "supabase-standby-readiness.yml";
const standbySecretContextPattern =
  /secrets\.NUTSNEWS_STANDBY_SUPABASE_(?:PROJECT_REF|URL|DB_URL|SERVICE_ROLE_KEY|ANON_KEY)\b/;

for (const workflowFile of (await readdir(workflowDir)).filter((file) => file.endsWith(".yml")).sort()) {
  const text = await readFile(resolve(workflowDir, workflowFile), "utf8");
  if (workflowFile !== allowedSecretWorkflow) {
    assert.doesNotMatch(
      text,
      standbySecretContextPattern,
      `${workflowFile} must not read standby write credentials before a protected failover path exists.`,
    );
  }
}

console.log("Supabase standby readiness workflow guardrails passed.");
