#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = resolve(root, ".github/workflows");
const containerWorkflow = await readFile(resolve(workflowDir, "container-image.yml"), "utf8");
const inventory = await readFile(resolve(root, ".github/deployment/workflow-check-inventory.md"), "utf8");

const orderedStages = [
  "deploy-vps-staging",
  "ui-smoke-vps-staging",
  "deploy-vercel-staging",
  "ui-smoke-vercel-staging",
  "deploy-vercel-production",
  "ui-smoke-vercel-production",
  "deploy-vps-production",
  "ui-smoke-vps-production",
  "pre-merge-deployment-gate",
];

const uiSmokeStages = [
  ["ui-smoke-vps-staging", "deploy-vps-staging", "vps-staging"],
  ["ui-smoke-vercel-staging", "deploy-vercel-staging", "vercel-staging"],
  ["ui-smoke-vercel-production", "deploy-vercel-production", "vercel-production"],
  ["ui-smoke-vps-production", "deploy-vps-production", "production-vps"],
];

const requiredNeeds = new Map([
  ["deploy-vps-staging", "needs: [pr-release-artifact, trusted-pr-deployment-eligibility]"],
  ["ui-smoke-vps-staging", "needs: [deploy-vps-staging, pr-release-artifact, trusted-pr-deployment-eligibility]"],
  ["deploy-vercel-staging", "needs: [ui-smoke-vps-staging, deploy-vps-staging, pr-release-artifact, trusted-pr-deployment-eligibility]"],
  ["ui-smoke-vercel-staging", "needs: [deploy-vercel-staging, ui-smoke-vps-staging, pr-release-artifact, trusted-pr-deployment-eligibility]"],
  ["deploy-vercel-production", "needs: [ui-smoke-vercel-staging, deploy-vercel-staging, pr-release-artifact, trusted-pr-deployment-eligibility]"],
  ["ui-smoke-vercel-production", "needs: [deploy-vercel-production, ui-smoke-vercel-staging, pr-release-artifact, trusted-pr-deployment-eligibility]"],
  ["deploy-vps-production", "needs: [ui-smoke-vercel-production, deploy-vercel-production, pr-release-artifact, trusted-pr-deployment-eligibility]"],
  ["ui-smoke-vps-production", "needs: [deploy-vps-production, ui-smoke-vercel-production, pr-release-artifact, trusted-pr-deployment-eligibility]"],
  [
    "pre-merge-deployment-gate",
    "needs: [trusted-pr-deployment-eligibility, pr-release-artifact, deploy-vps-staging, ui-smoke-vps-staging, deploy-vercel-staging, ui-smoke-vercel-staging, deploy-vercel-production, ui-smoke-vercel-production, deploy-vps-production, ui-smoke-vps-production]",
  ],
]);

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

function workflowJob(text, name) {
  const marker = `  ${name}:\n`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `Workflow job not found: ${name}`);
  const rest = text.slice(start + marker.length);
  const next = rest.search(/\n  [A-Za-z0-9_-]+:\n/);
  return {
    start,
    text: text.slice(start, next === -1 ? text.length : start + marker.length + next),
  };
}

function inventoryClassification(workflowName) {
  const match = inventory.match(new RegExp(`^\\| \`${workflowName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\` \\| ([^|]+?) \\|`, "m"));
  return match?.[1]?.trim() ?? "";
}

function triggerBlock(workflowText) {
  return workflowText.match(/(?:^|\n)on:\n([\s\S]*?)(?=\n[a-zA-Z_][A-Za-z0-9_-]*:|$)/)?.[1] ?? "";
}

function hasAutomaticPostMainDeploymentTrigger(workflowName, workflowText) {
  if (workflowName === "container-image.yml") return false;
  const triggers = triggerBlock(workflowText);
  const mutatesDeploymentTarget = /repos\/ramideltoro\/nutsnews-infra\/dispatches|vercel@latest deploy|run:\s+node scripts\/cloudflare_purge_cache\.mjs|CLOUDFLARE_PURGE_EVERYTHING|NUTSNEWS_INFRA_(?:STAGING|PRODUCTION)_TOKEN/.test(workflowText);
  if (!mutatesDeploymentTarget) return false;

  const workflowRunFromMain = /workflow_run:/.test(triggers) && /head_branch\s*==\s*'main'/.test(workflowText);
  const deploymentStatusTrigger = /deployment_status:/.test(triggers);
  const mainPushTrigger = /push:[\s\S]*?branches:\s*(?:\[(?:"main"|main)\]|\n\s*-\s*main\b)/.test(triggers);
  return workflowRunFromMain || deploymentStatusTrigger || mainPushTrigger;
}

