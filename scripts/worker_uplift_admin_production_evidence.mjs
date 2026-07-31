#!/usr/bin/env node

import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIR, "..");
const WEB_PACKAGE_JSON = resolve(REPOSITORY_ROOT, "web", "package.json");

export const EXPECTED_STAGES = Object.freeze([
  "scheduler",
  "fetcher",
  "canonicalizer",
  "enrichment",
  "approval",
  "translation",
  "persistence",
  "publication",
]);

export const MAIN_CONSUMER_STAGES = Object.freeze(
  EXPECTED_STAGES.filter((stage) => stage !== "scheduler"),
);

const ALLOWED_METHODS = new Set(["GET", "HEAD"]);
const ALLOWED_STAGE_STATUSES = new Set([
  "healthy",
  "degraded",
  "failed",
  "stale",
  "unknown",
  "legacy only",
  "rollback",
  "unavailable",
]);
const ALLOWED_OWNERS = new Set([
  "legacy shards",
  "coexistence",
  "worker uplift",
  "rollback",
  "unknown",
]);
const VERCEL_SECRET_TYPES = new Set(["encrypted", "secret", "sensitive"]);
const ENCRYPTED_ENVELOPE_KEYS = new Set([
  "encrypted",
  "ciphertext",
  "encryptedvalue",
  "vsmvalue",
  "keyid",
]);
const EMAIL_PATTERN = /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/;
const FORBIDDEN_VALUE_PATTERNS = [
  /(?:^|[^a-z])(?:token|secret|password|cookie|authorization)(?:$|[^a-z])/i,
  /(?:amqp|postgres(?:ql)?|redis):\/\//i,
  /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)/i,
  /(?:^|[^a-z0-9])[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}(?:$|[^a-z0-9])/i,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----/,
];

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function requirePattern(value, pattern, name) {
  const normalized = requireNonEmptyString(value, name);
  if (!pattern.test(normalized)) {
    throw new Error(`${name} is invalid`);
  }
  return normalized;
}

