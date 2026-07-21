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
  "default-branch/manual",
  "scheduled/operational",
  "manual recovery",
  "dispatch-only recovery",
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

assert.ok(inventory.includes("issue #333"), "Inventory must reference branch protection issue #333.");
assert.ok(inventory.includes("`Merge Gate`"), "Inventory must name the required branch-protection check.");
assert.ok(inventory.includes("`Release candidate` is no longer a direct branch-protection check"), "Inventory must document removing the Release candidate aggregate check from branch protection.");
assert.ok(
  inventory.includes("No deployment work is hidden inside a workflow classified as an existing check."),
  "Inventory must state that deployment work is not hidden inside existing checks.",
);
assert.equal(rows.size, workflowFiles.length, "Inventory must contain exactly one row for every workflow.");
assert.equal(
  [...rows.values()].filter((row) => row.classification === "deprecated post-main work").length,
  0,
  "Post-main deployment workflows must be removed or rewired behind recovery paths.",
);
assert.match(
  rows.get("container-image.yml")?.reason ?? "",
  /main pushes or operator dispatches.*Ordinary PRs no longer enter the container\/release workflow/,
  "Container Image inventory row must document that ordinary PRs no longer run it.",
);
assert.equal(
  rows.get("lighthouse-ci.yml")?.classification,
  "scheduled/operational",
  "Lighthouse CI must stay out of default PR-required checks.",
);
assert.equal(
  rows.get("homepage-performance-budget.yml")?.classification,
  "PR-required",
  "Homepage Performance Budget must remain the merge-critical performance check.",
);

const accessibilityWorkflow = await readFile(resolve(workflowDir, "accessibility-ci.yml"), "utf8");
const accessibilityPullRequest = workflowTriggerBlock(accessibilityWorkflow, "pull_request");
assert.ok(accessibilityPullRequest.includes("paths:"), "Accessibility CI pull_request trigger must be path-filtered.");
assert.ok(accessibilityPullRequest.includes("web/app/**/*.tsx"), "Accessibility CI must run for app UI changes.");
assert.ok(accessibilityPullRequest.includes("web/tests/accessibility.spec.ts"), "Accessibility CI must run for accessibility test changes.");
assert.ok(
  !accessibilityPullRequest.includes("web/package"),
  "Accessibility CI must not run for dependency-only package changes by default.",
);

const visualRegressionWorkflow = await readFile(resolve(workflowDir, "visual-regression.yml"), "utf8");
const visualRegressionPush = workflowTriggerBlock(visualRegressionWorkflow, "push");
const visualRegressionPullRequest = workflowTriggerBlock(visualRegressionWorkflow, "pull_request");
for (const [triggerName, triggerBlock] of [
  ["push", visualRegressionPush],
  ["pull_request", visualRegressionPullRequest],
]) {
  assert.ok(triggerBlock.includes("paths:"), `Visual Regression ${triggerName} trigger must be path-filtered.`);
  assert.ok(
    !triggerBlock.includes('"web/**"') && !triggerBlock.includes("'web/**'"),
    `Visual Regression ${triggerName} trigger must not run for every web change.`,
  );
  assert.ok(triggerBlock.includes("web/public/**"), `Visual Regression ${triggerName} trigger must cover public assets.`);
  assert.ok(
    triggerBlock.includes("web/tests/visual-regression.spec.ts"),
    `Visual Regression ${triggerName} trigger must cover visual test changes.`,
  );
}

const publicReaderSmokeWorkflow = await readFile(resolve(workflowDir, "public-reader-smoke.yml"), "utf8");
const publicReaderSmokePush = workflowTriggerBlock(publicReaderSmokeWorkflow, "push");
assert.ok(publicReaderSmokePush.includes("paths:"), "Public Reader Smoke push trigger must be path-filtered.");
assert.ok(publicReaderSmokePush.includes("web/**"), "Public Reader Smoke push trigger must cover web changes.");
assert.ok(
  publicReaderSmokePush.includes("scripts/web_public_reader_smoke.mjs"),
  "Public Reader Smoke push trigger must cover its smoke harness.",
);

