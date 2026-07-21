#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DeploymentValidationError, fetchJsonWithRetry } from "./deployment_hardening.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const preMergeDeploymentStages = Object.freeze([
  {
    stage: "deploy-vps-staging",
    label: "Deploy PR candidate to VPS staging",
    kind: "deploy",
    target_type: "vps-staging",
    runtime_env: "staging",
    deployment_target: "vps-staging",
  },
  {
    stage: "ui-smoke-vps-staging",
    label: "Run shared UI smoke suite against VPS staging",
    kind: "ui",
    target_type: "vps-staging",
  },
  {
    stage: "deploy-vercel-staging",
    label: "Deploy PR candidate to Vercel staging",
    kind: "deploy",
    target_type: "vercel-staging",
    runtime_env: "staging",
    deployment_target: "vercel-staging",
  },
  {
    stage: "ui-smoke-vercel-staging",
    label: "Run shared UI smoke suite against Vercel staging",
    kind: "ui",
    target_type: "vercel-staging",
  },
  {
    stage: "deploy-vercel-production",
    label: "Deploy PR candidate to Vercel production",
    kind: "deploy",
    target_type: "vercel-production",
    runtime_env: "production",
    deployment_target: "vercel-production",
  },
  {
    stage: "ui-smoke-vercel-production",
    label: "Run shared UI smoke suite against Vercel production",
    kind: "ui",
    target_type: "vercel-production",
  },
  {
    stage: "deploy-vps-production",
    label: "Deploy PR candidate to VPS production",
    kind: "deploy",
    target_type: "production-vps",
    runtime_env: "production",
    deployment_target: "production-vps",
  },
  {
    stage: "ui-smoke-vps-production",
    label: "Run shared UI smoke suite against VPS production",
    kind: "ui",
    target_type: "production-vps",
  },
]);

function clean(value) {
  return String(value ?? "").trim();
}

function requirePattern(value, pattern, message) {
  const text = clean(value);
  if (!pattern.test(text)) throw new DeploymentValidationError(message);
  return text;
}

function requireField(object, field, message = `${field} is required.`) {
  const value = clean(object?.[field]);
  if (!value) throw new DeploymentValidationError(message);
  return value;
}

function requireHttpsOrHttpUrl(value, label) {
  const text = clean(value);
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported protocol");
    return url.toString();
  } catch {
    throw new DeploymentValidationError(`${label} must be an http or https URL.`);
  }
}

function parseJson(value, label) {
  try {
    return JSON.parse(clean(value));
  } catch {
    throw new DeploymentValidationError(`${label} is missing or malformed JSON.`);
  }
}

export function parseGateStageInputs(stagesJson) {
  const rawStages = parseJson(stagesJson, "PRE_MERGE_DEPLOYMENT_GATE_STAGES_JSON");
  if (!Array.isArray(rawStages)) throw new DeploymentValidationError("Pre-merge deployment gate stages must be an array.");
  const byStage = new Map();
  const knownStages = new Set(preMergeDeploymentStages.map((stage) => stage.stage));
  for (const rawStage of rawStages) {
    const stage = clean(rawStage?.stage);
    if (!stage) throw new DeploymentValidationError("Every pre-merge deployment gate stage input must name a stage.");
    if (!knownStages.has(stage)) throw new DeploymentValidationError(`Unknown pre-merge deployment gate stage input: ${stage}.`);
    if (byStage.has(stage)) throw new DeploymentValidationError(`Duplicate pre-merge deployment gate stage input: ${stage}.`);
    byStage.set(stage, rawStage);
  }

  return preMergeDeploymentStages.map((definition, index) => {
    const input = byStage.get(definition.stage);
    if (!input) throw new DeploymentValidationError(`Missing pre-merge deployment gate stage input: ${definition.stage}.`);
    return {
      ...definition,
      order: index + 1,
      job_result: clean(input.job_result),
      artifact_name: clean(input.artifact_name),
    };
  });
}

function listFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
  }
  return files;
}

