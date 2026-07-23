import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  validateAdminBackendSmokeEvidence,
  verifyStagingQualificationAdminBackendEvidence,
} from "../scripts/staging_qualification_admin_backend_evidence.mjs";

const commit = "a".repeat(40);
const buildId = "123456789-1";
const deploymentId = `stg-${"c".repeat(24)}`;
const contractPath = new URL("../api-contracts/admin-backend-operations.json", import.meta.url);
const contractFile = fileURLToPath(contractPath);
const operationNames = JSON.parse(readFileSync(contractFile, "utf8")).operations.map((entry) => entry.operation);

function operations() {
  return operationNames.map((operation) => ({
    operation,
    status: "pass",
    rows: operation === "load-admin-runtime-feature-flags" ? 0 : 1,
    rowCount: operation === "load-admin-runtime-feature-flags" ? 0 : 1,
    emptyValidDataset: operation === "load-admin-runtime-feature-flags",
  }));
}

function qualificationReport({
  result = "pass",
  stagingDeploymentId = deploymentId,
  sourceCommit = commit,
  expectedBuildId = buildId,
  includeSmoke = true,
  smokeRequired = true,
  smokeStatus = "pass",
  smokeOperations = operations(),
} = {}) {
  const results = [
    { name: "cloudflare-access-and-runtime-identity", required: true, status: "pass", details: { ok: true } },
    { name: "github-staging-deployment-identity", required: true, status: "pass", details: { ok: true } },
  ];

  if (includeSmoke) {
    results.push({
      name: "admin-backend-operation-smoke",
      required: smokeRequired,
      status: smokeStatus,
      details: {
        result: smokeStatus,
        providerMode: "backend_postgres_primary",
        targetHost: "staging-backend.nutsnews.test",
        operationCount: smokeOperations.length,
        operations: smokeOperations,
      },
    });
  }

  return {
    schemaVersion: 1,
    result,
    stagingDeploymentId,
    expectedIdentity: {
      sourceCommit,
      buildId: expectedBuildId,
      imageDigest: `sha256:${"b".repeat(64)}`,
      runtimeEnv: "staging",
      deploymentTarget: "vps-staging",
      configGeneration: `staging-${deploymentId}-dddddddddddd`,
    },
    results,
  };
}

function validate(report) {
  return validateAdminBackendSmokeEvidence(report, {
    expectedSourceCommit: commit,
    expectedBuildId: buildId,
    stagingDeploymentId: deploymentId,
    contractPath: contractFile,
  });
}

function json(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function zipQualificationReport(report) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "nutsnews-staging-admin-evidence-"));
  const source = path.join(temporary, "source");
  const archive = path.join(temporary, "artifact.zip");
  try {
    await mkdir(path.join(source, "qualification"), { recursive: true });
    await writeFile(path.join(source, "qualification", "staging-qualification.json"), `${JSON.stringify(report, null, 2)}\n`);
    execFileSync("zip", ["-q", "-r", archive, "."], { cwd: source });
    return await readFile(archive);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

test("validateAdminBackendSmokeEvidence accepts complete canonical passing evidence", () => {
  assert.deepEqual(validate(qualificationReport()), {
    result: "pass",
    operationCount: operationNames.length,
    operations: operationNames,
  });
});

test("verifyStagingQualificationAdminBackendEvidence downloads and validates the matching GitHub artifact", async () => {
  const archive = await zipQualificationReport(qualificationReport());
  const calls = [];
  const result = await verifyStagingQualificationAdminBackendEvidence({
    token: "infra-token-fixture",
    qualificationRunId: "202",
    stagingDeploymentId: deploymentId,
    expectedSourceCommit: commit,
    expectedBuildId: buildId,
    contractPath: contractFile,
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), authorization: new Headers(init.headers).get("authorization") });
      const parsed = new URL(url);
      if (parsed.pathname === "/repos/ramideltoro/nutsnews-infra/actions/runs/202/artifacts") {
        return json({
          artifacts: [
            { id: 41, name: "unrelated-artifact" },
            { id: 42, name: `staging-qualification-${deploymentId}-202-1` },
          ],
        });
      }
      if (parsed.pathname === "/repos/ramideltoro/nutsnews-infra/actions/artifacts/42/zip") {
        return new Response(archive, {
          status: 200,
          headers: { "content-type": "application/zip" },
        });
      }
      return new Response("not found", { status: 404 });
    },
  });

  assert.equal(result.artifactName, `staging-qualification-${deploymentId}-202-1`);
  assert.equal(result.operationCount, operationNames.length);
  assert.deepEqual(result.operations, operationNames);
  assert(calls.length >= 2);
  assert(calls.every((call) => call.authorization === "Bearer infra-token-fixture"));
});

test("validateAdminBackendSmokeEvidence rejects missing, failed, stale, and incomplete smoke evidence", () => {
  assert.throws(() => validate(qualificationReport({ includeSmoke: false })), /missing admin-backend-operation-smoke/);
  assert.throws(() => validate(qualificationReport({ smokeStatus: "fail" })), /must be required and pass/);
  assert.throws(
    () => validate(qualificationReport({ smokeOperations: [{ ...operations()[0], status: "fail" }, ...operations().slice(1)] })),
    /did not pass/,
  );
  assert.throws(() => validate(qualificationReport({ smokeOperations: operations().slice(0, -1) })), /does not cover every canonical/);
  assert.throws(() => validate(qualificationReport({ expectedBuildId: "123456789-2" })), /build ID/);
  assert.throws(() => validate(qualificationReport({ result: "fail" })), /result must be pass/);
});

test("validateAdminBackendSmokeEvidence rejects sensitive operation evidence", () => {
  const sensitiveOperations = operations();
  sensitiveOperations[0] = {
    ...sensitiveOperations[0],
    authorization: "Bearer sensitive-token-fixture",
  };

  assert.throws(() => validate(qualificationReport({ smokeOperations: sensitiveOperations })), /sensitive fields/);
});