function normalizeOrigin(value, name) {
  const normalized = requireNonEmptyString(value, name).replace(/\/+$/, "");
  const parsed = new URL(normalized);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error(`${name} must be a credential-free https origin`);
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${name} must not include a path, query, or fragment`);
  }
  return parsed.origin;
}

function parseIntegerText(value, name, { allowDash = false } = {}) {
  const normalized = String(value ?? "").trim();
  if (allowDash && normalized === "—") {
    return null;
  }
  if (!/^[0-9][0-9,]*$/.test(normalized)) {
    throw new Error(`${name} must render as a non-negative integer`);
  }
  return Number.parseInt(normalized.replaceAll(",", ""), 10);
}

function normalizeLabel(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function assertSafePublicValue(value, path) {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return;
  }
  if (typeof value === "string") {
    if (value.length > 512) {
      throw new Error(`${path} exceeds the evidence value length limit`);
    }
    for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        throw new Error(`${path} contains a forbidden private or personal value`);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSafePublicValue(entry, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (
        /token|secret|password|cookie|authorization|email/i.test(key) &&
        !key.endsWith("_retained")
      ) {
        throw new Error(`${path}.${key} is a forbidden evidence field`);
      }
      assertSafePublicValue(entry, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`${path} has an unsupported evidence value`);
}

export function validateSafeStateContracts() {
  const staleFixture = {
    available: true,
    overall_status: "stale",
    stage_status: "stale",
    stale_status: "stale",
    detail: "Stale",
  };
  const unavailableFixture = {
    available: false,
    overall_status: "unavailable",
    stage_count: 0,
    detail: "Projection unavailable.",
  };
  assertSafePublicValue(staleFixture, "stale_fixture");
  assertSafePublicValue(unavailableFixture, "unavailable_fixture");
  if (
    staleFixture.overall_status !== "stale" ||
    staleFixture.stale_status !== "stale" ||
    unavailableFixture.available !== false ||
    unavailableFixture.overall_status !== "unavailable"
  ) {
    throw new Error("safe stale/unavailable contracts are invalid");
  }
  return {
    stale_projection: "pass",
    unavailable_projection: "pass",
    private_value_rejection: "pass",
  };
}

export function validateEvidence(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new Error("evidence must be an object");
  }
  if (evidence.schema_version !== 1 || evidence.result !== "pass") {
    throw new Error("evidence must be a passing schema version 1 document");
  }
  if (!Number.isFinite(Date.parse(evidence.checked_at))) {
    throw new Error("checked_at must be an ISO-8601 timestamp");
  }

  const candidate = evidence.candidate;
  requirePattern(candidate?.source_commit, /^[0-9a-f]{40}$/, "candidate.source_commit");
  requirePattern(candidate?.build_id, /^[1-9][0-9]{0,19}-[1-9][0-9]{0,5}$/, "candidate.build_id");
  requirePattern(
    candidate?.release_deployment_id,
    /^dpl_[A-Za-z0-9]+$/,
    "candidate.release_deployment_id",
  );
  normalizeOrigin(candidate?.release_deployment_url, "candidate.release_deployment_url");
  if (
    candidate?.source_repository !== "ramideltoro/nutsnews" ||
    candidate?.canonical_origin !== "https://www.nutsnews.com" ||
    candidate?.canonical_runtime_target !== "production-vps" ||
    candidate?.canonical_runtime_verification !== "pass" ||
    candidate?.release_deployment_target !== "production" ||
    candidate?.release_provider_verification !== "pass"
  ) {
    throw new Error("candidate identity is not an exact verified production deployment");
  }

  if (
    evidence.access?.unauthenticated?.result !== "rejected" ||
    evidence.access.unauthenticated.initial_status !== 307 ||
    evidence.access.unauthenticated.final_path !== "/admin/login"
  ) {
    throw new Error("unauthenticated access rejection evidence is incomplete");
  }
  if (
    evidence.access?.authorized?.result !== "allowed" ||
    evidence.access.authorized.status !== 200 ||
    evidence.access.authorized.final_path !== "/admin/shards" ||
    evidence.access.authorized.identity_source !== "github_protected_environment" ||
    evidence.access.authorized.auth_runtime_source !== "vercel_production_environment" ||
    evidence.access.authorized.allowlist_source !== "vercel_production_environment" ||
    evidence.access.authorized.session_retained !== false
  ) {
    throw new Error("authorized access evidence is incomplete");
  }

  const projection = evidence.projection;
  if (
    projection?.available !== true ||
    projection?.active_ingestion_owner !== "legacy shards" ||
    projection?.write_policy !== "shadow" ||
    !["healthy", "degraded", "partial"].includes(projection?.overall_status) ||
    !Number.isInteger(projection?.schema_version) ||
    projection.schema_version < 1 ||
    projection?.stage_count !== EXPECTED_STAGES.length ||
    typeof projection.queue_age !== "string" ||
    projection.queue_age === "—" ||
    !Number.isInteger(projection.dlq_total) ||
    projection.dlq_total < 0
  ) {
    throw new Error("current shadow projection evidence is incomplete or unsafe");
  }
  if (
    !Array.isArray(projection.stages) ||
    projection.stages.map((row) => row.stage).join(",") !== EXPECTED_STAGES.join(",")
  ) {
    throw new Error("projection stage identity or ordering does not match the contract");
  }
  for (const row of projection.stages) {
    if (!ALLOWED_STAGE_STATUSES.has(row.status)) {
      throw new Error(`unexpected stage status for ${row.stage}`);
    }
    if (!ALLOWED_OWNERS.has(row.owner) || row.owner !== "legacy shards") {
      throw new Error(`unexpected stage owner for ${row.stage}`);
    }
    if (
      !Number.isInteger(row.retries) ||
      row.retries < 0 ||
      !Number.isInteger(row.dlq) ||
      row.dlq < 0 ||
      typeof row.queue_age !== "string" ||
      typeof row.deployment_version !== "string"
    ) {
      throw new Error(`stage telemetry is invalid for ${row.stage}`);
    }
    if (
      ["stale", "unknown", "legacy only", "rollback", "unavailable"].includes(row.status)
    ) {
      throw new Error(`stage telemetry is not current for ${row.stage}`);
    }
    if (row.deployment_version.trim() === "" || row.deployment_version === "—") {
      throw new Error(`candidate identity is missing for ${row.stage}`);
    }
    if (MAIN_CONSUMER_STAGES.includes(row.stage)) {
      if (!Number.isInteger(row.consumers) || row.consumers < 1) {
        throw new Error(`main queue has zero or unknown consumers for ${row.stage}`);
      }
      if (row.queue_age.trim() === "" || row.queue_age === "—") {
        throw new Error(`main queue age is missing for ${row.stage}`);
      }
    } else if (row.consumers !== null) {
      throw new Error("scheduler must not claim a main-queue consumer count");
    }
  }

  if (
    evidence.safe_state_contracts?.stale_projection !== "pass" ||
    evidence.safe_state_contracts?.unavailable_projection !== "pass" ||
    evidence.safe_state_contracts?.private_value_rejection !== "pass"
  ) {
    throw new Error("safe-state contract evidence is incomplete");
  }
  if (
    evidence.safety?.allowed_http_methods?.join(",") !== "GET,HEAD" ||
    evidence.safety.observed_disallowed_requests !== 0 ||
    evidence.safety.admin_mutation !== false ||
    evidence.safety.production_write !== false ||
    evidence.safety.cutover !== false ||
    evidence.safety.dns_or_failover_change !== false ||
    evidence.safety.legacy_worker_change !== false
  ) {
    throw new Error("read-only safety evidence is incomplete");
  }
  if (
    evidence.redaction?.cookies_retained !== false ||
    evidence.redaction.credentials_retained !== false ||
    evidence.redaction.payloads_retained !== false ||
    evidence.redaction.personal_values_retained !== false ||
    evidence.redaction.private_endpoints_retained !== false
  ) {
    throw new Error("redaction evidence is incomplete");
  }
  requirePattern(
    evidence.workflow?.evidence_tool_commit,
    /^[0-9a-f]{40}$/,
    "workflow.evidence_tool_commit",
  );
  if (evidence.workflow?.evidence_tool_repository !== "ramideltoro/nutsnews") {
    throw new Error("evidence tool repository is invalid");
  }

  assertSafePublicValue(evidence, "evidence");
  return evidence;
}

export function parsePipelineProjection(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.metrics) || !Array.isArray(raw.rows)) {
    throw new Error("worker-uplift section could not be parsed");
  }
  const metrics = Object.fromEntries(
    raw.metrics.map((entry) => [normalizeLabel(entry.label), String(entry.value ?? "").trim()]),
  );
  const requiredMetrics = ["owner", "overall", "blocked stages", "dlq", "queue age", "writes"];
  for (const label of requiredMetrics) {
    if (!(label in metrics)) {
      throw new Error(`worker-uplift metric ${label} is missing`);
    }
  }
  if (normalizeLabel(metrics.owner) !== "legacy shards") {
    throw new Error("legacy shards are not the displayed ingestion owner");
  }
  if (normalizeLabel(metrics.writes) !== "shadow") {
    throw new Error("worker-uplift production writes are not disabled");
  }
  const stages = raw.rows.map((cells, index) => {
    if (!Array.isArray(cells) || cells.length < 11) {
      throw new Error(`worker-uplift row ${index} is incomplete`);
    }
    const stage = normalizeLabel(cells[0]);
    return {
      stage,
      status: normalizeLabel(cells[1]),
      owner: normalizeLabel(cells[2]),
      queue_age: String(cells[6]).trim(),
      retries: parseIntegerText(cells[7], `${stage}.retries`),
      dlq: parseIntegerText(cells[8], `${stage}.dlq`),
      consumers: parseIntegerText(cells[9], `${stage}.consumers`, { allowDash: true }),
      deployment_version: String(cells[10]).trim(),
    };
  });
  return {
    available: raw.available === true,
    active_ingestion_owner: normalizeLabel(metrics.owner),
    overall_status: normalizeLabel(metrics.overall),
    write_policy: normalizeLabel(metrics.writes),
    blocked_stages: parseIntegerText(metrics["blocked stages"], "blocked_stages"),
    dlq_total: parseIntegerText(metrics.dlq, "dlq_total"),
    queue_age: metrics["queue age"],
    schema_version: Number.parseInt(String(raw.projectionVersion ?? "").replace(/\D/g, ""), 10),
    stage_count: stages.length,
    stages,
  };
}

async function verifyVercelDeployment({
  deploymentId,
  deploymentUrl,
  sourceCommit,
  vercelToken,
  vercelOrgId,
}) {
  const response = await fetch(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(deploymentId)}?teamId=${encodeURIComponent(vercelOrgId)}`,
    {
      headers: {
        Authorization: `Bearer ${vercelToken}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`vercel_deployment_verification_http_${response.status}`);
  }
  const deployment = await response.json();
  assertVercelDeploymentIdentity(deployment, {
    deploymentId,
    deploymentUrl,
    sourceCommit,
  });
  return extractVercelProjectId(deployment);
}

export function assertVercelDeploymentIdentity(
  deployment,
  { deploymentId, deploymentUrl, sourceCommit },
) {
  const requestedHost = new URL(deploymentUrl).hostname;
  const providerIds = [deployment?.id, deployment?.uid].filter(
    (value) => typeof value === "string" && value.length > 0,
  );
  if (
    !providerIds.includes(deploymentId) ||
    deployment?.readyState !== "READY" ||
    deployment?.target !== "production" ||
    deployment?.url !== requestedHost ||
    deployment?.meta?.githubCommitSha !== sourceCommit
  ) {
    throw new Error("vercel_deployment_identity_mismatch");
  }
}

export function extractVercelProjectId(deployment) {
  const projectIds = [deployment?.projectId, deployment?.project?.id].filter(
    (value) => typeof value === "string" && /^prj_[A-Za-z0-9]+$/.test(value),
  );
  const uniqueProjectIds = [...new Set(projectIds)];
  if (uniqueProjectIds.length === 0) {
    throw new Error("vercel_project_identity_missing");
  }
  if (uniqueProjectIds.length !== 1) {
    throw new Error("vercel_project_identity_mismatch");
  }
  return uniqueProjectIds[0];
}

function looksLikeEncryptedEnvelope(value) {
  if (typeof value !== "string" || !value.trimStart().startsWith("{")) {
    return false;
  }
  try {
    const parsed = JSON.parse(value);
    return (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      Object.keys(parsed).some((key) => ENCRYPTED_ENVELOPE_KEYS.has(key.toLowerCase()))
    );
  } catch {
    return false;
  }
}

function vercelEnvironmentRecords(payload) {
  const records = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? (payload.envs ?? payload.data)
      : null;
  if (!Array.isArray(records) || !records.every((record) => record && typeof record === "object")) {
    throw new Error("vercel_environment_list_invalid");
  }
  return records;
}

function targetsProduction(record) {
  const targets = typeof record.target === "string" ? [record.target] : record.target;
  return Array.isArray(targets) && targets.includes("production");
}

export function selectVercelProductionAuthRecords(payload) {
  const requiredKeys = ["AUTH_SECRET", "ADMIN_EMAILS"];
  const selected = new Map();
  for (const record of vercelEnvironmentRecords(payload)) {
    if (!requiredKeys.includes(record.key) || !targetsProduction(record)) {
      continue;
    }
    if (selected.has(record.key)) {
      throw new Error("vercel_production_auth_record_duplicate");
    }
    if (typeof record.id !== "string" || record.id.trim() === "") {
      throw new Error("vercel_production_auth_record_id_missing");
    }
    selected.set(record.key, record);
  }
  if (!requiredKeys.every((key) => selected.has(key))) {
    throw new Error("vercel_production_auth_record_missing");
  }
  return Object.fromEntries(selected);
}

function requireDecryptedVercelValue(record, key) {
  if (!record || typeof record !== "object") {
    throw new Error("vercel_production_auth_detail_invalid");
  }
  if (typeof record.value !== "string" || record.value.trim() === "") {
    throw new Error("vercel_production_auth_value_missing");
  }
  if (
    record.decrypted === false ||
    (VERCEL_SECRET_TYPES.has(String(record.type ?? "").toLowerCase()) &&
      record.decrypted !== true)
  ) {
    throw new Error("vercel_production_auth_value_not_decrypted");
  }
  if (
    record.value.includes("\n") ||
    record.value.includes("\r") ||
    looksLikeEncryptedEnvelope(record.value)
  ) {
    throw new Error("vercel_production_auth_value_unsafe");
  }
  if (key === "AUTH_SECRET" && (record.value.length < 32 || record.value.length > 512)) {
    throw new Error("vercel_production_auth_secret_invalid");
  }
  return record.value;
}

export function validateVercelProductionAuthInputs({
  authSecretRecord,
  adminEmailsRecord,
  evidenceIdentity,
}) {
  const normalizedIdentity = requireNonEmptyString(
    evidenceIdentity,
    "NUTSNEWS_ADMIN_EVIDENCE_EMAIL",
  ).toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedIdentity)) {
    throw new Error("admin_evidence_identity_invalid");
  }
  const authSecret = requireDecryptedVercelValue(authSecretRecord, "AUTH_SECRET");
  const adminEmails = requireDecryptedVercelValue(adminEmailsRecord, "ADMIN_EMAILS")
    .split(",")
    .map((entry) => entry.trim().toLowerCase());
  if (adminEmails.length === 0 || adminEmails.some((entry) => !EMAIL_PATTERN.test(entry))) {
    throw new Error("vercel_production_admin_allowlist_invalid");
  }
  if (!adminEmails.includes(normalizedIdentity)) {
    throw new Error("admin_evidence_identity_not_allowlisted");
  }
  return { authSecret };
}

async function fetchVercelJson(url, token, errorPrefix) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch {
    throw new Error(`${errorPrefix}_request_failed`);
  }
  if (!response.ok) {
    throw new Error(`${errorPrefix}_http_${response.status}`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${errorPrefix}_response_invalid`);
  }
}

