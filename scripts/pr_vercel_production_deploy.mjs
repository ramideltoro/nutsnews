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
import {
  configuredVercelProductionRuntimeTargets,
  normalizeHttpsUrl,
  requireHttpsUrl,
} from "./production_topology.mjs";

function clean(value) {
  return String(value ?? "").trim();
}

function protectedHeaders(env) {
  const bypassSecret = clean(env.VERCEL_AUTOMATION_BYPASS_SECRET || env.VERCEL_PROTECTION_BYPASS_SECRET);
  return bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : {};
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
  if (actual !== expected) throw new DeploymentValidationError(`${label} mismatch: expected ${expected}, received ${actual ?? "missing"}.`);
}

function deploymentAliases(deployment) {
  const aliases = deployment.alias ?? deployment.aliases ?? deployment.domains ?? [];
  if (!Array.isArray(aliases)) return [];
  return aliases
    .map((item) => clean(typeof item === "string" ? item : item?.domain ?? item?.name ?? item?.url))
    .filter(Boolean)
    .map((item) => item.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase());
}

export function assertVercelProductionTarget({ deployment }) {
  const target = clean(deployment?.target).toLowerCase();
  if (target && target !== "production") {
    throw new DeploymentValidationError(`Vercel production deployment target mismatch: ${target}.`);
  }
  return true;
}

export function assertVercelProductionAliases({ deployment, aliases }) {
  assertVercelProductionTarget({ deployment });
  const attached = new Set(deploymentAliases(deployment));
  for (const alias of aliases) {
    const host = new URL(alias).hostname.toLowerCase();
    if (attached.size > 0 && !attached.has(host)) {
      throw new DeploymentValidationError(`Vercel production alias ${host} is not attached to the deployment.`);
    }
  }
  return true;
}

export async function verifyVercelProductionRuntime({ fetchImpl = fetch, env, metadata, targets, aliases, timeoutMs = 180_000, sleep, now }) {
  const headers = { Accept: "application/json", ...protectedHeaders(env) };
  const runtimeTargets = targets ?? aliases ?? [];
  const checked = [];
  if (runtimeTargets.length === 0) throw new DeploymentValidationError("At least one Vercel production runtime target is required.");

  await withBoundedExponentialBackoff(
    async () => {
      checked.length = 0;
      for (const target of runtimeTargets) {
        const baseUrl = requireHttpsUrl(target, "Vercel production runtime target");
        const [healthResponse, readyResponse] = await Promise.all([
          fetchImpl(new URL("healthz", baseUrl), { headers, signal: AbortSignal.timeout(15_000) }),
          fetchImpl(new URL(`readyz?cache-bust=${encodeURIComponent(metadata.build_id)}`, baseUrl), {
            headers: { ...headers, "Cache-Control": "no-store" },
            signal: AbortSignal.timeout(15_000),
          }),
        ]);
        const health = await responseJson(healthResponse, `${baseUrl.hostname} health`);
        const ready = await responseJson(readyResponse, `${baseUrl.hostname} readiness`);
        assertEqual(health.sourceCommit, metadata.source_commit, `${baseUrl.hostname} health source commit`);
        assertEqual(health.buildId, metadata.build_id, `${baseUrl.hostname} health build ID`);
        assertEqual(healthResponse.headers.get("x-nutsnews-source-commit"), metadata.source_commit, `${baseUrl.hostname} health source commit header`);
        assertEqual(healthResponse.headers.get("x-nutsnews-build-id"), metadata.build_id, `${baseUrl.hostname} health build ID header`);
        assertEqual(ready.runtimeEnv, "production", `${baseUrl.hostname} readiness runtime environment`);
        assertEqual(readyResponse.headers.get("x-nutsnews-runtime-environment"), "production", `${baseUrl.hostname} readiness runtime environment header`);
        assertEqual(readyResponse.headers.get("x-nutsnews-deployment-target"), "vercel-production", `${baseUrl.hostname} readiness deployment target header`);
        assertEqual(readyResponse.headers.get("x-nutsnews-source-commit"), metadata.source_commit, `${baseUrl.hostname} readiness source commit header`);
        assertEqual(readyResponse.headers.get("x-nutsnews-build-id"), metadata.build_id, `${baseUrl.hostname} readiness build ID header`);
        checked.push(baseUrl.toString());
      }
    },
    { label: "Vercel production runtime identity", timeoutMs, initialDelayMs: 10_000, maxDelayMs: 30_000, sleep, now },
  );

  return { runtime_env: "production", deployment_target: "vercel-production", targets_checked: checked, aliases_checked: checked };
}

