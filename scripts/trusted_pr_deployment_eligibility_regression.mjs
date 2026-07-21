#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const containerWorkflow = await readFile(resolve(root, ".github/workflows/container-image.yml"), "utf8");
const contract = await readFile(resolve(root, ".github/deployment/pre-merge-deployment-gate-contract.md"), "utf8");
const workflowDir = resolve(root, ".github/workflows");
const workflowNames = (await readdir(workflowDir)).filter((name) => name.endsWith(".yml")).sort();

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

const eligibilityJob = workflowJob(containerWorkflow, "trusted-pr-deployment-eligibility");

requireText(eligibilityJob, "name: Trusted PR deployment eligibility", "Trusted PR eligibility check name must stay stable.");
requireText(eligibilityJob, "if: github.event_name == 'pull_request'", "Eligibility gate must run only for pull requests.");
requireText(eligibilityJob, "pull-requests: read", "Eligibility gate must use read-only pull request permissions.");
assert.doesNotMatch(eligibilityJob, /actions\/checkout|secrets\./, "Eligibility gate must not check out code or read secrets.");
requireText(eligibilityJob, "EVENT_HEAD_REPOSITORY", "Eligibility gate must read the event head repository.");
requireText(eligibilityJob, 'eventHeadRepository !== repository', "Eligibility gate must reject non-repository PR sources.");
requireText(eligibilityJob, 'currentHeadSha !== eventHeadSha', "Eligibility gate must reject stale PR heads.");
requireText(eligibilityJob, 'eligible=${eligible ? "true" : "false"}', "Eligibility gate must emit false output for skipped deployments.");
requireText(eligibilityJob, "Deployment eligibility: skipped", "Eligibility gate must write a clear skipped summary.");
requireText(eligibilityJob, "trusted_pr_head_sha", "Eligibility gate must expose the trusted PR head SHA.");

for (const workflowName of workflowNames) {
  const text = await readFile(resolve(workflowDir, workflowName), "utf8");
  assert.doesNotMatch(text, /pull_request_target:/, `${workflowName} must not use pull_request_target for deployment eligibility.`);
}

for (const fragment of [
  "Trusted PR Eligibility",
  "same-repository PR branches",
  "Fork PRs and other untrusted PR sources are not deployment-eligible.",
  "must re-check that the live PR head SHA still matches",
  "must not use `pull_request_target`",
]) {
  requireText(contract, fragment, `Pre-merge deployment contract must document trusted PR eligibility: ${fragment}`);
}

console.log("Trusted PR deployment eligibility regression passed.");
