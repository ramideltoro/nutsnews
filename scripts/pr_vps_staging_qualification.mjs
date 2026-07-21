#!/usr/bin/env node
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DeploymentTransientError,
  DeploymentValidationError,
  fetchJsonWithRetry,
  withBoundedExponentialBackoff,
} from "./deployment_hardening.mjs";
import { writeUiSmokeEvidence } from "./run_deployed_ui_smoke_with_evidence.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const infraRepository = "ramideltoro/nutsnews-infra";
const qualificationWorkflow = "nutsnews-staging-qualification.yml";

function clean(value) {
  return String(value ?? "").trim();
}

function parseTimestampMs(value) {
  const timestamp = Date.parse(clean(value));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function requirePattern(value, pattern, message) {
  const text = clean(value);
  if (!pattern.test(text)) throw new DeploymentValidationError(message);
  return text;
}

function authHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function fetchWorkflowRuns({ fetchImpl, token, page = 1 }) {
  return fetchJsonWithRetry(
    fetchImpl,
    `https://api.github.com/repos/${infraRepository}/actions/workflows/${qualificationWorkflow}/runs?event=workflow_run&per_page=20&page=${page}`,
    { headers: authHeaders(token) },
    { label: `Infra staging qualification runs page ${page}`, maxAttempts: 2, timeoutMs: 120_000 },
  );
}

async function fetchWorkflowRun({ fetchImpl, token, runId }) {
  return fetchJsonWithRetry(
    fetchImpl,
    `https://api.github.com/repos/${infraRepository}/actions/runs/${runId}`,
    { headers: authHeaders(token) },
    { label: `Infra staging deploy run ${runId}`, maxAttempts: 2, timeoutMs: 120_000 },
  );
}

async function fetchRunArtifacts({ fetchImpl, token, runId }) {
  return fetchJsonWithRetry(
    fetchImpl,
    `https://api.github.com/repos/${infraRepository}/actions/runs/${runId}/artifacts?per_page=100`,
    { headers: authHeaders(token) },
    { label: `Infra staging qualification artifacts for run ${runId}`, maxAttempts: 2, timeoutMs: 120_000 },
  );
}

export async function findInfraStagingQualification({
  fetchImpl = fetch,
  token,
  stagingDeployRunId,
  stagingDeploymentId,
  timeoutMs = 900_000,
  sleep,
  now,
}) {
  if (!token) throw new DeploymentValidationError("NUTSNEWS_INFRA_STAGING_TOKEN is required to read staging qualification evidence.");
  const deployRunId = requirePattern(stagingDeployRunId, /^[1-9][0-9]{0,19}$/, "Staging deploy run ID must be numeric.");
  const deploymentId = requirePattern(stagingDeploymentId, /^stg-[0-9a-f]{24}$/, "Staging deployment ID must be stg-*.");
  const artifactPrefix = `staging-qualification-${deploymentId}-`;
  const deployRun = await fetchWorkflowRun({ fetchImpl, token, runId: deployRunId });
  const deployCompletedAtMs =
    parseTimestampMs(deployRun.updated_at) ?? parseTimestampMs(deployRun.run_started_at) ?? parseTimestampMs(deployRun.created_at);

  return withBoundedExponentialBackoff(
    async () => {
      for (const page of [1, 2, 3]) {
        const runs = await fetchWorkflowRuns({ fetchImpl, token, page });
        for (const run of Array.isArray(runs.workflow_runs) ? runs.workflow_runs : []) {
          const runId = clean(run.id);
          if (!/^[1-9][0-9]{0,19}$/.test(runId)) continue;
          const runStartedAtMs = parseTimestampMs(run.run_started_at) ?? parseTimestampMs(run.created_at);
          if (deployCompletedAtMs && runStartedAtMs && runStartedAtMs < deployCompletedAtMs - 60_000) continue;
          const artifacts = await fetchRunArtifacts({ fetchImpl, token, runId });
          const artifact = (Array.isArray(artifacts.artifacts) ? artifacts.artifacts : []).find((item) =>
            clean(item?.name).startsWith(artifactPrefix),
          );
          if (!artifact) continue;

          const status = clean(run.status);
          const conclusion = clean(run.conclusion);
          if (status === "completed" && conclusion === "success") {
            return {
              run_id: runId,
              run_attempt: String(run.run_attempt ?? ""),
              deploy_run_id: deployRunId,
              deployment_id: deploymentId,
              artifact_name: clean(artifact.name),
              artifact_id: String(artifact.id ?? ""),
              url: clean(run.html_url),
            };
          }
          if (status === "completed") {
            throw new DeploymentValidationError(`Infra staging qualification ${runId} concluded ${conclusion || "missing"}.`);
          }
          throw new DeploymentTransientError(`Infra staging qualification ${runId} is ${status || "pending"}.`);
        }
      }
      throw new DeploymentTransientError(`No infra staging qualification artifact found yet for deploy run ${deployRunId} and deployment ${deploymentId}.`);
    },
    { label: "Infra staging qualification", timeoutMs, initialDelayMs: 10_000, maxDelayMs: 30_000, sleep, now },
  );
}

export function writeDelegatedVpsStagingSmokeEvidence(env, qualification) {
  const evidence = writeUiSmokeEvidence(env, "pass");
  evidence.delegated_to = {
    repository: infraRepository,
    workflow: "Qualify Verified NutsNews Staging Candidate",
    run_id: qualification.run_id,
    run_attempt: qualification.run_attempt,
    deploy_run_id: qualification.deploy_run_id,
    artifact_name: qualification.artifact_name,
    artifact_id: qualification.artifact_id,
    url: qualification.url,
  };
  const evidencePath = resolve(repoRoot, evidence.artifact_paths.evidence_json);
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return evidence;
}

async function main() {
  const qualification = await findInfraStagingQualification({
    token: process.env.NUTSNEWS_INFRA_STAGING_TOKEN,
    stagingDeployRunId: process.env.NUTSNEWS_VPS_STAGING_INFRA_RUN_ID,
    stagingDeploymentId: process.env.NUTSNEWS_VPS_STAGING_DEPLOYMENT_ID || process.env.NUTSNEWS_UI_SMOKE_DEPLOYMENT_ID,
    timeoutMs: Number(process.env.NUTSNEWS_DEPLOY_HARDENING_TIMEOUT_MS || 900_000),
  });
  const evidence = writeDelegatedVpsStagingSmokeEvidence(process.env, qualification);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        "## VPS staging UI smoke",
        "",
        `- Result: \`${evidence.result}\``,
        `- Delegated qualification run: ${qualification.url}`,
        `- Infra deploy run: \`${qualification.deploy_run_id}\``,
        `- Evidence: \`${evidence.artifact_paths.evidence_json}\``,
        "",
      ].join("\n"),
      "utf8",
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
