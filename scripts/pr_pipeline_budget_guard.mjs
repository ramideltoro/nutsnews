#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = resolve(root, ".github/workflows");
const inventoryPath = resolve(root, ".github/deployment/workflow-check-inventory.md");

const defaultPrWorkflowBudget = 8;
const recommendedDefaultPrWorkflowMinimum = 5;
const protectedEnvironmentPattern =
  /(?:^|\n)\s*environment:\s*(?:(?:"|')?(?:Production|production|production-supabase|staging-supabase)(?:"|')?|\n\s+name:\s*(?:"|')?(?:Production|production|production-supabase|staging-supabase)(?:"|')?)/;
const heavyweightWorkflowPattern =
  /(accessibility|cache-observability|codeql|container|deploy|deployment|e2e|lighthouse|osv|playwright|release|smoke|snyk|visual)/i;
const buildOwnerPatterns = [
  /\bnpx\s+tsc\s+--noEmit\b/,
  /\bnpm\s+run\s+build\b/,
  /\bnpm\s+run\s+lint\b/,
  /\bnpm\s+run\s+typecheck\b/,
];

function workflowTriggerBlock(workflow, trigger) {
  const match = workflow.match(new RegExp(`(?:^|\\n)  ${trigger}:([\\s\\S]*?)(?=\\n  [a-z_]+:|\\n[a-zA-Z_]+:|$)`));
  return match?.[1] ?? "";
}

function hasTrigger(workflow, trigger) {
  return new RegExp(`(?:^|\\n)  ${trigger}:`).test(workflow);
}

function hasPathConstraint(triggerBlock) {
  return /(?:^|\n)\s+(?:paths|paths-ignore):/.test(triggerBlock);
}

function pullRequestTypes(triggerBlock) {
  const inline = triggerBlock.match(/(?:^|\n)\s+types:\s*\[([^\]]+)\]/);
  if (inline) {
    return inline[1]
      .split(",")
      .map((value) => value.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }

  const multiline = triggerBlock.match(/(?:^|\n)\s+types:\s*\n((?:\s+-\s+\S+\s*\n?)*)/);
  if (!multiline) return [];

  return multiline[1]
    .split("\n")
    .map((line) => line.trim().replace(/^-\s+/, "").replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function isLabelTriggered(triggerBlock, workflow) {
  const types = pullRequestTypes(triggerBlock);
  const labelOnlyTypes = types.length > 0 && types.every((type) => type === "labeled");
  return (
    labelOnlyTypes ||
    workflow.includes("github.event.label.name") ||
    workflow.includes("github.event.pull_request.labels") ||
    workflow.includes("labels.*.name")
  );
}

function ownsBuildTypecheckOrLint(workflow) {
  return buildOwnerPatterns.some((pattern) => pattern.test(workflow));
}

function workflowName(workflow) {
  return workflow.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? "";
}

function fail(message, details = []) {
  console.error(`::error title=PR pipeline budget::${message}`);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exitCode = 1;
}

const inventory = await readFile(inventoryPath, "utf8");
if (!inventory.includes("## PR Pipeline Budget")) {
  fail("Workflow inventory must document the PR pipeline budget policy.");
}

const workflowFiles = (await readdir(workflowDir)).filter((file) => file.endsWith(".yml")).sort();
const workflows = [];

for (const file of workflowFiles) {
  const text = await readFile(resolve(workflowDir, file), "utf8");
  const name = workflowName(text);
  const pullRequestBlock = workflowTriggerBlock(text, "pull_request");
  const hasPullRequest = hasTrigger(text, "pull_request");
  const pathConstrained = hasPathConstraint(pullRequestBlock);
  const labelTriggered = hasPullRequest && isLabelTriggered(pullRequestBlock, text);
  const defaultPrTriggered = hasPullRequest && !pathConstrained && !labelTriggered;

  workflows.push({
    file,
    name,
    text,
    hasPullRequest,
    pathConstrained,
    labelTriggered,
    defaultPrTriggered,
    heavyweight: heavyweightWorkflowPattern.test(file) || heavyweightWorkflowPattern.test(name),
    protectedEnvironment: protectedEnvironmentPattern.test(text),
    buildOwner: ownsBuildTypecheckOrLint(text),
    scheduled: hasTrigger(text, "schedule"),
    manual: hasTrigger(text, "workflow_dispatch"),
  });
}

const defaultPrWorkflows = workflows.filter((workflow) => workflow.defaultPrTriggered);
const defaultBuildOwners = defaultPrWorkflows.filter((workflow) => workflow.buildOwner);
const protectedPrWorkflows = workflows.filter((workflow) => workflow.hasPullRequest && workflow.protectedEnvironment);
const unconstrainedHeavyweightPrWorkflows = workflows.filter(
  (workflow) => workflow.hasPullRequest && workflow.heavyweight && !workflow.pathConstrained && !workflow.labelTriggered,
);

console.log("PR pipeline budget guard");
console.log(`Default PR-triggered workflows: ${defaultPrWorkflows.length}/${defaultPrWorkflowBudget}`);
for (const workflow of defaultPrWorkflows) {
  console.log(`- ${workflow.file}`);
}

if (defaultPrWorkflows.length < recommendedDefaultPrWorkflowMinimum) {
  console.log(
    `Default PR-triggered workflows are below the recommended ${recommendedDefaultPrWorkflowMinimum}-${defaultPrWorkflowBudget} range; this is allowed because the budget is enforced as a maximum.`,
  );
}

if (defaultPrWorkflows.length > defaultPrWorkflowBudget) {
  fail(
    `Default PR-triggered workflows exceeded the ${defaultPrWorkflowBudget} workflow budget.`,
    defaultPrWorkflows.map((workflow) => workflow.file),
  );
}

if (protectedPrWorkflows.length > 0) {
  fail(
    "PR-triggered workflows must not use protected production or deployment environments.",
    protectedPrWorkflows.map((workflow) => workflow.file),
  );
}

if (defaultBuildOwners.length > 1) {
  fail(
    "Only one default PR workflow may own TypeScript, lint, or build failures.",
    defaultBuildOwners.map((workflow) => workflow.file),
  );
}

if (unconstrainedHeavyweightPrWorkflows.length > 0) {
  fail(
    "Heavyweight PR workflows must be path-filtered, label-triggered, scheduled, or manual-only.",
    unconstrainedHeavyweightPrWorkflows.map((workflow) => workflow.file),
  );
}

if (process.exitCode) {
  process.exit();
}

const targetedPrWorkflows = workflows.filter((workflow) => workflow.hasPullRequest && workflow.pathConstrained);
const nonPrOperationalWorkflows = workflows.filter((workflow) => !workflow.hasPullRequest && (workflow.scheduled || workflow.manual));

console.log(`Path-filtered PR workflows: ${targetedPrWorkflows.length}`);
console.log(`Scheduled/manual non-PR workflows: ${nonPrOperationalWorkflows.length}`);
console.log("PR pipeline budget guard passed.");
