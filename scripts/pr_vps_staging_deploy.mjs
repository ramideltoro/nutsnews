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
  pollInfraGitHubDeployment,
  safeDeploymentDebugSummary,
  withBoundedExponentialBackoff,
} from "./deployment_hardening.mjs";

const candidateKeys = [
  "schema_version",
  "migration_head",
  "supabase_project_ref",
  "source_repository",
  "source_commit",
  "image_repository",
  "image_digest",
  "build_id",
  "source_workflow_run_id",
];
const defaultTargetUrl = "https://staging.nutsnews.com/";

function clean(value) {
  return String(value ?? "").trim();
}

function requirePattern(value, pattern, message) {
  const text = clean(value);
  if (!pattern.test(text)) throw new DeploymentValidationError(message);
  return text;
}

function protectedHeaders(env) {
  const clientId = clean(env.CF_ACCESS_CLIENT_ID);
  const clientSecret = clean(env.CF_ACCESS_CLIENT_SECRET);
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new DeploymentValidationError("Cloudflare Access service-token inputs must be provided together.");
  }
  return clientId
    ? {
        "CF-Access-Client-Id": clientId,
        "CF-Access-Client-Secret": clientSecret,
      }
    : {};
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

export function selectVpsStagingRuntimeTargetUrl({ pollResult, configuredTargetUrl = "", defaultUrl = defaultTargetUrl } = {}) {
  return normalizeRuntimeUrl(clean(pollResult?.status?.environment_url) || clean(configuredTargetUrl) || defaultUrl, "VPS staging");
}

async function responseJson(response, label) {
  if (!response.ok) throw new DeploymentValidationError(`${label} returned HTTP ${response.status}.`);
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

export function parsePrReleaseMetadata(metadataJson) {
  let metadata;
  try {
    metadata = JSON.parse(clean(metadataJson));
  } catch {
    throw new DeploymentValidationError("PR release metadata JSON is missing or malformed.");
  }
  if (metadata?.artifact_kind !== "pr-release-candidate") {
    throw new DeploymentValidationError("VPS staging deploy requires a PR release candidate artifact.");
  }
  if (metadata.source_repository !== "ramideltoro/nutsnews") {
    throw new DeploymentValidationError("VPS staging deploy requires a ramideltoro/nutsnews source artifact.");
  }
  requirePattern(metadata.source_commit, /^[0-9a-f]{40}$/, "PR release metadata source commit must be a full lowercase SHA.");
  requirePattern(metadata.source_workflow_run_id, /^[1-9][0-9]{0,19}$/, "PR release metadata source workflow run ID must be numeric.");
  requirePattern(metadata.build_id, /^[1-9][0-9]{0,19}-[1-9][0-9]{0,5}$/, "PR release metadata build ID must be run-attempt.");
  requirePattern(metadata.pr_number, /^[1-9][0-9]{0,9}$/, "PR release metadata PR number is required.");
  requirePattern(metadata.image_digest, /^sha256:[0-9a-f]{64}$/, "PR release metadata image digest must be immutable.");
  requirePattern(metadata.schema_version, /^[0-9]{14}$/, "PR release metadata schema version is required.");
  requirePattern(metadata.migration_head, /^[0-9]{14}$/, "PR release metadata migration head is required.");
  requirePattern(metadata.supabase_project_ref, /^[a-z0-9]{20}$/, "PR release metadata Supabase project ref is required.");
  if (metadata.image_repository !== "ghcr.io/ramideltoro/nutsnews" || metadata.image !== `${metadata.image_repository}@${metadata.image_digest}`) {
    throw new DeploymentValidationError("PR release metadata image reference must be digest-qualified.");
  }
  if (metadata.build_id.split("-", 1)[0] !== metadata.source_workflow_run_id) {
    throw new DeploymentValidationError("PR release metadata build ID must belong to the source workflow run.");
  }
  return metadata;
}

export function buildVpsStagingCandidate(metadata) {
  const candidate = {
    schema_version: metadata.schema_version,
    migration_head: metadata.migration_head,
    supabase_project_ref: metadata.supabase_project_ref,
    source_repository: metadata.source_repository,
    source_commit: metadata.source_commit,
    image_repository: metadata.image_repository,
    image_digest: metadata.image_digest,
    build_id: metadata.build_id,
    source_workflow_run_id: metadata.source_workflow_run_id,
  };
  if (Object.keys(candidate).sort().join("\n") !== candidateKeys.sort().join("\n")) {
    throw new DeploymentValidationError("Refusing to dispatch a VPS staging candidate with unexpected fields.");
  }
  return candidate;
}

export function computeVpsStagingDeploymentId(candidate) {
  return `stg-${crypto
    .createHash("sha256")
    .update(JSON.stringify(candidate, Object.keys(candidate).sort()))
    .digest("hex")
    .slice(0, 24)}`;
}

export async function revalidateCurrentPrHead({ fetchImpl = fetch, repository, prNumber, expectedHeadSha, token, timeoutMs = 120_000, sleep, now }) {
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
    { label: "Pull request lookup before VPS staging deploy", timeoutMs, initialDelayMs: 1_000, maxDelayMs: 10_000, sleep, now },
  );
  const currentHeadSha = clean(pullRequest?.head?.sha);
  if (currentHeadSha !== expectedHeadSha) {
    throw new DeploymentValidationError(`Current PR head changed before VPS staging deploy: expected ${expectedHeadSha}, received ${currentHeadSha || "missing"}.`);
  }
  return currentHeadSha;
}