async function fetchVercelProductionAuthInputs({
  projectId,
  teamId,
  token,
  evidenceIdentity,
}) {
  const projectPath = encodeURIComponent(projectId);
  const teamQuery = `teamId=${encodeURIComponent(teamId)}`;
  const metadata = await fetchVercelJson(
    `https://api.vercel.com/v10/projects/${projectPath}/env?${teamQuery}&source=worker-uplift-admin-evidence`,
    token,
    "vercel_environment_list",
  );
  const selected = selectVercelProductionAuthRecords(metadata);
  const details = await Promise.all(
    ["AUTH_SECRET", "ADMIN_EMAILS"].map(async (key) => {
      const record = selected[key];
      const detail = await fetchVercelJson(
        `https://api.vercel.com/v1/projects/${projectPath}/env/${encodeURIComponent(record.id)}?${teamQuery}`,
        token,
        "vercel_environment_detail",
      );
      if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
        throw new Error("vercel_production_auth_detail_invalid");
      }
      return [
        key,
        {
          ...detail,
          type: detail.type ?? record.type,
        },
      ];
    }),
  );
  const detailByKey = Object.fromEntries(details);
  return validateVercelProductionAuthInputs({
    authSecretRecord: detailByKey.AUTH_SECRET,
    adminEmailsRecord: detailByKey.ADMIN_EMAILS,
    evidenceIdentity,
  });
}

