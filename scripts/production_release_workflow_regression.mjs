#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = resolve(root, ".github/workflows");
const containerWorkflow = await readFile(resolve(workflowDir, "container-image.yml"), "utf8");
const databaseWorkflow = await readFile(resolve(workflowDir, "database-migration-gate.yml"), "utf8");
const inventory = await readFile(resolve(root, ".github/deployment/workflow-check-inventory.md"), "utf8");
const recoveryRunbook = await readFile(resolve(root, ".github/deployment/environments-secrets-recovery.md"), "utf8");

const removedPrJobs = [
  "trusted-pr-deployment-eligibility",
  "pr-release-artifact",
  "deploy-vps-staging",
  "ui-smoke-vps-staging",
  "deploy-vercel-staging",
  "ui-smoke-vercel-staging",
  "deploy-vercel-production",
  "ui-smoke-vercel-production",
  "deploy-vps-production",
  "ui-smoke-vps-production",
  "pre-merge-deployment-gate",
  "release-candidate",
];

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

assert.doesNotMatch(containerWorkflow, /^\s+pull_request:/m, "Container Image must not run for ordinary pull requests.");
requireText(containerWorkflow, "push:\n    branches: [main]", "Container Image must still run from main pushes.");
requireText(containerWorkflow, "workflow_dispatch:", "Container Image must support explicit operator dispatch.");
requireText(containerWorkflow, "cancel-in-progress: false", "Main image archive runs must not cancel each other implicitly.");
assert.doesNotMatch(containerWorkflow, /github\.event\.pull_request/, "Container Image must not depend on pull request event payloads.");
assert.doesNotMatch(containerWorkflow, /^\s+environment:\s+Production\b/m, "Container Image must not invoke the protected Production environment.");
assert.doesNotMatch(containerWorkflow, /^  migration-gate:/m, "Container Image must not own database migration validation.");

for (const job of removedPrJobs) {
  assert.doesNotMatch(containerWorkflow, new RegExp(`^  ${job}:`, "m"), `Container Image must not contain removed PR job ${job}.`);
}

const buildTest = workflowJob(containerWorkflow, "build-test");
requireText(buildTest, "name: Build and smoke-test production image", "Container Image must keep image build and smoke coverage.");
requireText(buildTest, "docker build", "Container Image must still build the web image.");
requireText(buildTest, "docker push \"$IMAGE_TAG\"", "Container Image must still verify the image through a registry round trip.");
requireText(buildTest, "node scripts/dual_target_web_smoke.mjs", "Container Image must still smoke the built image.");

const publish = workflowJob(containerWorkflow, "publish");
requireText(publish, "name: Publish immutable image", "Container Image must still publish immutable images.");
requireText(publish, "if: github.event_name == 'push' && github.ref == 'refs/heads/main'", "Image publishing must be main-push only.");
requireText(publish, "needs: [build-test]", "Image publishing must depend only on the image build and smoke job.");
requireText(publish, "packages: write", "Image publishing must retain package write permission.");
requireText(publish, "ghcr.io/ramideltoro/nutsnews:${{ github.sha }}", "Image publishing must tag with the full source commit.");
requireText(publish, "push: true", "Image publishing must push the immutable image.");
requireText(publish, "Deployment role: archive only; deployment validation is manual or explicit release-only.", "Image summary must not describe PR deployments.");

requireText(inventory, "`container-image.yml` | default-branch/manual", "Inventory must classify Container Image outside PR-required checks.");
requireText(inventory, "Ordinary PRs no longer enter the container/release workflow", "Inventory must document the removed PR container path.");
requireText(inventory, "`database-migration-gate.yml` | PR-required", "Inventory must classify Database Migration Gate as the database PR check.");
requireText(recoveryRunbook, "Normal PR merges do not deploy", "Recovery docs must document the new non-deploying merge behavior.");
requireText(databaseWorkflow, "name: Database Migration Gate", "Database workflow must have a stable check name.");
requireText(databaseWorkflow, "pull_request:", "Database workflow must still run for migration PRs.");
requireText(databaseWorkflow, "paths:", "Database workflow must be path-filtered.");
requireText(databaseWorkflow, "supabase/**", "Database workflow must run for Supabase migration changes.");
requireText(databaseWorkflow, "supabase db reset --local", "Database workflow must reset a disposable database.");
requireText(databaseWorkflow, "node scripts/verify_migration_schema.mjs --negative-drift", "Database workflow must verify migration drift.");
requireText(databaseWorkflow, "node scripts/verify_migration_lock.mjs", "Database workflow must verify advisory-lock serialization.");
requireText(databaseWorkflow, "node scripts/staging_fixtures.mjs exercise --local", "Database workflow must validate staging fixtures.");
requireText(databaseWorkflow, "node scripts/supabase_rls_regression.mjs", "Database workflow must validate RLS policies.");
requireText(databaseWorkflow, "tests/staging-migration-request.test.mjs", "Database workflow must run staging migration request tests.");
requireText(databaseWorkflow, "tests/production-migration-request.test.mjs", "Database workflow must run production migration request tests.");

const workflowNames = (await readdir(workflowDir)).filter((name) => name.endsWith(".yml")).sort();
const unexpectedPostMainDeploymentTriggers = [];
const customMainMergeWorkflows = [];
for (const workflowName of workflowNames) {
  const workflowText = await readFile(resolve(workflowDir, workflowName), "utf8");
  if (/git\s+push[^\n]*(?:origin\s+)?main\b|gh\s+pr\s+merge|pulls\/\$\{[^}]+}\/merge|enable-pull-request-automerge|automerge-action/i.test(workflowText)) {
    customMainMergeWorkflows.push(workflowName);
  }
  if (hasAutomaticPostMainDeploymentTrigger(workflowName, workflowText)) {
    unexpectedPostMainDeploymentTriggers.push(workflowName);
  }
}

assert.deepEqual(customMainMergeWorkflows, [], "Merge handoff must use maintainer merge or GitHub native auto-merge, not a custom workflow that pushes or merges to main.");
assert.deepEqual(unexpectedPostMainDeploymentTriggers, [], "Deployment/recovery workflows must not run automatically after main pushes.");

console.log("Production release workflow regression passed.");