export async function dispatchVpsStagingCandidate({ fetchImpl = fetch, token, candidate, timeoutMs, sleep, now }) {
  if (!token) throw new DeploymentValidationError("NUTSNEWS_INFRA_STAGING_TOKEN is required for VPS staging deploy dispatch.");
  await withBoundedExponentialBackoff(
    async () => {
      let response;
      try {
        response = await fetchImpl("https://api.github.com/repos/ramideltoro/nutsnews-infra/dispatches", {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: JSON.stringify({
            event_type: "nutsnews-staging-release",
            client_payload: candidate,
          }),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (error) {
        throw new DeploymentTransientError(`VPS staging dispatch transient request failure: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (response.status === 204) return;
      if (isTransientHttpStatus(response.status)) {
        throw new DeploymentTransientError(`VPS staging dispatch returned transient HTTP ${response.status}.`);
      }
      throw new DeploymentValidationError(`VPS staging dispatch returned HTTP ${response.status}.`);
    },
    { label: "VPS staging dispatch", timeoutMs, initialDelayMs: 2_000, maxDelayMs: 30_000, sleep, now },
  );
}

export async function verifyVpsStagingRuntime({ fetchImpl = fetch, env, metadata, deploymentId, targetUrl, timeoutMs, sleep, now }) {
  const baseUrl = new URL(targetUrl.endsWith("/") ? targetUrl : `${targetUrl}/`);
  const headers = {
    Accept: "application/json",
    ...protectedHeaders(env),
  };

  return withBoundedExponentialBackoff(
    async () => {
      const [healthResponse, readyResponse] = await Promise.all([
        fetchImpl(new URL("healthz", baseUrl), { headers, signal: AbortSignal.timeout(15_000) }),
        fetchImpl(new URL(`readyz?cache-bust=${encodeURIComponent(deploymentId)}`, baseUrl), {
          headers: { ...headers, "Cache-Control": "no-store" },
          signal: AbortSignal.timeout(15_000),
        }),
      ]);
      for (const [response, label] of [
        [healthResponse, "VPS staging health"],
        [readyResponse, "VPS staging readiness"],
      ]) {
        if (!response.ok) {
          if (isTransientHttpStatus(response.status)) {
            throw new DeploymentTransientError(`${label} returned transient HTTP ${response.status}.`);
          }
          throw new DeploymentValidationError(`${label} returned HTTP ${response.status}.`);
        }
      }
      const health = await responseJson(healthResponse, "VPS staging health");
      const ready = await responseJson(readyResponse, "VPS staging readiness");

      assertEqual(health.sourceCommit, metadata.source_commit, "Health source commit");
      assertEqual(health.buildId, metadata.build_id, "Health build ID");
      assertEqual(healthResponse.headers.get("x-nutsnews-source-commit"), metadata.source_commit, "Health source commit header");
      assertEqual(healthResponse.headers.get("x-nutsnews-build-id"), metadata.build_id, "Health build ID header");
      assertEqual(ready.runtimeEnv, "staging", "Readiness runtime environment");
      assertEqual(readyResponse.headers.get("x-nutsnews-runtime-environment"), "staging", "Readiness runtime environment header");
      assertEqual(readyResponse.headers.get("x-nutsnews-deployment-target"), "vps-staging", "Readiness deployment target header");
      assertEqual(readyResponse.headers.get("x-nutsnews-source-commit"), metadata.source_commit, "Readiness source commit header");
      assertEqual(readyResponse.headers.get("x-nutsnews-build-id"), metadata.build_id, "Readiness build ID header");
      assertEqual(readyResponse.headers.get("x-nutsnews-expected-image-digest"), metadata.image_digest, "Readiness image digest header");
      return { runtime_env: "staging", deployment_target: "vps-staging" };
    },
    { label: "VPS staging runtime identity", timeoutMs, initialDelayMs: 5_000, maxDelayMs: 30_000, sleep, now },
  );
}

export function verifiedVpsStagingRuntimeIdentity({ metadata, deploymentId, pollResult }) {
  const payload = pollResult?.deployment?.payload ?? {};
  const configGeneration = clean(payload.config_generation);
  const targetHostname = clean(payload.target_hostname);
  const description = clean(pollResult?.status?.description);

  assertEqual(targetHostname, "staging.nutsnews.com", "Infra staging target hostname");
  requirePattern(
    configGeneration,
    new RegExp(`^staging-${deploymentId}-[0-9a-f]{12}$`),
    "Infra staging deployment status must include the verified config generation.",
  );
  if (!description.includes(`actual=${metadata.image_digest}`)) {
    throw new DeploymentValidationError("Infra staging deployment status did not confirm the running image digest.");
  }

  return { runtime_env: "staging", deployment_target: "vps-staging" };
}

function extractInfraRunId(pollResult) {
  const candidates = [
    pollResult?.status?.log_url,
    pollResult?.status?.target_url,
    pollResult?.deployment?.payload?.infra_run_id,
    pollResult?.deployment?.payload?.workflow_run_id,
  ].map(clean);
  for (const candidate of candidates) {
    const match = candidate.match(/(?:^|\/)([1-9][0-9]{0,19})(?:$|[/?#])/);
    if (match) return match[1];
    if (/^[1-9][0-9]{0,19}$/.test(candidate)) return candidate;
  }
  throw new DeploymentValidationError("VPS staging deployment status did not expose an infra run ID.");
}

export function buildVpsStagingEvidence({ env, metadata, deploymentId, targetUrl, pollResult, runtimeIdentity, result = "success" }) {
  const infraRunId = extractInfraRunId(pollResult);
  const idempotencyKey = deploymentStageIdempotencyKey({
    prNumber: metadata.pr_number,
    sourceCommit: metadata.source_commit,
    targetType: "vps-staging",
  });
  return {
    schema_version: 1,
    stage: "deploy-vps-staging",
    result,
    pr_number: metadata.pr_number,
    target_type: "vps-staging",
    target_url: targetUrl,
    runtime_env: runtimeIdentity.runtime_env,
    deployment_target: runtimeIdentity.deployment_target,
    source_commit: metadata.source_commit,
    build_id: metadata.build_id,
    image_digest: metadata.image_digest,
    image: metadata.image,
    deployment_id: deploymentId,
    github_deployment_id: String(pollResult.deployment?.id ?? ""),
    infra_run_id: infraRunId,
    idempotency_key: idempotencyKey,
    workflow_run_id: clean(env.GITHUB_RUN_ID),
    workflow_run_attempt: clean(env.GITHUB_RUN_ATTEMPT),
    status_log_url: clean(pollResult.status?.log_url),
  };
}

export function writeEvidence(path, evidence) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

export async function runPrVpsStagingDeploy(env = process.env, adapters = {}) {
  const metadata = parsePrReleaseMetadata(env.PR_RELEASE_METADATA_JSON);
  const trustedHeadSha = requirePattern(env.TRUSTED_PR_HEAD_SHA || metadata.source_commit, /^[0-9a-f]{40}$/, "Trusted PR head SHA is required.");
  if (trustedHeadSha !== metadata.source_commit) {
    throw new DeploymentValidationError("Trusted PR head SHA does not match the immutable PR release artifact.");
  }
  const repository = clean(env.GITHUB_REPOSITORY) || "ramideltoro/nutsnews";
  const githubToken = clean(env.GITHUB_TOKEN);
  if (!githubToken) throw new DeploymentValidationError("GITHUB_TOKEN is required for PR head revalidation.");
  const timeoutMs = Number(env.NUTSNEWS_DEPLOY_HARDENING_TIMEOUT_MS || 900_000);
  await revalidateCurrentPrHead({
    fetchImpl: adapters.fetchImpl,
    repository,
    prNumber: metadata.pr_number,
    expectedHeadSha: metadata.source_commit,
    token: githubToken,
    timeoutMs: Math.min(timeoutMs, 120_000),
    sleep: adapters.sleep,
    now: adapters.now,
  });

  const candidate = buildVpsStagingCandidate(metadata);
  const deploymentId = computeVpsStagingDeploymentId(candidate);
  const targetUrl = clean(env.NUTSNEWS_VPS_STAGING_URL) || defaultTargetUrl;

  await dispatchVpsStagingCandidate({
    fetchImpl: adapters.fetchImpl,
    token: env.NUTSNEWS_INFRA_STAGING_TOKEN,
    candidate,
    timeoutMs,
    sleep: adapters.sleep,
    now: adapters.now,
  });
  const pollResult = await pollInfraGitHubDeployment({
    fetchImpl: adapters.fetchImpl,
    repository: "ramideltoro/nutsnews-infra",
    environment: "staging",
    deploymentId,
    token: env.NUTSNEWS_INFRA_STAGING_TOKEN,
    expectedSourceCommit: metadata.source_commit,
    expectedBuildId: metadata.build_id,
    expectedImageDigest: metadata.image_digest,
    timeoutMs,
    initialDelayMs: 5_000,
    maxDelayMs: 30_000,
    sleep: adapters.sleep,
    now: adapters.now,
  });
  const verifiedTargetUrl = selectVpsStagingRuntimeTargetUrl({ pollResult, configuredTargetUrl: targetUrl });
  const runtimeIdentity = verifiedVpsStagingRuntimeIdentity({ metadata, deploymentId, pollResult });

  return buildVpsStagingEvidence({ env, metadata, deploymentId, targetUrl: verifiedTargetUrl, pollResult, runtimeIdentity });
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const evidencePath = clean(process.env.NUTSNEWS_VPS_STAGING_EVIDENCE_PATH) || resolve(process.cwd(), "vps-staging-deploy-evidence.json");
  try {
    const evidence = await runPrVpsStagingDeploy(process.env);
    writeEvidence(evidencePath, evidence);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        [
          `deployment_id=${evidence.deployment_id}`,
          `target_url=${evidence.target_url}`,
          `infra_run_id=${evidence.infra_run_id}`,
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
          "## VPS staging deploy",
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
