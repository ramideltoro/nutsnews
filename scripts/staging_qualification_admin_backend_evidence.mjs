#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultContractPath = path.join(repoRoot, "api-contracts", "admin-backend-operations.json");
const infraRepository = "ramideltoro/nutsnews-infra";

function clean(value) {
  return String(value ?? "").trim();
}

function requirePattern(value, pattern, message) {
  const text = clean(value);
  if (!pattern.test(text)) throw new Error(message);
  return text;
}

function githubHeaders(token, accept = "application/vnd.github+json") {
  return {
    Accept: accept,
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function expectedAdminOperations(contractPath = defaultContractPath) {
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  const operations = Array.isArray(contract.operations)
    ? contract.operations.map((entry) => clean(entry.operation)).filter(Boolean)
    : [];
  if (operations.length === 0 || operations.some((operation) => !operation.startsWith("load-admin-"))) {
    throw new Error("Admin backend operation contract is missing required load-admin operations");
  }
  return operations;
}

function assertNoSensitiveEvidence(operationEvidence) {
  const serialized = JSON.stringify(operationEvidence);
  if (/token|authorization|cookie|response.?body|secret/i.test(serialized)) {
    throw new Error("Admin backend operation smoke evidence contains sensitive fields");
  }
}

export function validateAdminBackendSmokeEvidence(report, {
  expectedSourceCommit,
  expectedBuildId,
  stagingDeploymentId,
  contractPath = defaultContractPath,
} = {}) {
  const sourceCommit = requirePattern(expectedSourceCommit, /^[0-9a-f]{40}$/, "Expected source commit must be a full lowercase SHA");
  const buildId = requirePattern(expectedBuildId, /^[1-9][0-9]{0,19}-[1-9][0-9]{0,5}$/, "Expected build ID must be run-attempt");
  const deploymentId = requirePattern(stagingDeploymentId, /^stg-[0-9a-f]{24}$/, "Staging deployment ID must be stg-*");

  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw new Error("Staging qualification evidence must be a JSON object");
  }
  if (report.result !== "pass") {
    throw new Error(`Staging qualification result must be pass before production promotion; received ${report.result ?? "missing"}`);
  }
  if (report.stagingDeploymentId !== deploymentId) {
    throw new Error("Staging qualification evidence deployment ID does not match the production release request");
  }
  if (report.expectedIdentity?.sourceCommit !== sourceCommit) {
    throw new Error("Staging qualification evidence source commit does not match the production release request");
  }
  if (report.expectedIdentity?.buildId !== buildId) {
    throw new Error("Staging qualification evidence build ID does not match the production release request");
  }

  const step = Array.isArray(report.results)
    ? report.results.find((result) => result?.name === "admin-backend-operation-smoke")
    : null;
  if (!step) throw new Error("Staging qualification evidence is missing admin-backend-operation-smoke");
  if (step.required !== true || step.status !== "pass") {
    throw new Error("Admin backend operation smoke evidence must be required and pass before production promotion");
  }
  const operations = step.details?.operations;
  if (!Array.isArray(operations)) {
    throw new Error("Admin backend operation smoke evidence must list checked operations");
  }

  const expectedOperations = expectedAdminOperations(contractPath);
  const actualOperations = operations.map((entry) => clean(entry?.operation));
  if (actualOperations.length !== expectedOperations.length || actualOperations.some((operation, index) => operation !== expectedOperations[index])) {
    throw new Error("Admin backend operation smoke evidence does not cover every canonical load-admin operation");
  }

  for (const operationEvidence of operations) {
    if (operationEvidence.status !== "pass") {
      throw new Error(`Admin backend operation ${operationEvidence.operation ?? "unknown"} did not pass`);
    }
    if (typeof operationEvidence.rows !== "number") {
      throw new Error(`Admin backend operation ${operationEvidence.operation} evidence is missing row count`);
    }
    assertNoSensitiveEvidence(operationEvidence);
  }

  return {
    result: "pass",
    operationCount: operations.length,
    operations: actualOperations,
  };
}

async function fetchJson(fetchImpl, url, init, label) {
  const response = await fetchImpl(url, init);
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  return response.json();
}

async function readArtifactEvidenceJson(fetchImpl, { token, artifactId }) {
  const response = await fetchImpl(
    `https://api.github.com/repos/${infraRepository}/actions/artifacts/${encodeURIComponent(artifactId)}/zip`,
    { headers: githubHeaders(token, "application/zip") },
  );
  if (!response.ok) throw new Error(`Staging qualification artifact download returned HTTP ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  const temporary = await mkdtemp(path.join(os.tmpdir(), "nutsnews-staging-qualification-artifact-"));
  const archivePath = path.join(temporary, "artifact.zip");
  try {
    await writeFile(archivePath, archive);
    const entries = execFileSync("unzip", ["-Z", "-1", archivePath], { encoding: "utf8" })
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    const evidenceEntry = entries.find((entry) => entry === "staging-qualification.json" || entry.endsWith("/staging-qualification.json"));
    if (!evidenceEntry) throw new Error("Staging qualification artifact is missing staging-qualification.json");
    return JSON.parse(execFileSync("unzip", ["-p", archivePath, evidenceEntry], { encoding: "utf8" }));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function verifyStagingQualificationAdminBackendEvidence({
  fetchImpl = fetch,
  token,
  qualificationRunId,
  stagingDeploymentId,
  expectedSourceCommit,
  expectedBuildId,
  contractPath = defaultContractPath,
}) {
  const safeToken = clean(token);
  if (!safeToken) throw new Error("NUTSNEWS_INFRA_STAGING_TOKEN is required to verify staging qualification evidence");
  const runId = requirePattern(qualificationRunId, /^[1-9][0-9]{0,19}$/, "Staging qualification run ID must be numeric");
  const deploymentId = requirePattern(stagingDeploymentId, /^stg-[0-9a-f]{24}$/, "Staging deployment ID must be stg-*");
  const artifacts = await fetchJson(
    fetchImpl,
    `https://api.github.com/repos/${infraRepository}/actions/runs/${runId}/artifacts?per_page=100`,
    { headers: githubHeaders(safeToken) },
    "Staging qualification artifacts",
  );
  const artifactPrefix = `staging-qualification-${deploymentId}-${runId}-`;
  const artifact = (Array.isArray(artifacts.artifacts) ? artifacts.artifacts : []).find((item) =>
    clean(item?.name).startsWith(artifactPrefix),
  );
  if (!artifact) {
    throw new Error("Matching staging qualification artifact was not found for the production release request");
  }
  const report = await readArtifactEvidenceJson(fetchImpl, { token: safeToken, artifactId: clean(artifact.id) });
  return {
    artifactName: clean(artifact.name),
    qualificationRunId: runId,
    ...validateAdminBackendSmokeEvidence(report, {
      expectedSourceCommit,
      expectedBuildId,
      stagingDeploymentId: deploymentId,
      contractPath,
    }),
  };
}

async function main() {
  const result = await verifyStagingQualificationAdminBackendEvidence({
    token: process.env.NUTSNEWS_INFRA_STAGING_TOKEN,
    qualificationRunId: process.env.VPS_QUALIFICATION_RUN_ID || process.env.NUTSNEWS_STAGING_QUALIFICATION_RUN_ID,
    stagingDeploymentId: process.env.VPS_STAGING_DEPLOYMENT_ID || process.env.NUTSNEWS_STAGING_DEPLOYMENT_ID,
    expectedSourceCommit: process.env.SOURCE_COMMIT || process.env.NUTSNEWS_EXPECTED_SOURCE_COMMIT,
    expectedBuildId: process.env.BUILD_ID || process.env.NUTSNEWS_EXPECTED_BUILD_ID,
  });

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      [`result=${result.result}`, `operation_count=${result.operationCount}`, `artifact_name=${result.artifactName}`, ""].join("\n"),
      "utf8",
    );
  }
  console.log(`Verified staging admin backend operation smoke evidence for ${result.operationCount} operation(s).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