export function buildVercelProductionEvidence({ env, metadata, deploymentUrl, deployment, runtimeIdentity, targetConfig, aliases, result = "success" }) {
  const deploymentId = clean(env.VERCEL_DEPLOYMENT_ID || deployment.id || deployment.uid);
  if (!/^dpl_[A-Za-z0-9]+$/.test(deploymentId)) throw new DeploymentValidationError("Vercel production deployment ID is missing or malformed.");
  const sourceSha = clean(deployment.sourceSha ?? deployment.meta?.githubCommitSha ?? deployment.gitSource?.sha ?? metadata.source_commit);
  const runtimeTargets = targetConfig?.targets ?? aliases ?? [];
  if (runtimeTargets.length === 0) throw new DeploymentValidationError("Vercel production evidence requires at least one runtime target.");
  const secondaryTargets = targetConfig?.secondaryTargets ?? runtimeTargets;
  const failoverAliases = targetConfig?.failoverAliases ?? [];
  return {
    schema_version: 1,
    stage: "deploy-vercel-production",
    result,
    pr_number: metadata.pr_number,
    target_type: "vercel-production",
    target_url: normalizeHttpsUrl(runtimeTargets[0], "Vercel production target URL"),
    deployment_url: deploymentUrl,
    vercel_secondary_targets: secondaryTargets,
    vercel_failover_aliases: failoverAliases,
    vercel_failover_alias_verification: Boolean(targetConfig?.verifyFailoverAliases),
    production_aliases: failoverAliases,
    runtime_env: runtimeIdentity.runtime_env,
    deployment_target: runtimeIdentity.deployment_target,
    source_commit: metadata.source_commit,
    vercel_source_sha: sourceSha,
    build_id: metadata.build_id,
    image_digest: metadata.image_digest,
    deployment_id: deploymentId,
    vercel_deployment_id: deploymentId,
    idempotency_key: deploymentStageIdempotencyKey({
      prNumber: metadata.pr_number,
      sourceCommit: metadata.source_commit,
      targetType: "vercel-production",
    }),
    workflow_run_id: clean(env.GITHUB_RUN_ID),
    workflow_run_attempt: clean(env.GITHUB_RUN_ATTEMPT),
  };
}

export function writeEvidence(path, evidence) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

export async function runPrVercelProductionDeploy(env = process.env, adapters = {}) {
  const metadata = parsePrReleaseMetadata(env.PR_RELEASE_METADATA_JSON);
  const deploymentUrl = requireHttpsUrl(env.VERCEL_PRODUCTION_DEPLOYMENT_URL, "Vercel production deployment URL").toString();
  const token = clean(env.VERCEL_TOKEN);
  if (!token) throw new DeploymentValidationError("VERCEL_TOKEN is required to validate Vercel production deployment.");
  const targetConfig = configuredVercelProductionRuntimeTargets(env, { deploymentUrl });
  const timeoutMs = Number(env.NUTSNEWS_DEPLOY_HARDENING_TIMEOUT_MS || 900_000);
  const deployment = await pollVercelDeployment({
    fetchImpl: adapters.fetchImpl,
    deploymentIdOrHost: clean(env.VERCEL_DEPLOYMENT_ID) || new URL(deploymentUrl).hostname,
    teamId: env.VERCEL_ORG_ID,
    token,
    expectedSourceCommit: metadata.source_commit,
    timeoutMs,
    initialDelayMs: 5_000,
    maxDelayMs: 30_000,
    sleep: adapters.sleep,
    now: adapters.now,
  });
  assertVercelProductionTarget({ deployment });
  const runtimeIdentity = await verifyVercelProductionRuntime({
    fetchImpl: adapters.fetchImpl,
    env,
    metadata,
    targets: targetConfig.targets,
    timeoutMs,
    sleep: adapters.sleep,
    now: adapters.now,
  });
  return buildVercelProductionEvidence({ env, metadata, deploymentUrl, deployment, runtimeIdentity, targetConfig });
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const evidencePath = clean(process.env.NUTSNEWS_VERCEL_PRODUCTION_EVIDENCE_PATH) || resolve(process.cwd(), "vercel-production-deploy-evidence.json");
  try {
    const evidence = await runPrVercelProductionDeploy(process.env);
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
        ["## Vercel production deploy", "", ...Object.entries(summary).map(([key, value]) => `- ${key}: \`${value}\``), ""].join("\n"),
        "utf8",
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