let previousStart = -1;
for (const stage of orderedStages) {
  const job = workflowJob(containerWorkflow, stage);
  assert.ok(job.start > previousStart, `Deployment stage ${stage} is out of order.`);
  previousStart = job.start;
  requireText(job.text, requiredNeeds.get(stage), `${stage} must preserve its exact required needs relationship.`);
  if (stage !== "pre-merge-deployment-gate") {
    requireText(job.text, "github.event_name == 'pull_request'", `${stage} must be PR-only and must not run from a main push.`);
  }
}

for (const [jobName, deployJobName, targetType] of uiSmokeStages) {
  const job = workflowJob(containerWorkflow, jobName).text;
  if (jobName === "ui-smoke-vps-staging") {
    requireText(job, "run: node scripts/pr_vps_staging_qualification.mjs", `${jobName} must use the delegated infra qualification helper.`);
    requireText(job, "NUTSNEWS_VPS_STAGING_INFRA_RUN_ID", `${jobName} must bind to the infra staging deploy run.`);
    requireText(job, `NUTSNEWS_UI_SMOKE_TARGET_URL: \${{ needs.${deployJobName}.outputs.target_url }}`, `${jobName} must target the paired deploy job URL.`);
  } else {
    requireText(job, "working-directory: web", `${jobName} must run from web/.`);
    requireText(job, "run: node ../scripts/run_deployed_ui_smoke_with_evidence.mjs", `${jobName} must use the shared deployed UI smoke evidence runner.`);
    requireText(job, `PLAYWRIGHT_BASE_URL: \${{ needs.${deployJobName}.outputs.target_url }}`, `${jobName} must target the paired deploy job URL.`);
  }
  requireText(job, `NUTSNEWS_UI_SMOKE_TARGET_TYPE: ${targetType}`, `${jobName} must write comparable target_type evidence.`);
  requireText(job, `NUTSNEWS_UI_SMOKE_DEPLOYMENT_ID: \${{ needs.${deployJobName}.outputs.deployment_id }}`, `${jobName} must bind UI evidence to the paired deployment ID.`);
  requireText(job, "web/test-results/deployed-ui-smoke", `${jobName} must upload standardized UI smoke evidence.`);
}

for (const productionStage of ["deploy-vercel-production", "ui-smoke-vercel-production", "deploy-vps-production", "ui-smoke-vps-production"]) {
  const job = workflowJob(containerWorkflow, productionStage).text;
  requireText(job, "environment: Production", `${productionStage} must use the protected Production environment.`);
  requireText(job, "needs.trusted-pr-deployment-eligibility.outputs.eligible == 'true'", `${productionStage} must run only for trusted deployment-eligible PRs.`);
}

const finalGate = workflowJob(containerWorkflow, "pre-merge-deployment-gate").text;
requireText(finalGate, "if: always() && github.event_name == 'pull_request'", "Final gate must run and report red when upstream deployment jobs fail.");
requireText(finalGate, "PRE_MERGE_DEPLOYMENT_GATE_STAGES_JSON", "Final gate must validate structured stage results.");
for (const stage of orderedStages.slice(0, -1)) {
  requireText(finalGate, `"stage":"${stage}"`, `Final gate must validate ${stage} evidence.`);
  requireText(finalGate, `needs.${stage}.result`, `Final gate must inspect ${stage} job result.`);
}
requireText(finalGate, "node scripts/pre_merge_deployment_gate.mjs", "Final gate must run the evidence validator script.");

const workflowNames = (await readdir(workflowDir)).filter((name) => name.endsWith(".yml")).sort();
const unexpectedPostMainDeploymentTriggers = [];
const customMainMergeWorkflows = [];
for (const workflowName of workflowNames) {
  const workflowText = await readFile(resolve(workflowDir, workflowName), "utf8");
  if (/git\s+push[^\n]*(?:origin\s+)?main\b|gh\s+pr\s+merge|pulls\/\$\{[^}]+}\/merge|enable-pull-request-automerge|automerge-action/i.test(workflowText)) {
    customMainMergeWorkflows.push(workflowName);
  }
  if (!hasAutomaticPostMainDeploymentTrigger(workflowName, workflowText)) continue;
  const classification = inventoryClassification(workflowName);
  unexpectedPostMainDeploymentTriggers.push(`${workflowName} (${classification || "unclassified"})`);
}
assert.deepEqual(customMainMergeWorkflows, [], "Merge handoff must use maintainer merge or GitHub native auto-merge, not a custom workflow that pushes or merges to main.");
assert.deepEqual(
  unexpectedPostMainDeploymentTriggers,
  [],
  "Automatic post-main deployment triggers must be absent after pre-merge deployment gating.",
);

console.log("Pre-merge deployment workflow order regression passed.");
