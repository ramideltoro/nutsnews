#!/usr/bin/env node
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DeploymentTransientError,
  DeploymentValidationError,
  deploymentStageIdempotencyKey,
  isTransientHttpStatus,
  pollVercelDeployment,
  safeDeploymentDebugSummary,
  withBoundedExponentialBackoff,
} from "./deployment_hardening.mjs";
import { parsePrReleaseMetadata } from "./pr_vps_staging_deploy.mjs";

const productionHosts = new Set(["nutsnews.com", "www.nutsnews.com"]);

function clean(value) {
  return String(value ?? "").trim();
}

function protectedHeaders(env) {
  const bypassSecret = clean(env.VERCEL_AUTOMATION_BYPASS_SECRET || env.VERCEL_PROTECTION_BYPASS_SECRET);
  if (!bypassSecret) return {};
  return {
    "x-vercel-protection-bypass": bypassSecret,
    "x-vercel-set-bypass-cookie": "true",
  };
}

function requireUrl(value, label) {
  try {
    const url = new URL(clean(value));
    if (url.protocol !== "https:") throw new Error("not https");
    return url;
  } catch {
    throw new DeploymentValidationError(`${label} must be an https URL.`);
  }
}

async function responseJson(response, label) {
  if (!response.ok) {
    if (isTransientHttpStatus(response.status)) throw new DeploymentTransientError(`${label} returned transient HTTP ${response.status}.`);
    throw new DeploymentValidationError(`${label} returned HTTP ${response.status}.`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new DeploymentValidationError(`${label} did not return JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new DeploymentValidationError(`${label} mismatch: expected ${expected}, received ${actual ?? "missing"}.`);
  }
}

function vercelAliases(deployment) {
  const aliases = deployment.alias ?? deployment.aliases ?? deployment.domains ?? [];
  if (Array.isArray(aliases)) {
    return aliases.map((item) => clean(typeof item === "string" ? item : item?.domain ?? item?.name ?? item?.url)).filter(Boolean);
  }
  return [];
}

export function assertVercelStagingIsNotProduction({ deploymentUrl, deployment }) {
  const url = requireUrl(deploymentUrl, "Vercel staging deployment URL");
  if (productionHosts.has(url.hostname.toLowerCase())) {
    throw new DeploymentValidationError("Vercel staging deployment URL must not be a production host.");
  }
  const target = clean(deployment?.target).toLowerCase();
  if (target === "production") {
    throw new DeploymentValidationError("Vercel staging deployment must not have production target.");
  }
  const productionAlias = vercelAliases(deployment).find((alias) => productionHosts.has(alias.toLowerCase().replace(/^https?:\/\//, "")));
  if (productionAlias) {
    throw new DeploymentValidationError(`Vercel staging deployment must not be aliased to production host ${productionAlias}.`);
  }
  return true;
}

export async function verifyVercelStagingRuntime({ fetchImpl = fetch, env, metadata, targetUrl, timeoutMs = 120_000, sleep, now }) {
  const baseUrl = requireUrl(targetUrl, "Vercel staging target URL");
  const headers = {
    Accept: "application/json",
    ...protectedHeaders(env),
  };

  return withBoundedExponentialBackoff(
    async () => {
      const [healthResponse, readyResponse] = await Promise.all([
        fetchImpl(new URL("healthz", baseUrl), { headers, signal: AbortSignal.timeout(15_000) }),
        fetchImpl(new URL(`readyz?cache-bust=${encodeURIComponent(metadata.build_id)}`, baseUrl), {
          headers: { ...headers, "Cache-Control": "no-store" },
          signal: AbortSignal.timeout(15_000),
        }),
      ]);
      const health = await responseJson(healthResponse, "Vercel staging health");
      const ready = await responseJson(readyResponse, "Vercel staging readiness");

      assertEqual(health.sourceCommit, metadata.source_commit, "Health source commit");
      assertEqual(health.buildId, metadata.build_id, "Health build ID");
      assertEqual(healthResponse.headers.get("x-nutsnews-source-commit"), metadata.source_commit, "Health source commit header");
      assertEqual(healthResponse.headers.get("x-nutsnews-build-id"), metadata.build_id, "Health build ID header");
      assertEqual(ready.runtimeEnv, "staging", "Readiness runtime environment");
      assertEqual(readyResponse.headers.get("x-nutsnews-runtime-environment"), "staging", "Readiness runtime environment header");
      assertEqual(readyResponse.headers.get("x-nutsnews-deployment-target"), "vercel-staging", "Readiness deployment target header");
      assertEqual(readyResponse.headers.get("x-nutsnews-source-commit"), metadata.source_commit, "Readiness source commit header");
      assertEqual(readyResponse.headers.get("x-nutsnews-build-id"), metadata.build_id, "Readiness build ID header");
      return { runtime_env: "staging", deployment_target: "vercel-staging" };
    },
    { label: "Vercel staging runtime identity", timeoutMs, initialDelayMs: 5_000, maxDelayMs: 30_000, sleep, now },
  );
}

export function buildVercelStagingEvidence({ env, metadata, deploymentUrl, deployment, runtimeIdentity, result = "success" }) {
  const deploymentId = clean(deployment.id ?? deployment.uid);
  if (!/^dpl_[A-Za-z0-9]+$/.test(deploymentId)) {
    throw new DeploymentValidationError("Vercel staging deployment ID is missing or malformed.");
  }
  const sourceSha = clean(deployment.sourceSha ?? deployment.meta?.githubCommitSha ?? deployment.gitSource?.sha ?? metadata.source_commit);
  const idempotencyKey = deploymentStageIdempotencyKey({
    prNumber: metadata.pr_number,
    sourceCommit: metadata.source_commit,
    targetType: "vercel-staging",
  });
  return {
    schema_version: 1,
    stage: "deploy-vercel-staging",
    result,
    pr_number: metadata.pr_number,
    target_type: "vercel-staging",
    target_url: deploymentUrl,
    runtime_env: runtimeIdentity.runtime_env,
    deployment_target: runtimeIdentity.deployment_target,
    source_commit: metadata.source_commit,
    vercel_source_sha: sourceSha,
    build_id: metadata.build_id,
    image_digest: metadata.image_digest,
    deployment_id: deploymentId,
    vercel_deployment_id: deploymentId,
    idempotency_key: idempotencyKey,
    workflow_run_id: clean(env.GITHUB_RUN_ID),
    workflow_run_attempt: clean(env.GITHUB_RUN_ATTEMPT),
  };
}

export function writeEvidence(path, evidence) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

export async function runPrVercelStagingDeploy(env = process.env, adapters = {}) {
  const metadata = parsePrReleaseMetadata(env.PR_RELEASE_METADATA_JSON);
  const deploymentUrl = requireUrl(env.VERCEL_STAGING_DEPLOYMENT_URL, "Vercel staging deployment URL").toString();
  const token = clean(env.VERCEL_TOKEN);
  if (!token) throw new DeploymentValidationError("VERCEL_TOKEN is required to validate Vercel staging deployment.");
  const timeoutMs = Number(env.NUTSNEWS_DEPLOY_HARDENING_TIMEOUT_MS || 600_000);
  const deployment = await pollVercelDeployment({
    fetchImpl: adapters.fetchImpl,
    deploymentIdOrHost: new URL(deploymentUrl).hostname,
    teamId: env.VERCEL_ORG_ID,
    token,
    expectedSourceCommit: metadata.source_commit,
    timeoutMs,
    initialDelayMs: 5_000,
    maxDelayMs: 30_000,
    sleep: adapters.sleep,
    now: adapters.now,
  });
  assertVercelStagingIsNotProduction({ deploymentUrl, deployment });
  const runtimeIdentity = await verifyVercelStagingRuntime({
    fetchImpl: adapters.fetchImpl,
    env,
    metadata,
    targetUrl: deploymentUrl,
    timeoutMs,
    sleep: adapters.sleep,
    now: adapters.now,
  });
  return buildVercelStagingEvidence({ env, metadata, deploymentUrl, deployment, runtimeIdentity });
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const evidencePath = clean(process.env.NUTSNEWS_VERCEL_STAGING_EVIDENCE_PATH) || resolve(process.cwd(), "vercel-staging-deploy-evidence.json");
  try {
    const evidence = await runPrVercelStagingDeploy(process.env);
    writeEvidence(evidencePath, evidence);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        [
          `deployment_id=${evidence.deployment_id}`,
          `target_url=${evidence.target_url}`,
          `vercel_source_sha=${evidence.vercel_source_sha}`,
          `evidence_path=${evidencePath}`,
          "",
        ].join("\n"),
        "utf8",
      );
    }
    if (process.env.GITHUB_STEP_SUMMARY) {
      const summary = safeDeploymentDebugSummary(evidence);
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        [
          "## Vercel staging deploy",
          "",
          ...Object.entries(summary).map(([key, value]) => `- ${key}: \`${value}\``),
          "",
        ].join("\n"),
        "utf8",
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
