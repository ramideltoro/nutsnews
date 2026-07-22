#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function read(path) {
  return readFile(resolve(root, path), "utf8");
}

const workflowPath = ".github/workflows/staging-release.yml";
const runbookPath = ".github/deployment/staging-active-use-runbook.md";
const recoveryPath = ".github/deployment/environments-secrets-recovery.md";
const inventoryPath = ".github/deployment/workflow-check-inventory.md";

const workflow = await read(workflowPath);
const runbook = await read(runbookPath);
const recovery = await read(recoveryPath);
const inventory = await read(inventoryPath);

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

function requirePattern(text, pattern, message) {
  assert.match(text, pattern, message);
}

function inputBlock(text, inputName) {
  const marker = `      ${inputName}:\n`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `${workflowPath} must define workflow_dispatch input ${inputName}.`);
  const rest = text.slice(start + marker.length);
  const next = rest.search(/\n      [A-Za-z0-9_]+:\n/);
  return text.slice(start, next === -1 ? text.length : start + marker.length + next);
}

for (const inputName of [
  "confirmation",
  "operator_reason",
  "validation_ttl_hours",
  "off_state_acknowledgement",
  "source_commit",
  "image_digest",
  "build_id",
  "schema_version",
  "migration_head",
  "supabase_project_ref",
]) {
  requireText(inputBlock(workflow, inputName), "required: true", `${inputName} must be a required manual staging input.`);
}

const ttlInput = inputBlock(workflow, "validation_ttl_hours");
requireText(ttlInput, "type: choice", "validation_ttl_hours must be constrained by GitHub choice input.");
for (const ttl of ['"1"', '"4"', '"8"', '"24"']) {
  requireText(ttlInput, `          - ${ttl}`, `validation_ttl_hours must permit ${ttl}.`);
}

requireText(workflow, 'offStateAcknowledgement !== "staging-auto-idle-required"', "Workflow must validate the auto-idle acknowledgement.");
requireText(workflow, '["1", "4", "8", "24"].includes(validationTtlHours)', "Workflow must reject unbounded TTL values.");
requireText(workflow, "operator_reason must be 8-180 safe printable characters", "Workflow must validate operator reason length and printable content.");
requireText(workflow, "requested_disable_by", "Workflow summary outputs must record a requested disable-by timestamp.");
requireText(workflow, "event_type: \"nutsnews-staging-release\"", "Workflow must keep dispatching the reviewed infra staging event.");
requireText(workflow, "NUTSNEWS_INFRA_STAGING_TOKEN", "Workflow must use the staging infra dispatch token.");
requireText(workflow, "production_touched=false", "Workflow summary must name the off-state production isolation proof.");
requireText(workflow, "nutsnews-staging-auto-idle.timer", "Workflow summary must point operators to auto-idle teardown.");
assert.doesNotMatch(workflow, /^\s+push:/m, "Manual staging recovery must not run on push.");
assert.doesNotMatch(workflow, /^\s+pull_request:/m, "Manual staging recovery must not run on pull_request.");
assert.doesNotMatch(workflow, /^\s+environment:\s+Production\b/m, "Manual staging recovery must not attach the Production environment.");
assert.doesNotMatch(workflow, /NUTSNEWS_INFRA_PRODUCTION_TOKEN|VERCEL_TOKEN|CLOUDFLARE_API_TOKEN/, "Manual staging recovery must not read production provider secrets.");

const dispatchBody = workflow.match(/body: JSON\.stringify\(\{([\s\S]*?)\n\s+\}\),\n\s+\}\);/)?.[1] ?? "";
requireText(dispatchBody, "client_payload: candidate", "Staging dispatch must use the compact immutable candidate payload.");
assert.doesNotMatch(dispatchBody, /operatorReason|validationTtlHours|offStateAcknowledgement/, "Operator audit fields must not be added to the infra candidate payload.");

for (const fragment of [
  "# Staging Active-Use Runbook",
  "Staging is not an always-on environment",
  "## Intended Off State",
  "nutsnews-staging",
  "nutsnews-staging-access",
  "NUTSNEWS_SIDE_EFFECTS_MODE=disabled",
  "Cloudflare Access",
  "vps_service_foundation_nutsnews_staging_enabled: false",
  "vps_service_foundation_nutsnews_staging_access_enabled: false",
  "vps_service_foundation_nutsnews_staging_auto_idle_enabled: true",
  "vps_service_foundation_nutsnews_staging_auto_idle_grace_seconds: 3600",
  "vps_service_foundation_nutsnews_staging_test_budget.qualification_ttl_hours: 24",
  "confirmation=request-vps-staging-recovery",
  "operator_reason=<8-180 character reason>",
  "validation_ttl_hours=1|4|8|24",
  "off_state_acknowledgement=staging-auto-idle-required",
  "event `nutsnews-staging-release`",
  "## Enabled-State Verification",
  "## Teardown And Off-State Verification",
  "sudo systemctl start nutsnews-staging-auto-idle.service",
  "production_touched: false",
  "running_after for all managed containers is false",
  "## Long-Running Exceptions",
]) {
  requireText(runbook, fragment, `${runbookPath} must document ${fragment}.`);
}

requirePattern(runbook, /anonymous traffic must fail closed/i, `${runbookPath} must document public-access fail-closed behavior.`);
requirePattern(runbook, /24-hour qualification TTL/i, `${runbookPath} must document the maximum default qualification TTL.`);
requirePattern(runbook, /one-hour auto-idle grace/i, `${runbookPath} must document the auto-idle grace window.`);

requireText(recovery, "Staging Active-Use Runbook", `${recoveryPath} must link to the staging active-use runbook.`);
requireText(recovery, "`operator_reason`", `${recoveryPath} must document operator reason input.`);
requireText(recovery, "`validation_ttl_hours`", `${recoveryPath} must document TTL input.`);
requireText(recovery, "`off_state_acknowledgement=staging-auto-idle-required`", `${recoveryPath} must document off-state acknowledgement.`);
requireText(inventory, "bounded TTL declaration", `${inventoryPath} must classify staging release as bounded active-use recovery.`);
requireText(inventory, "infra auto-idle path", `${inventoryPath} must document staging teardown ownership.`);

console.log("Staging active-use contract regression passed.");
