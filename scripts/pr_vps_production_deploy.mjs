#!/usr/bin/env node
import crypto from "node:crypto";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DeploymentTransientError,
  DeploymentValidationError,
  deploymentStageIdempotencyKey,
  isTransientHttpStatus,
  pollInfraGitHubDeployment,
  safeDeploymentDebugSummary,
  withBoundedExponentialBackoff,
} from "./deployment_hardening.mjs";
import { parsePrReleaseMetadata } from "./pr_vps_staging_deploy.mjs";

const defaultTargetUrl = "https://www.nutsnews.com/";

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
  return {
    schema_version: metadata.schema_version,
    migration_head: metadata.migration_head,
    supabase_project_ref: metadata.supabase_project_ref,
    source_repository: metadata.source_repository,
    source_commit: metadata.source_commit,
    image_repository: metadata.image_repository,
    image_digest: metadata.image_digest,
    build_id: metadata.build_id,
    source_workflow_run_id: metadata.source_workflow_run_id,
    pr_number: metadata.pr_number,
    deployment_id: deploymentId,
    deployment_target: "production-vps",
    idempotency_key: deploymentStageIdempotencyKey({
      prNumber: metadata.pr_number,
      sourceCommit: metadata.source_commit,
      targetType: "production-vps",
    }),
    vercel_production_deployment_id: clean(vercelProductionDeploymentId),
  };
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
      throw new DeploymentValidationError(`VPS production dispatch returned HTTP ${response.status}.`);
    },
    { label: "VPS production dispatch", timeoutMs, initialDelayMs: 2_000, maxDelayMs: 30_000, sleep, now },
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

function extractInfraRunId(pollResult) {
  const candidates = [pollResult?.status?.log_url, pollResult?.status?.target_url, pollResult?.deployment?.payload?.infra_run_id, pollResult?.deployment?.payload?.workflow_run_id].map(clean);
  for (const candidate of candidates) {
    const match = candidate.match(/(?:^|\/)([1-9][0-9]{0,19})(?:$|[/?#])/);
    if (match) return match[1];
    if (/^[1-9][0-9]{0,19}$/.test(candidate)) return candidate;
  }
  throw new DeploymentValidationError("VPS production deployment status did not expose an infra run ID.");
}

export function buildVpsProductionEvidence({ env, metadata, deploymentId, targetUrl, pollResult, runtimeIdentity, result = "success" }) {
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
    github_deployment_id: String(pollResult.deployment?.id ?? ""),
    infra_run_id: extractInfraRunId(pollResult),
    idempotency_key: deploymentStageIdempotencyKey({
      prNumber: metadata.pr_number,
      sourceCommit: metadata.source_commit,
      targetType: "production-vps",
    }),
    workflow_run_id: clean(env.GITHUB_RUN_ID),
    workflow_run_attempt: clean(env.GITHUB_RUN_ATTEMPT),
    status_log_url: clean(pollResult.status?.log_url),
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
  await dispatchVpsProductionCandidate({
    fetchImpl: adapters.fetchImpl,
    token: env.NUTSNEWS_INFRA_PRODUCTION_TOKEN,
    payload,
    timeoutMs,
    sleep: adapters.sleep,
    now: adapters.now,
  });
  const pollResult = await pollInfraGitHubDeployment({
    fetchImpl: adapters.fetchImpl,
    repository: "ramideltoro/nutsnews-infra",
    environment: "production",
    deploymentId,
    token: env.NUTSNEWS_INFRA_PRODUCTION_TOKEN,
    expectedSourceCommit: metadata.source_commit,
    expectedBuildId: metadata.build_id,
    expectedImageDigest: metadata.image_digest,
    timeoutMs,
    initialDelayMs: 10_000,
    maxDelayMs: 30_000,
    sleep: adapters.sleep,
    now: adapters.now,
  });
  const targetUrl = selectVpsProductionRuntimeTargetUrl({
    pollResult,
    configuredTargetUrl: clean(env.NUTSNEWS_VPS_PRODUCTION_URL),
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
  return buildVpsProductionEvidence({ env, metadata, deploymentId, targetUrl, pollResult, runtimeIdentity });
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
