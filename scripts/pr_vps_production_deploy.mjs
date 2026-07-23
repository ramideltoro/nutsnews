#!/usr/bin/env node
import crypto from "node:crypto";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DeploymentTransientError,
  DeploymentValidationError,
  deploymentStageIdempotencyKey,
  fetchJsonWithRetry,
  isTransientHttpStatus,
  pollGitHubWorkflowRun,
  safeDeploymentDebugSummary,
  withBoundedExponentialBackoff,
} from "./deployment_hardening.mjs";
import { parsePrReleaseMetadata } from "./pr_vps_staging_deploy.mjs";
import {
  configuredVpsPrimaryProductionTarget,
  defaultVpsPrimaryProductionUrl,
} from "./production_topology.mjs";
import { smokeAdminBackendOperations } from "./admin_backend_operation_smoke.mjs";

const infraRepository = "ramideltoro/nutsnews-infra";
const premergeProductionWorkflow = "nutsnews-premerge-production-vps-deploy.yml";
const payloadSchemaVersion = "nutsnews.premerge.production_vps.v1";
const defaultTargetUrl = defaultVpsPrimaryProductionUrl;

function clean(value) {
  return String(value ?? "").trim();
}

function protectedHeaders(env) {
  const clientId = clean(env.CF_ACCESS_CLIENT_ID);
  const clientSecret = clean(env.CF_ACCESS_CLIENT_SECRET);
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new DeploymentValidationError("Cloudflare Access service-token inputs must be provided together.");
  }
  return clientId ? { "CF-Access-Client-Id": clientId, "CF-Access-Client-Secret": clientSecret } : {};
}

function normalizeRuntimeUrl(value, label) {
  const text = clean(value);
  if (!text) throw new DeploymentValidationError(`${label} runtime URL is required.`);
  try {
    const url = new URL(text.endsWith("/") ? text : `${text}/`);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported protocol");
    return url.toString();
  } catch {
    throw new DeploymentValidationError(`${label} runtime URL must be an http or https URL.`);
  }
}

export function selectVpsProductionRuntimeTargetUrl({ pollResult, configuredTargetUrl = "", defaultUrl = defaultTargetUrl } = {}) {
  return normalizeRuntimeUrl(clean(pollResult?.status?.environment_url) || clean(configuredTargetUrl) || defaultUrl, "VPS production");
}

async function responseJson(response, label) {
  if (!response.ok) {
    if (isTransientHttpStatus(response.status)) throw new DeploymentTransientError(`${label} returned transient HTTP ${response.status}.`);
    throw new DeploymentValidationError(`${label} returned HTTP ${response.status}.`);
  }
  return response.json();
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new DeploymentValidationError(`${label} mismatch: expected ${expected}, received ${actual ?? "missing"}.`);
}

export function computeVpsProductionDeploymentId(metadata) {
  const identity = {
    source_repository: metadata.source_repository,
    source_commit: metadata.source_commit,
    image_repository: metadata.image_repository,
    image_digest: metadata.image_digest,
    build_id: metadata.build_id,
    source_workflow_run_id: metadata.source_workflow_run_id,
  };
  return `prod-${crypto.createHash("sha256").update(JSON.stringify(identity, Object.keys(identity).sort())).digest("hex").slice(0, 24)}`;
}

export function buildVpsProductionPayload({ metadata, deploymentId, vercelProductionDeploymentId }) {
  const payload = {
    schema_version: payloadSchemaVersion,
    source: {
      repository: metadata.source_repository,
      commit: metadata.source_commit,
      workflow_run_id: metadata.source_workflow_run_id,
      pr_number: metadata.pr_number,
    },
    image: {
      repository: metadata.image_repository,
      digest: metadata.image_digest,
    },
    release: {
      build_id: metadata.build_id,
      migration_head: metadata.migration_head,
      schema_version: metadata.schema_version,
      supabase_project_ref: metadata.supabase_project_ref,
      production_writes_paused: "false",
    },
    deployment: {
      id: deploymentId,
      target: "production-vps",
      idempotency_key: deploymentStageIdempotencyKey({
        prNumber: metadata.pr_number,
        sourceCommit: metadata.source_commit,
        targetType: "production-vps",
      }),
    },
    vercel: {
      production_deployment_id: clean(vercelProductionDeploymentId),
    },
  };
  if (Object.keys(payload).length > 10) {
    throw new DeploymentValidationError("VPS production dispatch payload exceeds GitHub repository_dispatch limits.");
  }
  return payload;
}