async function verifyCanonicalRuntime({ targetOrigin, sourceCommit, buildId }) {
  const response = await fetch(`${targetOrigin}/api/runtime-config`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`canonical_runtime_verification_http_${response.status}`);
  }
  const runtime = await response.json();
  if (
    runtime?.sourceCommit !== sourceCommit ||
    runtime?.buildId !== buildId ||
    runtime?.deploymentTarget !== "production-vps" ||
    runtime?.runtimeEnv !== "production"
  ) {
    throw new Error("canonical_runtime_identity_mismatch");
  }
  return runtime.deploymentTarget;
}

async function collectPipelineSection(page) {
  const section = page.locator("#worker-uplift-pipeline");
  await section.waitFor({ state: "visible" });
  return section.evaluate((element) => {
    const metricGrid = element.querySelector(":scope > div:nth-of-type(2)");
    const metrics = Array.from(metricGrid?.children ?? []).map((card) => ({
      label: card.querySelector("p")?.textContent?.trim() ?? "",
      value: card.querySelector("h3")?.textContent?.trim() ?? "",
    }));
    const unavailable = Array.from(element.querySelectorAll("div")).some((entry) =>
      entry.textContent?.includes("Worker-uplift projection is not available"),
    );
    const rows = Array.from(element.querySelectorAll("tbody tr")).map((row) =>
      Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent?.trim() ?? ""),
    );
    const projectionVersion =
      Array.from(metricGrid?.children ?? [])
        .find((card) => card.querySelector("p")?.textContent?.trim() === "Overall")
        ?.querySelectorAll("p")?.[1]?.textContent?.trim() ?? "";
    return {
      available: !unavailable,
      metrics,
      rows,
      projectionVersion,
    };
  });
}