function readEvidenceFile(artifactDir) {
  const matches = listFiles(artifactDir).filter((file) => file.endsWith("/evidence.json"));
  if (matches.length !== 1) {
    throw new DeploymentValidationError(`Expected exactly one evidence.json in ${artifactDir}, found ${matches.length}.`);
  }
  return parseJson(readFileSync(matches[0], "utf8"), `${matches[0]}`);
}

function artifactLink(repository, runId, artifact) {
  const artifactId = clean(artifact?.id);
  if (!artifactId) return "";
  return `https://github.com/${repository}/actions/runs/${runId}/artifacts/${artifactId}`;
}

function validateStageResult(stage) {
  if (stage.job_result !== "success") {
    throw new DeploymentValidationError(`${stage.stage} concluded ${stage.job_result || "missing"}; final pre-merge deployment gate requires success.`);
  }
  if (!stage.artifact_name) {
    throw new DeploymentValidationError(`${stage.stage} did not expose an evidence artifact name.`);
  }
}

function expectedResult(stage) {
  return stage.kind === "ui" ? "pass" : "success";
}

function validateStageEvidence({ stage, evidence, expectedSourceCommit, expectedBuildId, prNumber, runId, runAttempt, repository, artifact }) {
  const evidenceSourceCommit = requireField(evidence, "source_commit", `${stage.stage} evidence is missing source_commit.`);
  if (evidenceSourceCommit !== expectedSourceCommit) {
    throw new DeploymentValidationError(`${stage.stage} evidence is stale: expected source_commit ${expectedSourceCommit}, received ${evidenceSourceCommit}.`);
  }

  const evidenceBuildId = requireField(evidence, "build_id", `${stage.stage} evidence is missing build_id.`);
  if (evidenceBuildId !== expectedBuildId) {
    throw new DeploymentValidationError(`${stage.stage} evidence build_id mismatch: expected ${expectedBuildId}, received ${evidenceBuildId}.`);
  }

  const evidencePrNumber = clean(evidence.pr_number);
  if (evidencePrNumber && evidencePrNumber !== prNumber) {
    throw new DeploymentValidationError(`${stage.stage} evidence PR mismatch: expected ${prNumber}, received ${evidencePrNumber}.`);
  }

  const evidenceRunId = requireField(evidence, "workflow_run_id", `${stage.stage} evidence is missing workflow_run_id.`);
  if (evidenceRunId !== runId) {
    throw new DeploymentValidationError(`${stage.stage} evidence workflow_run_id mismatch: expected ${runId}, received ${evidenceRunId}.`);
  }
  const evidenceRunAttempt = requireField(evidence, "workflow_run_attempt", `${stage.stage} evidence is missing workflow_run_attempt.`);
  if (evidenceRunAttempt !== runAttempt) {
    throw new DeploymentValidationError(`${stage.stage} evidence workflow_run_attempt mismatch: expected ${runAttempt}, received ${evidenceRunAttempt}.`);
  }

  const result = requireField(evidence, "result", `${stage.stage} evidence is missing result.`);
  if (result !== expectedResult(stage)) {
    throw new DeploymentValidationError(`${stage.stage} evidence result mismatch: expected ${expectedResult(stage)}, received ${result}.`);
  }

  const targetType = requireField(evidence, "target_type", `${stage.stage} evidence is missing target_type.`);
  if (targetType !== stage.target_type) {
    throw new DeploymentValidationError(`${stage.stage} evidence target_type mismatch: expected ${stage.target_type}, received ${targetType}.`);
  }

  const targetUrl = requireHttpsOrHttpUrl(evidence.target_url, `${stage.stage} target_url`);
  const deploymentId = requireField(evidence, "deployment_id", `${stage.stage} evidence is missing deployment_id.`);

  if (stage.kind === "deploy") {
    const evidenceStage = requireField(evidence, "stage", `${stage.stage} deploy evidence is missing stage.`);
    if (evidenceStage !== stage.stage) {
      throw new DeploymentValidationError(`${stage.stage} deploy evidence stage mismatch: received ${evidenceStage}.`);
    }
    const runtimeEnv = requireField(evidence, "runtime_env", `${stage.stage} deploy evidence is missing runtime_env.`);
    if (runtimeEnv !== stage.runtime_env) {
      throw new DeploymentValidationError(`${stage.stage} deploy evidence runtime_env mismatch: expected ${stage.runtime_env}, received ${runtimeEnv}.`);
    }
    const deploymentTarget = requireField(evidence, "deployment_target", `${stage.stage} deploy evidence is missing deployment_target.`);
    if (deploymentTarget !== stage.deployment_target) {
      throw new DeploymentValidationError(
        `${stage.stage} deploy evidence deployment_target mismatch: expected ${stage.deployment_target}, received ${deploymentTarget}.`,
      );
    }
    requirePattern(evidence.image_digest, /^sha256:[0-9a-f]{64}$/, `${stage.stage} deploy evidence image_digest must be immutable.`);
  } else if (!evidence.artifact_paths?.evidence_json) {
    throw new DeploymentValidationError(`${stage.stage} UI smoke evidence must include artifact_paths.evidence_json.`);
  }

  return {
    order: stage.order,
    stage: stage.stage,
    label: stage.label,
    target_type: targetType,
    target_url: targetUrl,
    deployment_id: deploymentId,
    result,
    artifact_name: stage.artifact_name,
    artifact_url: artifactLink(repository, runId, artifact),
  };
}

