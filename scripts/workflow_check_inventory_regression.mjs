#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = resolve(root, ".github/workflows");
const inventoryPath = resolve(root, ".github/deployment/workflow-check-inventory.md");
const inventory = await readFile(inventoryPath, "utf8");
const workflowFiles = (await readdir(workflowDir)).filter((file) => file.endsWith(".yml")).sort();
const allowedClassifications = new Set([
  "PR-required",
  "optional PR",
  "scheduled/operational",
  "manual recovery",
  "deprecated post-main work",
]);

function workflowTriggerBlock(workflow, trigger) {
  const match = workflow.match(new RegExp(`(?:^|\\n)  ${trigger}:([\\s\\S]*?)(?=\\n  [a-z_]+:|\\n[a-zA-Z_]+:|$)`));
  return match?.[1] ?? "";
}

function hasMainPush(workflow) {
  const push = workflowTriggerBlock(workflow, "push");
  return /branches:\\s*\\[(?:"main"|main)\\]/.test(push) || /branches:\\s*\\n\\s*-\\s*main\\b/.test(push);
}

function hasTrigger(workflow, trigger) {
  return new RegExp(`(?:^|\\n)  ${trigger}:`).test(workflow);
}

const rows = new Map();
for (const match of inventory.matchAll(/^\| `([^`]+\.yml)` \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \|$/gm)) {
  const [, workflow, classification, reason, deploymentNote] = match;
  assert.ok(!rows.has(workflow), `Duplicate workflow inventory row for ${workflow}.`);
  rows.set(workflow, {
    classification: classification.trim(),
    reason: reason.trim(),
    deploymentNote: deploymentNote.trim(),
  });
}

assert.ok(inventory.includes("issue #310"), "Inventory must reference branch protection issue #310.");
assert.ok(inventory.includes("Pre-merge deployment gate"), "Inventory must name the final required branch-protection check.");
assert.ok(inventory.includes("intentionally retain `Release candidate`"), "Inventory must document retaining the Release candidate aggregate check.");
assert.ok(
  inventory.includes("No deployment work is hidden inside a workflow classified as an existing check."),
  "Inventory must state that deployment work is not hidden inside existing checks.",
);
assert.equal(rows.size, workflowFiles.length, "Inventory must contain exactly one row for every workflow.");
assert.match(
  rows.get("container-image.yml")?.reason ?? "",
  /immutable PR artifact.*Pre-merge deployment gate.*VPS staging deploy.*VPS staging UI smoke.*Vercel staging deploy.*Vercel staging UI smoke.*Vercel production deploy.*Vercel production UI smoke.*VPS production deploy.*VPS production UI smoke/,
  "Container Image inventory row must explicitly mention all trusted PR deployment stages wired so far.",
);
assert.match(
  rows.get("container-image.yml")?.deploymentNote ?? "",
  /trusted PR candidate to VPS staging, Vercel staging, Vercel production, and VPS production.*shared UI smoke evidence after each deployed target.*aggregate final gate/,
  "Container Image inventory row must identify every deployment target wired so far.",
);

for (const workflow of workflowFiles) {
  const row = rows.get(workflow);
  assert.ok(row, `Inventory is missing ${workflow}.`);
  assert.ok(allowedClassifications.has(row.classification), `${workflow} has invalid classification ${row.classification}.`);
  assert.notEqual(row.reason, "", `${workflow} must explain its classification.`);
  assert.notEqual(row.deploymentNote, "", `${workflow} must include a deployment note.`);

  const text = await readFile(resolve(workflowDir, workflow), "utf8");
  const pullRequest = hasTrigger(text, "pull_request");
  const deploymentStatus = hasTrigger(text, "deployment_status");
  const repositoryDispatch = hasTrigger(text, "repository_dispatch");
  const workflowRun = hasTrigger(text, "workflow_run");
  const workflowDispatch = hasTrigger(text, "workflow_dispatch");
  const mainPush = hasMainPush(text);

  if (row.classification === "PR-required") {
    assert.ok(pullRequest, `${workflow} is PR-required but does not run on pull_request.`);
    assert.ok(!deploymentStatus, `${workflow} is PR-required but listens to deployment_status.`);
    assert.ok(!repositoryDispatch, `${workflow} is PR-required but listens to repository_dispatch.`);
    assert.ok(!workflowRun, `${workflow} is PR-required but listens to workflow_run.`);
    const protectedDeploymentEnvironment = /environment:\s*(Production|production-supabase|staging-supabase)/.test(text);
    if (workflow === "container-image.yml") {
      assert.ok(
        protectedDeploymentEnvironment,
        "Container Image must explicitly use the protected Production environment for the pre-merge Vercel production deploy stage.",
      );
    } else {
      assert.equal(protectedDeploymentEnvironment, false, `${workflow} is PR-required but uses a protected deployment environment.`);
    }
  }

  if (row.classification === "optional PR") {
    assert.ok(pullRequest || deploymentStatus, `${workflow} is optional PR but has no PR or deployment-status trigger.`);
  }

  if (row.classification === "scheduled/operational") {
    assert.ok(!pullRequest, `${workflow} is scheduled/operational but still has a pull_request trigger.`);
    assert.ok(!mainPush, `${workflow} is scheduled/operational but still runs after main pushes.`);
    assert.ok(
      workflowDispatch || hasTrigger(text, "schedule") || workflowTriggerBlock(text, "push").includes("tags:"),
      `${workflow} is scheduled/operational but has no schedule, tag, or manual trigger.`,
    );
  }

  if (row.classification === "manual recovery") {
    assert.ok(workflowDispatch, `${workflow} is manual recovery but has no workflow_dispatch trigger.`);
    assert.ok(!pullRequest, `${workflow} is manual recovery but runs on pull_request.`);
    assert.ok(!mainPush, `${workflow} is manual recovery but runs after main pushes.`);
  }

  if (row.classification === "deprecated post-main work") {
    assert.ok(!pullRequest, `${workflow} is deprecated post-main work but runs on pull_request.`);
    assert.ok(
      deploymentStatus || repositoryDispatch || workflowRun,
      `${workflow} is deprecated post-main work but has no deployment, dispatch, or workflow_run trigger.`,
    );
  }

  assert.ok(
    !mainPush || pullRequest,
    `${workflow} runs after main pushes without a PR trigger; classify it as deprecated post-main work or remove the main push trigger.`,
  );
}

console.log("Workflow check inventory regression passed.");