export function classifyLivePhaseError(phase, error) {
  const errorName = error?.name ?? error?.constructor?.name ?? "";
  const suffix = /^TimeoutError/.test(errorName) ? "timeout" : "failed";
  return new Error(`${phase}_${suffix}`);
}

export function classifyEvidenceContractError(error) {
  const message = error instanceof Error ? error.message : "";
  const stage = EXPECTED_STAGES.find((name) => message.endsWith(` ${name}`));
  if (message.startsWith("unexpected stage status for ")) {
    return `stage_status_${stage ?? "invalid"}`;
  }
  if (message.startsWith("unexpected stage owner for ")) {
    return `stage_owner_${stage ?? "invalid"}`;
  }
  if (message.startsWith("stage telemetry is invalid for ")) {
    return `stage_telemetry_${stage ?? "invalid"}`;
  }
  if (message.startsWith("stage telemetry is not current for ")) {
    return `stage_not_current_${stage ?? "invalid"}`;
  }
  if (message.startsWith("candidate identity is missing for ")) {
    return `stage_candidate_${stage ?? "invalid"}`;
  }
  if (message.startsWith("main queue has zero or unknown consumers for ")) {
    return `stage_consumers_${stage ?? "invalid"}`;
  }
  if (message.startsWith("main queue age is missing for ")) {
    return `stage_queue_age_${stage ?? "invalid"}`;
  }
  const fixedClassifications = [
    ["evidence must be an object", "document_invalid"],
    ["evidence must be a passing schema version 1 document", "document_result"],
    ["checked_at must be an ISO-8601 timestamp", "checked_at"],
    ["candidate identity is not an exact verified production deployment", "candidate_identity"],
    ["unauthenticated access rejection evidence is incomplete", "unauthenticated_access"],
    ["authorized access evidence is incomplete", "authorized_access"],
    ["current shadow projection evidence is incomplete or unsafe", "projection_summary"],
    ["projection stage identity or ordering does not match the contract", "stage_order"],
    ["scheduler must not claim a main-queue consumer count", "scheduler_consumers"],
    ["safe-state contract evidence is incomplete", "safe_state"],
    ["read-only safety evidence is incomplete", "read_only_safety"],
    ["redaction evidence is incomplete", "redaction"],
    ["evidence tool repository is invalid", "tool_repository"],
  ];
  const fixed = fixedClassifications.find(([prefix]) => message.startsWith(prefix));
  if (fixed) {
    return fixed[1];
  }
  if (
    message.includes("forbidden evidence field") ||
    message.includes("forbidden private or personal value")
  ) {
    return "private_value";
  }
  if (message.startsWith("workflow.evidence_tool_commit")) {
    return "tool_commit";
  }
  return "invalid";
}