export function validatePreMergeDeploymentEvidence({
  stages,
  evidenceRoot,
  expectedSourceCommit,
  expectedBuildId,
  currentPrHeadSha,
  prNumber,
  runId,
  runAttempt,
  repository = "ramideltoro/nutsnews",
  artifactsByName = new Map(),
}) {
  const sourceCommit = requirePattern(expectedSourceCommit, /^[0-9a-f]{40}$/, "Expected PR source commit must be a full lowercase SHA.");
  const currentHead = requirePattern(currentPrHeadSha, /^[0-9a-f]{40}$/, "Current PR head SHA must be a full lowercase SHA.");
  if (currentHead !== sourceCommit) {
    throw new DeploymentValidationError(`Current PR head changed after deployment: expected ${sourceCommit}, received ${currentHead}.`);
  }
  const buildId = requirePattern(expectedBuildId, /^[1-9][0-9]{0,19}-[1-9][0-9]{0,5}$/, "Expected build ID must be run-attempt.");
  const pullRequestNumber = requirePattern(prNumber, /^[1-9][0-9]{0,9}$/, "Pull request number is required.");
  const workflowRunId = requirePattern(runId, /^[1-9][0-9]{0,19}$/, "Workflow run ID is required.");
  const workflowRunAttempt = requirePattern(runAttempt, /^[1-9][0-9]{0,5}$/, "Workflow run attempt is required.");

  const rows = stages.map((stage) => {
    validateStageResult(stage);
    const artifactDir = resolve(evidenceRoot, stage.artifact_name);
    if (!statSync(artifactDir, { throwIfNoEntry: false })?.isDirectory()) {
      throw new DeploymentValidationError(`${stage.stage} evidence artifact ${stage.artifact_name} was not downloaded.`);
    }
    return validateStageEvidence({
      stage,
      evidence: readEvidenceFile(artifactDir),
      expectedSourceCommit: sourceCommit,
      expectedBuildId: buildId,
      prNumber: pullRequestNumber,
      runId: workflowRunId,
      runAttempt: workflowRunAttempt,
      repository,
      artifact: artifactsByName.get(stage.artifact_name),
    });
  });

  return {
    schema_version: 1,
    check_name: "Pre-merge deployment gate",
    result: "pass",
    source_commit: sourceCommit,
    current_pr_head_sha: currentHead,
    build_id: buildId,
    pr_number: pullRequestNumber,
    workflow_run_id: workflowRunId,
    workflow_run_attempt: workflowRunAttempt,
    stages: rows,
  };
}

