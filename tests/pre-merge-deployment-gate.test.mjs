import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildGateSummary,
  parseGateStageInputs,
  preMergeDeploymentStages,
  validatePreMergeDeploymentEvidence,
} from "../scripts/pre_merge_deployment_gate.mjs";

const sourceCommit = "a".repeat(40);
const imageDigest = `sha256:${"b".repeat(64)}`;
const buildId = "123-1";
const runId = "123";
const runAttempt = "1";
const prNumber = "42";

function stageInputs(overrides = {}) {
  return JSON.stringify(
    preMergeDeploymentStages.map((stage) => ({
      stage: stage.stage,
      job_result: overrides[stage.stage]?.job_result ?? "success",
      artifact_name: overrides[stage.stage]?.artifact_name ?? `artifact-${stage.stage}`,
    })),
  );
}

function writeEvidence(root, stage, evidenceOverrides = {}) {
  const artifactName = `artifact-${stage.stage}`;
  const dir = join(root, artifactName);
  mkdirSync(dir, { recursive: true });
  const base = {
    schema_version: 1,
    result: stage.kind === "ui" ? "pass" : "success",
    pr_number: prNumber,
    target_type: stage.target_type,
    target_url: `https://${stage.target_type}.example.test/`,
    source_commit: sourceCommit,
    build_id: buildId,
    deployment_id: `dep-${stage.stage}`,
    workflow_run_id: runId,
    workflow_run_attempt: runAttempt,
  };
  const deploy = stage.kind === "deploy"
    ? {
        stage: stage.stage,
        runtime_env: stage.runtime_env,
        deployment_target: stage.deployment_target,
        image_digest: imageDigest,
      }
    : {
        artifact_paths: { evidence_json: "web/test-results/deployed-ui-smoke/evidence.json" },
      };
  writeFileSync(join(dir, "evidence.json"), `${JSON.stringify({ ...base, ...deploy, ...evidenceOverrides }, null, 2)}\n`, "utf8");
}

function evidenceFixture(evidenceOverrides = {}) {
  const root = mkdtempSync(join(tmpdir(), "pre-merge-deployment-gate-"));
  for (const stage of preMergeDeploymentStages) writeEvidence(root, stage, evidenceOverrides[stage.stage]);
  return root;
}

function artifactsByName() {
  return new Map(preMergeDeploymentStages.map((stage, index) => [`artifact-${stage.stage}`, { id: String(1000 + index), name: `artifact-${stage.stage}` }]));
}

test("pre-merge deployment gate validates all ordered stage evidence", (t) => {
  const stages = parseGateStageInputs(stageInputs());
  const evidence = validatePreMergeDeploymentEvidence({
    stages,
    evidenceRoot: evidenceFixture(),
    expectedSourceCommit: sourceCommit,
    expectedBuildId: buildId,
    currentPrHeadSha: sourceCommit,
    prNumber,
    runId,
    runAttempt,
    artifactsByName: artifactsByName(),
  });
  assert.equal(evidence.result, "pass");
  assert.deepEqual(evidence.stages.map((stage) => stage.stage), preMergeDeploymentStages.map((stage) => stage.stage));
  assert.equal(evidence.stages.at(-1).target_type, "production-vps");
  assert.match(buildGateSummary(evidence), /Pre-merge deployment gate/);
  assert.match(buildGateSummary(evidence), /Merge readiness: all deployment evidence passed for this PR head/);
  assert.match(buildGateSummary(evidence), /actions\/runs\/123\/artifacts\/1000/);
});

test("pre-merge deployment gate rejects skipped, cancelled, or failed stage results", (t) => {
  const stages = parseGateStageInputs(stageInputs({ "ui-smoke-vps-production": { job_result: "skipped" } }));
  assert.throws(
    () => validatePreMergeDeploymentEvidence({
      stages,
      evidenceRoot: evidenceFixture(),
      expectedSourceCommit: sourceCommit,
      expectedBuildId: buildId,
      currentPrHeadSha: sourceCommit,
      prNumber,
      runId,
      runAttempt,
      artifactsByName: artifactsByName(),
    }),
    /ui-smoke-vps-production concluded skipped/,
  );
});

test("pre-merge deployment gate rejects stale PR evidence and changed heads", (t) => {
  const stages = parseGateStageInputs(stageInputs());
  assert.throws(
    () => validatePreMergeDeploymentEvidence({
      stages,
      evidenceRoot: evidenceFixture(),
      expectedSourceCommit: sourceCommit,
      expectedBuildId: buildId,
      currentPrHeadSha: "c".repeat(40),
      prNumber,
      runId,
      runAttempt,
      artifactsByName: artifactsByName(),
    }),
    /Current PR head changed/,
  );

  assert.throws(
    () => validatePreMergeDeploymentEvidence({
      stages,
      evidenceRoot: evidenceFixture({ "deploy-vercel-production": { source_commit: "d".repeat(40) } }),
      expectedSourceCommit: sourceCommit,
      expectedBuildId: buildId,
      currentPrHeadSha: sourceCommit,
      prNumber,
      runId,
      runAttempt,
      artifactsByName: artifactsByName(),
    }),
    /deploy-vercel-production evidence is stale/,
  );
});