assert.equal(
  rows.get("cloudflare-cache-config.yml")?.classification,
  "PR-required",
  "Cloudflare Cache Config must be the PR-required deterministic cache check.",
);
assert.equal(
  rows.get("cloudflare-cache-observability.yml")?.classification,
  "scheduled/operational",
  "Cloudflare Cache Observability live probes must stay out of PR-required checks.",
);
const cloudflareCacheConfigWorkflow = await readFile(resolve(workflowDir, "cloudflare-cache-config.yml"), "utf8");
assert.ok(hasTrigger(cloudflareCacheConfigWorkflow, "pull_request"), "Cloudflare Cache Config must run on pull_request.");
assert.ok(
  cloudflareCacheConfigWorkflow.includes("npm run audit:cache:config"),
  "Cloudflare Cache Config must run deterministic config validation.",
);
assert.ok(
  cloudflareCacheConfigWorkflow.includes("npm run test:public-cache"),
  "Cloudflare Cache Config must run deterministic public cache policy regression.",
);
assert.ok(
  !cloudflareCacheConfigWorkflow.includes('npm run audit:cache -- --url "$NUTSNEWS_CACHE_OBSERVABILITY_URL"'),
  "Cloudflare Cache Config must not call live production URLs.",
);
const cloudflareCacheObservabilityWorkflow = await readFile(resolve(workflowDir, "cloudflare-cache-observability.yml"), "utf8");
assert.ok(
  !hasTrigger(cloudflareCacheObservabilityWorkflow, "pull_request"),
  "Cloudflare Cache Observability live probes must not run on pull_request.",
);
assert.ok(hasTrigger(cloudflareCacheObservabilityWorkflow, "schedule"), "Cloudflare Cache Observability must remain scheduled.");
assert.ok(
  cloudflareCacheObservabilityWorkflow.includes('npm run audit:cache -- --url "$NUTSNEWS_CACHE_OBSERVABILITY_URL"'),
  "Cloudflare Cache Observability must keep the live cache probe.",
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
    assert.equal(protectedDeploymentEnvironment, false, `${workflow} is PR-required but uses a protected deployment environment.`);
  }

  if (row.classification === "optional PR") {
    assert.ok(pullRequest || deploymentStatus, `${workflow} is optional PR but has no PR or deployment-status trigger.`);
  }

  if (row.classification === "default-branch/manual") {
    assert.ok(!pullRequest, `${workflow} is default-branch/manual but still has a pull_request trigger.`);
    assert.ok(!deploymentStatus, `${workflow} is default-branch/manual but listens to deployment_status.`);
    assert.ok(!repositoryDispatch, `${workflow} is default-branch/manual but listens to repository_dispatch.`);
    assert.ok(!workflowRun, `${workflow} is default-branch/manual but listens to workflow_run.`);
    assert.ok(mainPush || workflowDispatch, `${workflow} is default-branch/manual but has no main push or manual trigger.`);
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

  if (row.classification === "dispatch-only recovery") {
    assert.ok(repositoryDispatch, `${workflow} is dispatch-only recovery but has no repository_dispatch trigger.`);
    assert.ok(!workflowDispatch, `${workflow} is dispatch-only recovery but exposes workflow_dispatch.`);
    assert.ok(!pullRequest, `${workflow} is dispatch-only recovery but runs on pull_request.`);
    assert.ok(!mainPush, `${workflow} is dispatch-only recovery but runs after main pushes.`);
    assert.ok(!workflowRun, `${workflow} is dispatch-only recovery but listens to workflow_run.`);
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
    `${workflow} runs after main pushes without a PR trigger; remove the main push trigger or make it a non-deployment PR workflow.`,
  );
}

console.log("Workflow check inventory regression passed.");