export function classifyReadPhaseError(phase, error) {
  if (phase === "evidence_contract") {
    return new Error(`${phase}_${classifyEvidenceContractError(error)}`);
  }
  const safeDetail =
    error instanceof Error && /^[a-z0-9_]+$/i.test(error.message)
      ? error.message
      : "error";
  return new Error(`${phase}_${safeDetail}`);
}

async function runReadPhase(phase, operation) {
  process.stdout.write(`Evidence phase started: ${phase}\n`);
  try {
    const result = await operation();
    process.stdout.write(`Evidence phase passed: ${phase}\n`);
    return result;
  } catch (error) {
    throw classifyReadPhaseError(phase, error);
  }
}

export async function runLiveEvidence(environment = process.env) {
  const sourceRepository = environment.GITHUB_REPOSITORY || "ramideltoro/nutsnews";
  if (sourceRepository !== "ramideltoro/nutsnews") {
    throw new Error("source repository must be ramideltoro/nutsnews");
  }
  const sourceCommit = requirePattern(
    environment.SOURCE_COMMIT,
    /^[0-9a-f]{40}$/,
    "SOURCE_COMMIT",
  );
  const buildId = requirePattern(
    environment.BUILD_ID,
    /^[1-9][0-9]{0,19}-[1-9][0-9]{0,5}$/,
    "BUILD_ID",
  );
  const deploymentId = requirePattern(
    environment.VERCEL_DEPLOYMENT_ID,
    /^dpl_[A-Za-z0-9]+$/,
    "VERCEL_DEPLOYMENT_ID",
  );
  const deploymentUrl = normalizeOrigin(environment.VERCEL_DEPLOYMENT_URL, "VERCEL_DEPLOYMENT_URL");
  const targetOrigin = normalizeOrigin(environment.TARGET_ORIGIN, "TARGET_ORIGIN");
  if (targetOrigin !== "https://www.nutsnews.com") {
    throw new Error("TARGET_ORIGIN must be the canonical production origin");
  }
  if (environment.CONFIRM_READ_ONLY !== "verify-authenticated-admin-read-only") {
    throw new Error("read-only confirmation is missing");
  }

  const adminEvidenceIdentity = requireNonEmptyString(
    environment.NUTSNEWS_ADMIN_EVIDENCE_EMAIL,
    "NUTSNEWS_ADMIN_EVIDENCE_EMAIL",
  );
  const vercelToken = requireNonEmptyString(environment.VERCEL_TOKEN, "VERCEL_TOKEN");
  const vercelOrgId = requireNonEmptyString(environment.VERCEL_ORG_ID, "VERCEL_ORG_ID");
  const outputPath = requireNonEmptyString(environment.EVIDENCE_PATH, "EVIDENCE_PATH");
  const evidenceToolCommit = requirePattern(
    environment.EVIDENCE_TOOL_COMMIT,
    /^[0-9a-f]{40}$/,
    "EVIDENCE_TOOL_COMMIT",
  );

  const vercelProjectId = await runReadPhase("provider_deployment_identity", () =>
    verifyVercelDeployment({
      deploymentId,
      deploymentUrl,
      sourceCommit,
      vercelToken,
      vercelOrgId,
    }),
  );
  const { authSecret } = await runReadPhase("provider_runtime_auth", () =>
    fetchVercelProductionAuthInputs({
      projectId: vercelProjectId,
      teamId: vercelOrgId,
      token: vercelToken,
      evidenceIdentity: adminEvidenceIdentity,
    }),
  );
  const canonicalRuntimeTarget = await runReadPhase("canonical_runtime_identity", () =>
    verifyCanonicalRuntime({
      targetOrigin,
      sourceCommit,
      buildId,
    }),
  );

  const requireFromWeb = createRequire(WEB_PACKAGE_JSON);
  const { chromium } = requireFromWeb("@playwright/test");
  const { encode } = requireFromWeb("@auth/core/jwt");
  const browser = await runReadPhase("browser_launch", () =>
    chromium.launch({ headless: true }),
  );
  const observedDisallowedRequests = [];
  try {
    const unauthenticated = await browser.newContext();
    const unauthenticatedPage = await unauthenticated.newPage();
    let initialUnauthorizedStatus = null;
    unauthenticatedPage.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin === targetOrigin && url.pathname === "/admin/shards") {
        initialUnauthorizedStatus = response.status();
      }
    });
    try {
      await unauthenticatedPage.goto(`${targetOrigin}/admin/shards`, {
        waitUntil: "domcontentloaded",
      });
    } catch (error) {
      throw classifyLivePhaseError("unauthenticated_navigation", error);
    }
    const unauthenticatedFinalPath = new URL(unauthenticatedPage.url()).pathname;
    await unauthenticated.close();
    if (initialUnauthorizedStatus !== 307 || unauthenticatedFinalPath !== "/admin/login") {
      throw new Error("unauthenticated_access_not_rejected");
    }
    process.stdout.write("Evidence phase passed: unauthenticated_access\n");

    const cookieName = "__Secure-authjs.session-token";
    const sessionValue = await runReadPhase("authorized_session_construction", () =>
      encode({
        token: {
          email: adminEvidenceIdentity,
          sub: "worker-uplift-read-only-evidence",
        },
        secret: authSecret,
        salt: cookieName,
        maxAge: 300,
      }),
    );
    const authenticated = await browser.newContext();
    await runReadPhase("authorized_session_installation", () =>
      authenticated.addCookies([
        {
          name: cookieName,
          value: sessionValue,
          domain: "www.nutsnews.com",
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
          expires: Math.floor(Date.now() / 1000) + 300,
        },
      ]),
    );
    await authenticated.route("**/*", async (route) => {
      const method = route.request().method().toUpperCase();
      if (!ALLOWED_METHODS.has(method)) {
        observedDisallowedRequests.push(method);
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    const authenticatedPage = await authenticated.newPage();
    let response;
    try {
      response = await authenticatedPage.goto(`${targetOrigin}/admin/shards`, {
        waitUntil: "domcontentloaded",
      });
    } catch (error) {
      throw classifyLivePhaseError("authorized_navigation", error);
    }
    const authorizedStatus = response?.status() ?? 0;
    const authorizedFinalPath = new URL(authenticatedPage.url()).pathname;
    if (authorizedStatus !== 200 || authorizedFinalPath !== "/admin/shards") {
      throw new Error("authorized_access_rejected");
    }
    process.stdout.write("Evidence phase passed: authorized_access\n");
    let rawProjection;
    try {
      rawProjection = await collectPipelineSection(authenticatedPage);
    } catch (error) {
      throw classifyLivePhaseError("authorized_projection", error);
    }
    process.stdout.write("Evidence phase passed: authorized_projection_collection\n");
    const projection = await runReadPhase("projection_contract", () =>
      parsePipelineProjection(rawProjection),
    );
    await authenticated.close();

    const evidence = {
      schema_version: 1,
      result: "pass",
      checked_at: new Date().toISOString(),
      candidate: {
        source_repository: sourceRepository,
        source_commit: sourceCommit,
        build_id: buildId,
        canonical_origin: targetOrigin,
        canonical_runtime_target: canonicalRuntimeTarget,
        canonical_runtime_verification: "pass",
        release_deployment_id: deploymentId,
        release_deployment_url: deploymentUrl,
        release_deployment_target: "production",
        release_provider_verification: "pass",
      },
      access: {
        unauthenticated: {
          result:
            initialUnauthorizedStatus === 307 && unauthenticatedFinalPath === "/admin/login"
              ? "rejected"
              : "failed",
          initial_status: initialUnauthorizedStatus,
          final_path: unauthenticatedFinalPath,
        },
        authorized: {
          result:
            authorizedStatus === 200 && authorizedFinalPath === "/admin/shards"
              ? "allowed"
              : "failed",
          status: authorizedStatus,
          final_path: authorizedFinalPath,
          identity_source: "github_protected_environment",
          auth_runtime_source: "vercel_production_environment",
          allowlist_source: "vercel_production_environment",
          session_retained: false,
        },
      },
      projection,
      safe_state_contracts: await runReadPhase("safe_state_contracts", () =>
        validateSafeStateContracts(),
      ),
      safety: {
        allowed_http_methods: ["GET", "HEAD"],
        observed_disallowed_requests: observedDisallowedRequests.length,
        admin_mutation: false,
        production_write: false,
        cutover: false,
        dns_or_failover_change: false,
        legacy_worker_change: false,
      },
      redaction: {
        cookies_retained: false,
        credentials_retained: false,
        payloads_retained: false,
        personal_values_retained: false,
        private_endpoints_retained: false,
      },
      workflow: {
        evidence_tool_repository: sourceRepository,
        evidence_tool_commit: evidenceToolCommit,
        run_id: requirePattern(environment.GITHUB_RUN_ID, /^[1-9][0-9]*$/, "GITHUB_RUN_ID"),
        run_attempt: requirePattern(
          environment.GITHUB_RUN_ATTEMPT,
          /^[1-9][0-9]*$/,
          "GITHUB_RUN_ATTEMPT",
        ),
      },
    };
    await runReadPhase("evidence_contract", () => validateEvidence(evidence));
    await runReadPhase("evidence_artifact_write", async () => {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
    });
    return evidence;
  } finally {
    await browser.close();
  }
}

function isDirectExecution() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  runLiveEvidence()
    .then(() => {
      process.stdout.write("Authenticated production admin evidence passed.\n");
    })
    .catch((error) => {
      const errorClass =
        error instanceof Error && /^[a-z0-9_]+$/i.test(error.message)
          ? error.message
          : error?.constructor?.name || "EvidenceError";
      process.stderr.write(`Authenticated production admin evidence failed: ${errorClass}\n`);
      process.exitCode = 1;
    });
}
