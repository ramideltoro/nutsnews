#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = resolve(root, ".github/workflows");
const read = (path) => readFile(resolve(root, path), "utf8");

const [workflow, regressionWorkflow, actionlintConfig, validator, inventory, recoveryDoc] = await Promise.all([
  read(".github/workflows/supabase-standby-readiness.yml"),
  read(".github/workflows/supabase-standby-readiness-regression.yml"),
  read(".github/actionlint.yaml"),
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
  "preflight:",
  "runs-on: ubuntu-latest",
  "readiness:",
  "runs-on: [supabase-standby-ipv6]",
  "environment: supabase-standby",
  "NUTSNEWS_STANDBY_PROJECT_POLICY: existing-production-supabase",
  "NUTSNEWS_STANDBY_SUPABASE_PROJECT_REF",
  "NUTSNEWS_STANDBY_SUPABASE_URL",
  "NUTSNEWS_STANDBY_SUPABASE_DB_URL",
  "NUTSNEWS_STANDBY_SUPABASE_SERVICE_ROLE_KEY",
  "NUTSNEWS_STANDBY_SUPABASE_ANON_KEY",
  "NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF",
  "node scripts/supabase_standby_readiness.mjs",
  "Assert preinstalled PostgreSQL client",
  "command -v psql >/dev/null",
  "psql --no-psqlrc",
  "begin read only;",
  "Raw URLs, keys, database users, passwords, and row data were not printed.",
  "lag <= 30 seconds, parity, schema, sequence, writer-pause, and split-brain checks must pass first.",
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
assert.doesNotMatch(workflow, /\bsudo\b|apt-get|apt\s+install/, "Standby readiness must not install packages or use sudo at job runtime.");
assert.doesNotMatch(workflow, /cat\s+.*NUTSNEWS_STANDBY|echo\s+["']?\$NUTSNEWS_STANDBY/, "Standby readiness must not print protected values.");
assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SERVICE_ROLE_KEY/, "Standby readiness must not use legacy production service-role fallback secrets.");

const preflightBlock = workflow.match(/\n  preflight:[\s\S]*?(?=\n  readiness:|\n[a-zA-Z_][\w-]*:|$)/)?.[0] ?? "";
const readinessBlock = workflow.match(/\n  readiness:[\s\S]*?(?=\n[a-zA-Z_][\w-]*:|$)/)?.[0] ?? "";
assert.ok(preflightBlock.includes("runs-on: ubuntu-latest"), "Preflight must stay on GitHub-hosted ubuntu-latest.");
assert.doesNotMatch(preflightBlock, /supabase-standby-ipv6/, "Preflight must not target the dedicated IPv6 label.");
assert.ok(readinessBlock.includes("runs-on: [supabase-standby-ipv6]"), "Only readiness must target the dedicated IPv6 label.");
assert.doesNotMatch(readinessBlock, /\bsudo\b|apt-get|apt\s+install/, "Readiness must not need root package installation on the runner.");

for (const fragment of [
  "STANDBY_PROJECT_POLICY = \"existing-production-supabase\"",
  "Standby project ref must match the production Supabase project ref",
  "backend-postgres-primary-read-write",
  "withheld-from-app-worker-until-approved-failover",
  "requires-lag-parity-schema-sequence-checks",
  "direct standby Supabase database host",
  "sslmode=require",
  "standbyReadinessSummary",
]) {
  requireText(validator, fragment, `Standby readiness validator is missing ${fragment}.`);
}
assert.doesNotMatch(validator, /fresh-project|must differ from the production Supabase project ref/, "Standby readiness must not require a fresh project or a production-ref mismatch.");

for (const fragment of [
  "node --test tests/supabase-standby-readiness.test.mjs",
  "node scripts/supabase_standby_readiness_regression.mjs",
]) {
  requireText(regressionWorkflow, fragment, `Standby readiness regression workflow is missing ${fragment}.`);
}

for (const fragment of [
  "self-hosted-runner:",
  "labels:",
  "- supabase-standby-ipv6",
]) {
  requireText(actionlintConfig, fragment, `Actionlint config is missing the dedicated runner label declaration: ${fragment}.`);
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
  "existing production Supabase",
  "must match `NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF`",
  "lag <= 30 seconds, parity, schema, sequence, writer-pause, and split-brain checks must pass first",
]) {
  requireText(recoveryDoc, fragment, `Recovery doc is missing ${fragment}.`);
}
assert.doesNotMatch(
  recoveryDoc,
  /fresh standby project|fresh project ref|must differ from `NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF`/,
  "Recovery docs must not require a fresh standby Supabase project for issue #496.",
);

const allowedSecretWorkflow = "supabase-standby-readiness.yml";
const allowedRunnerLabelWorkflow = "supabase-standby-readiness.yml";
const standbySecretContextPattern =
  /secrets\.NUTSNEWS_STANDBY_SUPABASE_(?:PROJECT_REF|URL|DB_URL|SERVICE_ROLE_KEY|ANON_KEY)\b/;
const dedicatedRunnerLabelPattern = /\bsupabase-standby-ipv6\b/;

for (const workflowFile of (await readdir(workflowDir)).filter((file) => file.endsWith(".yml")).sort()) {
  const text = await readFile(resolve(workflowDir, workflowFile), "utf8");
  if (workflowFile !== allowedSecretWorkflow) {
    assert.doesNotMatch(
      text,
      standbySecretContextPattern,
      `${workflowFile} must not read standby write credentials before a protected failover path exists.`,
    );
  }

  if (workflowFile !== allowedRunnerLabelWorkflow) {
    assert.doesNotMatch(
      text,
      dedicatedRunnerLabelPattern,
      `${workflowFile} must not target the protected standby IPv6 runner label.`,
    );
  }

  if (workflowFile === allowedRunnerLabelWorkflow) {
    const labelOccurrences = [...text.matchAll(new RegExp(dedicatedRunnerLabelPattern, "g"))].length;
    assert.equal(labelOccurrences, 1, "The protected standby IPv6 runner label must appear exactly once.");
  }
}

console.log("Supabase standby readiness workflow guardrails passed.");