export async function fetchCurrentPrHead({ fetchImpl = fetch, repository, prNumber, token, fallbackHeadSha }) {
  if (token && repository && prNumber) {
    const pullRequest = await fetchJsonWithRetry(
      fetchImpl,
      `https://api.github.com/repos/${repository}/pulls/${prNumber}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      { label: "Current PR head lookup for pre-merge deployment gate", timeoutMs: 120_000 },
    );
    return clean(pullRequest?.head?.sha);
  }
  return clean(fallbackHeadSha);
}

export async function fetchRunArtifacts({ fetchImpl = fetch, repository, runId, token }) {
  const artifacts = [];
  let page = 1;
  while (page <= 10) {
    const response = await fetchJsonWithRetry(
      fetchImpl,
      `https://api.github.com/repos/${repository}/actions/runs/${runId}/artifacts?per_page=100&page=${page}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      { label: `Workflow artifacts page ${page}`, timeoutMs: 120_000 },
    );
    const pageArtifacts = Array.isArray(response.artifacts) ? response.artifacts : [];
    artifacts.push(...pageArtifacts);
    if (artifacts.length >= Number(response.total_count ?? 0) || pageArtifacts.length === 0) break;
    page += 1;
  }
  return artifacts;
}

async function downloadArtifact({ fetchImpl = fetch, artifact, token, outputDir, spawnImpl = spawnSync }) {
  const artifactName = requireField(artifact, "name", "Artifact name is required.");
  const archiveUrl = requireField(artifact, "archive_download_url", `Artifact ${artifactName} is missing archive_download_url.`);
  const artifactDir = resolve(outputDir, artifactName);
  mkdirSync(artifactDir, { recursive: true });
  const response = await fetchImpl(archiveUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new DeploymentValidationError(`Artifact ${artifactName} download returned HTTP ${response.status}.`);
  const zipPath = resolve(outputDir, `${artifactName}.zip`);
  writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
  const unzip = spawnImpl("unzip", ["-q", zipPath, "-d", artifactDir], { encoding: "utf8" });
  if (unzip.status !== 0) {
    throw new DeploymentValidationError(`Artifact ${artifactName} unzip failed: ${clean(unzip.stderr) || clean(unzip.stdout) || "unknown error"}.`);
  }
  return artifactDir;
}

export async function downloadExpectedArtifacts({ fetchImpl = fetch, stages, repository, runId, token, outputDir, spawnImpl = spawnSync }) {
  if (!token) throw new DeploymentValidationError("GITHUB_TOKEN is required to download pre-merge deployment evidence artifacts.");
  for (const stage of stages) validateStageResult(stage);
  const artifacts = await fetchRunArtifacts({ fetchImpl, repository, runId, token });
  const artifactsByName = new Map(artifacts.map((artifact) => [clean(artifact.name), artifact]));

  for (const stage of stages) {
    const artifact = artifactsByName.get(stage.artifact_name);
    if (!artifact) throw new DeploymentValidationError(`${stage.stage} evidence artifact ${stage.artifact_name} is missing from workflow run ${runId}.`);
    await downloadArtifact({ fetchImpl, artifact, token, outputDir, spawnImpl });
  }
  return artifactsByName;
}

export function writeGateEvidence(path, evidence) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

export function buildGateSummary(evidence) {
  if (evidence.result === "skipped-ineligible") {
    return [
      "## Pre-merge deployment gate",
      "",
      "Deployment eligibility: skipped",
      "",
      `- Reason: \`${evidence.reason || "not deployment eligible"}\``,
      `- PR number: \`${evidence.pr_number || "unknown"}\``,
      `- Current PR head SHA: \`${evidence.current_pr_head_sha || "unknown"}\``,
      "",
    ].join("\n");
  }

  const lines = [
    "## Pre-merge deployment gate",
    "",
    "Deployment eligibility: eligible",
    "",
    `- Source commit: \`${evidence.source_commit}\``,
    `- Build ID: \`${evidence.build_id}\``,
    "- Merge readiness: all deployment evidence passed for this PR head. Merge manually, or enable GitHub native auto-merge, after GitHub shows every required check green for this exact head.",
    "- Main handoff: merging records that `main` points at the already-deployed candidate; no workflow should push to `main` or deploy again after this gate.",
    "",
    "| Order | Stage | Target | Target URL | Deployment ID | Result | Evidence artifact |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const stage of evidence.stages) {
    const artifact = stage.artifact_url ? `[${stage.artifact_name}](${stage.artifact_url})` : `\`${stage.artifact_name}\``;
    lines.push(
      `| ${stage.order} | ${stage.label} | \`${stage.target_type}\` | ${stage.target_url} | \`${stage.deployment_id}\` | \`${stage.result}\` | ${artifact} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export async function runPreMergeDeploymentGate(env = process.env, adapters = {}) {
  const eligible = clean(env.PRE_MERGE_DEPLOYMENT_ELIGIBLE) === "true";
  const evidencePath = clean(env.PRE_MERGE_DEPLOYMENT_GATE_EVIDENCE_PATH) || resolve(repoRoot, "pre-merge-deployment-gate-evidence.json");

  if (!eligible) {
    const evidence = {
      schema_version: 1,
      check_name: "Pre-merge deployment gate",
      result: "skipped-ineligible",
      reason: clean(env.PRE_MERGE_DEPLOYMENT_INELIGIBLE_REASON) || "PR is not deployment eligible",
      pr_number: clean(env.PR_NUMBER),
      current_pr_head_sha: clean(env.CURRENT_PR_HEAD_SHA || env.PR_HEAD_SHA),
      workflow_run_id: clean(env.GITHUB_RUN_ID),
      workflow_run_attempt: clean(env.GITHUB_RUN_ATTEMPT),
      stages: [],
    };
    writeGateEvidence(evidencePath, evidence);
    return evidence;
  }

  const stages = parseGateStageInputs(env.PRE_MERGE_DEPLOYMENT_GATE_STAGES_JSON);
  const repository = clean(env.GITHUB_REPOSITORY) || "ramideltoro/nutsnews";
  const runId = clean(env.GITHUB_RUN_ID);
  const currentPrHeadSha = await fetchCurrentPrHead({
    fetchImpl: adapters.fetchImpl,
    repository,
    prNumber: clean(env.PR_NUMBER),
    token: clean(env.GITHUB_TOKEN),
    fallbackHeadSha: clean(env.PR_HEAD_SHA),
  });
  const artifactDir = clean(env.PRE_MERGE_DEPLOYMENT_GATE_ARTIFACT_DIR) || resolve(repoRoot, ".pre-merge-deployment-gate-artifacts");
  mkdirSync(artifactDir, { recursive: true });
  const artifactsByName = await downloadExpectedArtifacts({
    fetchImpl: adapters.fetchImpl,
    stages,
    repository,
    runId,
    token: clean(env.GITHUB_TOKEN),
    outputDir: artifactDir,
    spawnImpl: adapters.spawnImpl,
  });
  const evidence = validatePreMergeDeploymentEvidence({
    stages,
    evidenceRoot: artifactDir,
    expectedSourceCommit: env.PR_SOURCE_COMMIT,
    expectedBuildId: env.PR_BUILD_ID,
    currentPrHeadSha,
    prNumber: env.PR_NUMBER,
    runId,
    runAttempt: clean(env.GITHUB_RUN_ATTEMPT),
    repository,
    artifactsByName,
  });
  writeGateEvidence(evidencePath, evidence);
  return evidence;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const evidence = await runPreMergeDeploymentGate(process.env);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        [`result=${evidence.result}`, `evidence_path=${clean(process.env.PRE_MERGE_DEPLOYMENT_GATE_EVIDENCE_PATH)}`, ""].join("\n"),
        "utf8",
      );
    }
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, buildGateSummary(evidence), "utf8");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