async function safeResponseText(response) {
  try {
    return clean(await response.text()).replace(/\s+/g, " ").slice(0, 300);
  } catch {
    return "";
  }
}

export async function dispatchVpsProductionCandidate({ fetchImpl = fetch, token, payload, timeoutMs, sleep, now }) {
  if (!token) throw new DeploymentValidationError("NUTSNEWS_INFRA_PRODUCTION_TOKEN is required for VPS production deploy dispatch.");
  await withBoundedExponentialBackoff(
    async () => {
      const response = await fetchImpl("https://api.github.com/repos/ramideltoro/nutsnews-infra/dispatches", {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          event_type: "nutsnews-production-vps-release",
          client_payload: payload,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 204) return;
      if (isTransientHttpStatus(response.status)) throw new DeploymentTransientError(`VPS production dispatch returned transient HTTP ${response.status}.`);
      const body = await safeResponseText(response);
      throw new DeploymentValidationError(`VPS production dispatch returned HTTP ${response.status}${body ? `: ${body}` : "."}`);
    },
    { label: "VPS production dispatch", timeoutMs, initialDelayMs: 2_000, maxDelayMs: 30_000, sleep, now },
  );
}

function parseTimestampMs(value) {
  const timestamp = Date.parse(clean(value));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function findInfraPremergeProductionRun({
  fetchImpl = fetch,
  token,
  sourceCommit,
  dispatchStartedAt,
  timeoutMs = 900_000,
  sleep,
  now,
}) {
  if (!token) throw new DeploymentValidationError("NUTSNEWS_INFRA_PRODUCTION_TOKEN is required to read VPS production workflow runs.");
  const commit = clean(sourceCommit);
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new DeploymentValidationError("VPS production workflow lookup requires a full source commit.");
  const startedMs = parseTimestampMs(dispatchStartedAt) ?? 0;
  const displayTitle = `Deploy pre-merge VPS production ${commit}`;

  return withBoundedExponentialBackoff(
    async () => {
      const runs = await fetchJsonWithRetry(
        fetchImpl,
        `https://api.github.com/repos/${infraRepository}/actions/workflows/${premergeProductionWorkflow}/runs?event=repository_dispatch&branch=main&per_page=30`,
        { headers: githubHeaders(token) },
        { label: "Infra pre-merge VPS production run lookup", maxAttempts: 2, timeoutMs: 120_000, sleep, now },
      );
      for (const run of Array.isArray(runs.workflow_runs) ? runs.workflow_runs : []) {
        const createdMs = parseTimestampMs(run.created_at) ?? parseTimestampMs(run.run_started_at) ?? 0;
        if (clean(run.display_title) !== displayTitle || createdMs < startedMs - 5_000) continue;
        const runId = clean(run.id);
        if (!/^[1-9][0-9]{0,19}$/.test(runId)) throw new DeploymentValidationError("Infra pre-merge VPS production run ID was invalid.");
        return {
          run_id: runId,
          url: clean(run.html_url),
          status: clean(run.status),
          conclusion: clean(run.conclusion),
          head_sha: clean(run.head_sha),
        };
      }
      throw new DeploymentTransientError(`No infra pre-merge VPS production run found yet for ${commit}.`);
    },
    { label: "Infra pre-merge VPS production workflow", timeoutMs, initialDelayMs: 2_000, maxDelayMs: 15_000, sleep, now },
  );
}

export async function verifyVpsProductionRuntime({ fetchImpl = fetch, env, metadata, targetUrl, timeoutMs, sleep, now }) {
  const baseUrl = new URL(targetUrl.endsWith("/") ? targetUrl : `${targetUrl}/`);
  const headers = { Accept: "application/json", ...protectedHeaders(env) };
  return withBoundedExponentialBackoff(
    async () => {
      const [healthResponse, readyResponse] = await Promise.all([
        fetchImpl(new URL("healthz", baseUrl), { headers, signal: AbortSignal.timeout(15_000) }),
        fetchImpl(new URL(`readyz?cache-bust=${encodeURIComponent(metadata.build_id)}`, baseUrl), {
          headers: { ...headers, "Cache-Control": "no-store" },
          signal: AbortSignal.timeout(15_000),
        }),
      ]);
      const health = await responseJson(healthResponse, "VPS production health");
      const ready = await responseJson(readyResponse, "VPS production readiness");
      assertEqual(health.sourceCommit, metadata.source_commit, "Health source commit");
      assertEqual(health.buildId, metadata.build_id, "Health build ID");
      assertEqual(healthResponse.headers.get("x-nutsnews-source-commit"), metadata.source_commit, "Health source commit header");
      assertEqual(healthResponse.headers.get("x-nutsnews-build-id"), metadata.build_id, "Health build ID header");
      assertEqual(ready.runtimeEnv, "production", "Readiness runtime environment");
      assertEqual(readyResponse.headers.get("x-nutsnews-runtime-environment"), "production", "Readiness runtime environment header");
      assertEqual(readyResponse.headers.get("x-nutsnews-deployment-target"), "production-vps", "Readiness deployment target header");
      assertEqual(readyResponse.headers.get("x-nutsnews-source-commit"), metadata.source_commit, "Readiness source commit header");
      assertEqual(readyResponse.headers.get("x-nutsnews-build-id"), metadata.build_id, "Readiness build ID header");
      assertEqual(readyResponse.headers.get("x-nutsnews-expected-image-digest"), metadata.image_digest, "Readiness image digest header");
      return { runtime_env: "production", deployment_target: "production-vps" };
    },
    { label: "VPS production runtime identity", timeoutMs, initialDelayMs: 10_000, maxDelayMs: 30_000, sleep, now },
  );
}

function adminBackendOperationEvidence(result) {
  const evidence = {
    operation: clean(result?.operation),
    status: result?.status === "pass" ? "pass" : "fail",
  };
  if (typeof result?.rows === "number") evidence.rows = result.rows;
  if (typeof result?.rowCount === "number" || result?.rowCount === null) evidence.row_count = result.rowCount;
  if (typeof result?.emptyValidDataset === "boolean") evidence.empty_valid_dataset = result.emptyValidDataset;
  if (evidence.status !== "pass" && result?.error) evidence.error = clean(result.error);
  return evidence;
}

function productionAdminBackendSmokeConfig(env) {
  const baseUrl = clean(env.NUTSNEWS_BACKEND_API_URL) || "https://backend.nutsnews.com/api/app/db";
  const token = clean(env.NUTSNEWS_BACKEND_API_TOKEN);
  const providerMode = clean(env.NUTSNEWS_ADMIN_BACKEND_SMOKE_PROVIDER_MODE) || clean(env.NUTSNEWS_DATABASE_PROVIDER_MODE) || "backend_postgres_primary";
  if (providerMode !== "backend_postgres_primary") {
    throw new DeploymentValidationError("Production admin backend operation smoke requires backend_postgres_primary provider mode.");
  }
  if (!/^https:\/\/[^/\s]+\/api\/app\/db\/?$/.test(baseUrl)) {
    throw new DeploymentValidationError("NUTSNEWS_BACKEND_API_URL must be an HTTPS /api/app/db route for production admin backend operation smoke.");
  }
  if (!token) {
    throw new DeploymentValidationError("NUTSNEWS_BACKEND_API_TOKEN is required for production admin backend operation smoke.");
  }
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    token,
    providerMode,
  };
}

export async function runVpsProductionAdminBackendSmoke({ fetchImpl = fetch, env = process.env, timeoutMs = 15_000 }) {
  const config = productionAdminBackendSmokeConfig(env);
  const operations = [];
  try {
    await smokeAdminBackendOperations({
      ...config,
      timeoutMs: Math.min(Number(timeoutMs) || 15_000, 15_000),
      limit: 1,
      fetchImpl,
      onOperationResult: (result) => {
        operations.push(adminBackendOperationEvidence(result));
      },
    });
  } catch (error) {
    throw new DeploymentValidationError(`Production admin backend operation smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    result: "pass",
    provider_mode: config.providerMode,
    backend_route: `${config.baseUrl}/{operation}`,
    operation_count: operations.length,
    operations,
  };
}

export function buildVpsProductionEvidence({ env, metadata, deploymentId, targetUrl, infraRun, runtimeIdentity, adminBackendSmoke, result = "success" }) {
  const infraRunId = clean(infraRun?.id ?? infraRun?.run_id);
  if (!/^[1-9][0-9]{0,19}$/.test(infraRunId)) throw new DeploymentValidationError("VPS production deploy evidence requires an infra run ID.");
  return {
    schema_version: 1,
    stage: "deploy-vps-production",
    result,
    pr_number: metadata.pr_number,
    target_type: "production-vps",
    target_url: targetUrl,
    runtime_env: runtimeIdentity.runtime_env,
    deployment_target: runtimeIdentity.deployment_target,
    source_commit: metadata.source_commit,
    build_id: metadata.build_id,
    image_digest: metadata.image_digest,
    image: metadata.image,
    deployment_id: deploymentId,
    infra_run_id: infraRunId,
    idempotency_key: deploymentStageIdempotencyKey({
      prNumber: metadata.pr_number,
      sourceCommit: metadata.source_commit,
      targetType: "production-vps",
    }),
    workflow_run_id: clean(env.GITHUB_RUN_ID),
    workflow_run_attempt: clean(env.GITHUB_RUN_ATTEMPT),
    status_log_url: clean(infraRun?.html_url ?? infraRun?.url),
    admin_backend_operation_smoke_result: clean(adminBackendSmoke?.result),
    admin_backend_operation_count: adminBackendSmoke?.operation_count ?? "",
    admin_backend_backend_route: clean(adminBackendSmoke?.backend_route),
    admin_backend_operation_smoke: adminBackendSmoke,
  };
}

export function writeEvidence(path, evidence) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

export async function runPrVpsProductionDeploy(env = process.env, adapters = {}) {
  const metadata = parsePrReleaseMetadata(env.PR_RELEASE_METADATA_JSON);
  const deploymentId = computeVpsProductionDeploymentId(metadata);
  const payload = buildVpsProductionPayload({
    metadata,
    deploymentId,
    vercelProductionDeploymentId: env.VERCEL_PRODUCTION_DEPLOYMENT_ID,
  });
  const timeoutMs = Number(env.NUTSNEWS_DEPLOY_HARDENING_TIMEOUT_MS || 900_000);
  const dispatchStartedAt = new Date(adapters.now ? adapters.now() : Date.now()).toISOString();
  await dispatchVpsProductionCandidate({
    fetchImpl: adapters.fetchImpl,
    token: env.NUTSNEWS_INFRA_PRODUCTION_TOKEN,
    payload,
    timeoutMs,
    sleep: adapters.sleep,
    now: adapters.now,
  });
  const infraRun = await findInfraPremergeProductionRun({
    fetchImpl: adapters.fetchImpl,
    token: env.NUTSNEWS_INFRA_PRODUCTION_TOKEN,
    sourceCommit: metadata.source_commit,
    dispatchStartedAt,
    timeoutMs,
    sleep: adapters.sleep,
    now: adapters.now,
  });
  const completedInfraRun = await pollGitHubWorkflowRun({
    fetchImpl: adapters.fetchImpl,
    repository: infraRepository,
    runId: infraRun.run_id,
    token: env.NUTSNEWS_INFRA_PRODUCTION_TOKEN,
    timeoutMs,
    initialDelayMs: 10_000,
    maxDelayMs: 30_000,
    sleep: adapters.sleep,
    now: adapters.now,
  });
  const targetUrl = selectVpsProductionRuntimeTargetUrl({
    configuredTargetUrl: configuredVpsPrimaryProductionTarget(env),
  });
  const runtimeIdentity = await verifyVpsProductionRuntime({
    fetchImpl: adapters.fetchImpl,
    env,
    metadata,
    targetUrl,
    timeoutMs,
    sleep: adapters.sleep,
    now: adapters.now,
  });
  const adminBackendSmoke = adapters.runAdminBackendSmoke
    ? await adapters.runAdminBackendSmoke({ env, metadata, targetUrl, timeoutMs })
    : await runVpsProductionAdminBackendSmoke({
        fetchImpl: adapters.fetchImpl,
        env,
        timeoutMs,
      });
  return buildVpsProductionEvidence({
    env,
    metadata,
    deploymentId,
    targetUrl,
    infraRun: {
      ...infraRun,
      ...completedInfraRun,
      run_id: infraRun.run_id,
      url: infraRun.url || completedInfraRun.html_url,
    },
    runtimeIdentity,
    adminBackendSmoke,
  });
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const evidencePath = clean(process.env.NUTSNEWS_VPS_PRODUCTION_EVIDENCE_PATH) || resolve(process.cwd(), "vps-production-deploy-evidence.json");
  try {
    const evidence = await runPrVpsProductionDeploy(process.env);
    writeEvidence(evidencePath, evidence);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, [`deployment_id=${evidence.deployment_id}`, `target_url=${evidence.target_url}`, `infra_run_id=${evidence.infra_run_id}`, `evidence_path=${evidencePath}`, ""].join("\n"), "utf8");
    }
    if (process.env.GITHUB_STEP_SUMMARY) {
      const summary = safeDeploymentDebugSummary(evidence);
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, ["## VPS production deploy", "", ...Object.entries(summary).map(([key, value]) => `- ${key}: \`${value}\``), ""].join("\n"), "utf8");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
