#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = resolve(root, ".github/workflows");
const automaticReleaseWorkflow = await readFile(resolve(workflowDir, "automatic-production-release.yml"), "utf8");
const containerWorkflow = await readFile(resolve(workflowDir, "container-image.yml"), "utf8");
const vercelProductionWorkflow = await readFile(resolve(workflowDir, "vercel-production-release.yml"), "utf8");
const inventory = await readFile(resolve(root, ".github/deployment/workflow-check-inventory.md"), "utf8");

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

function workflowJob(text, name) {
  const marker = `  ${name}:\n`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `Workflow job not found: ${name}`);
  const rest = text.slice(start + marker.length);
  const next = rest.search(/\n  [A-Za-z0-9_-]+:\n/);
  return text.slice(start, next === -1 ? text.length : start + marker.length + next);
}

function triggerBlock(workflowText) {
  return workflowText.match(/(?:^|\n)on:[^\n]*\n([\s\S]*?)(?=\n[a-zA-Z_][A-Za-z0-9_-]*:|$)/)?.[1] ?? "";
}

function hasAutomaticPostMainDeploymentTrigger(workflowName, workflowText) {
  if (workflowName === "container-image.yml") return false;
  const triggers = triggerBlock(workflowText);
  const mutatesDeploymentTarget =
    /repos\/ramideltoro\/nutsnews-infra\/dispatches|vercel@latest deploy|CLOUDFLARE_PURGE_EVERYTHING|NUTSNEWS_INFRA_(?:STAGING|PRODUCTION)_TOKEN/.test(
      workflowText,
    );
  if (!mutatesDeploymentTarget) return false;

  const workflowRunFromMain = /workflow_run:/.test(triggers) && /head_branch\s*==\s*'main'/.test(workflowText);
  const deploymentStatusTrigger = /deployment_status:/.test(triggers);
  const mainPushTrigger =
    /push:[\s\S]*?branches:\s*(?:\[(?:"main"|main)\]|\n\s*-\s*main\b)/.test(triggers);
  return workflowRunFromMain || deploymentStatusTrigger || mainPushTrigger;
}

const publishJob = workflowJob(containerWorkflow, "publish");
requireText(
  publishJob,
  "if: github.event_name == 'push' && github.ref == 'refs/heads/main'",
  "Immutable release images must be published only for main pushes.",
);
requireText(
  publishJob,
  "Write automatic production release metadata",
  "The image workflow must create exact-candidate release metadata.",
);
requireText(
  publishJob,
  "Upload automatic production release metadata",
  "The image workflow must retain exact-candidate release metadata.",
);
assert.ok(
  publishJob.indexOf("Build and publish full-commit tag")
    < publishJob.indexOf("Write automatic production release metadata")
    && publishJob.indexOf("Write automatic production release metadata")
      < publishJob.indexOf("Upload automatic production release metadata"),
  "Immutable image publication must precede metadata creation and retention.",
);

requireText(
  automaticReleaseWorkflow,
  "workflows:\n      - Container Image",
  "Automatic production release must start only from Container Image completion.",
);
for (const condition of [
  "github.event.workflow_run.conclusion == 'success'",
  "github.event.workflow_run.event == 'push'",
  "github.event.workflow_run.head_branch == 'main'",
  "github.event.workflow_run.head_repository.full_name == github.repository",
]) {
  requireText(automaticReleaseWorkflow, condition, `Automatic production release must enforce ${condition}.`);
}
assert.doesNotMatch(
  automaticReleaseWorkflow,
  /^\s+environment:\s+(?:Production|production-vps)\b/m,
  "The automatic handoff must not access production environments.",
);
requireText(
  automaticReleaseWorkflow,
  "Automatic release metadata does not match the completed Container Image run.",
  "The handoff must fail closed on workflow-run metadata mismatch.",
);
requireText(
  automaticReleaseWorkflow,
  'event_type: "nutsnews-staging-release"',
  "The handoff must start with the protected staging release event.",
);

requireText(
  vercelProductionWorkflow,
  "on:\n  repository_dispatch:",
  "Vercel production must remain reachable only through protected repository dispatch.",
);
requireText(
  vercelProductionWorkflow,
  "staging_qualification_admin_backend_evidence.mjs",
  "Vercel production must verify staging qualification evidence.",
);
assert.ok(
  vercelProductionWorkflow.indexOf("Run staged Vercel qualification smoke")
    < vercelProductionWorkflow.indexOf("Promote staged Vercel deployment after qualification"),
  "Vercel staged smoke must pass before production promotion.",
);

requireText(
  inventory,
  "`automatic-production-release.yml` | automatic release",
  "Workflow inventory must classify the dedicated automatic release boundary.",
);
requireText(
  inventory,
  "`vercel-production-release.yml` | dispatch-only release",
  "Workflow inventory must classify the protected Vercel dispatch boundary.",
);

const workflowNames = (await readdir(workflowDir)).filter((name) => name.endsWith(".yml")).sort();
const automaticPostMainDeploymentTriggers = [];
const customMainMergeWorkflows = [];
for (const workflowName of workflowNames) {
  const workflowText = await readFile(resolve(workflowDir, workflowName), "utf8");
  if (
    /git\s+push[^\n]*(?:origin\s+)?main\b|gh\s+pr\s+merge|pulls\/\$\{[^}]+}\/merge|enable-pull-request-automerge|automerge-action/i.test(
      workflowText,
    )
  ) {
    customMainMergeWorkflows.push(workflowName);
  }
  if (hasAutomaticPostMainDeploymentTrigger(workflowName, workflowText)) {
    automaticPostMainDeploymentTriggers.push(workflowName);
  }
}

assert.deepEqual(
  customMainMergeWorkflows,
  [],
  "GitHub native maintainer merge must remain the only way workflows update main.",
);
assert.deepEqual(
  automaticPostMainDeploymentTriggers,
  ["automatic-production-release.yml"],
  "Exactly one reviewed workflow must own automatic deployment after main.",
);

console.log("Automatic main deployment workflow order regression passed.");
