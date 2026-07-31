import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  EXPECTED_STAGES,
  assertVercelDeploymentIdentity,
  classifyEvidenceContractError,
  classifyLivePhaseError,
  classifyReadPhaseError,
  extractVercelProjectId,
  parsePipelineProjection,
  selectVercelProductionAuthRecords,
  validateEvidence,
  validateSafeStateContracts,
  validateVercelProductionAuthInputs,
} from "../scripts/worker_uplift_admin_production_evidence.mjs";

function liveProjectionFixture() {
  return {
    available: true,
    projectionVersion: "Projection v1",
    metrics: [
      { label: "Owner", value: "Legacy Shards" },
      { label: "Overall", value: "Healthy" },
      { label: "Blocked Stages", value: "0" },
      { label: "DLQ", value: "0" },
      { label: "Queue Age", value: "5s" },
      { label: "Writes", value: "Shadow" },
    ],
    rows: EXPECTED_STAGES.map((stage, index) => [
      stage,
      "Healthy",
      "Legacy Shards",
      "Not retained",
      "1/min",
      "10ms",
      "5s",
      "0",
      "0",
      index === 0 ? "—" : "1",
      index === 0 ? "scheduler-evidence" : `${stage}-sha256-evidence`,
      "Not retained",
    ]),
  };
}

function passingEvidence() {
  return {
    schema_version: 1,
    result: "pass",
    checked_at: "2026-07-30T20:00:00.000Z",
    candidate: {
      source_repository: "ramideltoro/nutsnews",
      source_commit: "a".repeat(40),
      build_id: "30572714730-1",
      canonical_origin: "https://www.nutsnews.com",
      canonical_runtime_target: "production-vps",
      canonical_runtime_verification: "pass",
      release_deployment_id: "dpl_Example123",
      release_deployment_url: "https://nutsnews-example.vercel.app",
      release_deployment_target: "production",
      release_provider_verification: "pass",
    },
    access: {
      unauthenticated: {
        result: "rejected",
        initial_status: 307,
        final_path: "/admin/login",
      },
      authorized: {
        result: "allowed",
        status: 200,
        final_path: "/admin/shards",
        identity_source: "github_protected_environment",
        auth_runtime_source: "vercel_production_environment",
        allowlist_source: "vercel_production_environment",
        session_retained: false,
      },
    },
    projection: parsePipelineProjection(liveProjectionFixture()),
    safe_state_contracts: validateSafeStateContracts(),
    safety: {
      allowed_http_methods: ["GET", "HEAD"],
      observed_disallowed_requests: 0,
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
      evidence_tool_repository: "ramideltoro/nutsnews",
      evidence_tool_commit: "b".repeat(40),
      run_id: "30580000000",
      run_attempt: "1",
    },
  };
}

test("parses the live shadow projection and all eight stage identities", () => {
  const projection = parsePipelineProjection(liveProjectionFixture());
  assert.equal(projection.active_ingestion_owner, "legacy shards");
  assert.equal(projection.write_policy, "shadow");
  assert.equal(projection.dlq_total, 0);
  assert.deepEqual(
    projection.stages.map((row) => row.stage),
    EXPECTED_STAGES,
  );
  assert.equal(projection.stages[0].consumers, null);
  assert.ok(projection.stages.slice(1).every((row) => row.consumers === 1));
});

test("accepts complete redacted read-only evidence", () => {
  assert.equal(validateEvidence(passingEvidence()).result, "pass");
});

test("rejects evidence without an immutable tooling revision", () => {
  const evidence = passingEvidence();
  delete evidence.workflow.evidence_tool_commit;
  assert.throws(() => validateEvidence(evidence), /workflow\.evidence_tool_commit/);
});

test("classifies live browser phase failures without retaining private detail", () => {
  const timeout = Object.assign(new Error("private endpoint detail"), {
    name: "TimeoutError",
  });
  assert.equal(
    classifyLivePhaseError("authorized_navigation", timeout).message,
    "authorized_navigation_timeout",
  );
  assert.equal(
    classifyLivePhaseError("authorized_projection", new Error("private response body")).message,
    "authorized_projection_failed",
  );
});

test("classifies provider read failures without retaining private detail", () => {
  assert.equal(
    classifyReadPhaseError(
      "provider_runtime_auth",
      new Error("vercel_environment_detail_http_403"),
    ).message,
    "provider_runtime_auth_vercel_environment_detail_http_403",
  );
  assert.equal(
    classifyReadPhaseError(
      "provider_runtime_auth",
      new Error("private provider response body"),
    ).message,
    "provider_runtime_auth_error",
  );
});

test("classifies evidence contract failures with fixed value-free codes", () => {
  assert.equal(
    classifyEvidenceContractError(
      new Error("main queue has zero or unknown consumers for publication"),
    ),
    "stage_consumers_publication",
  );
  assert.equal(
    classifyEvidenceContractError(
      new Error("current shadow projection evidence is incomplete or unsafe"),
    ),
    "projection_summary",
  );
  assert.equal(
    classifyEvidenceContractError(new Error("private response payload detail")),
    "invalid",
  );
  assert.equal(
    classifyReadPhaseError(
      "evidence_contract",
      new Error("stage telemetry is not current for approval"),
    ).message,
    "evidence_contract_stage_not_current_approval",
  );
});

test("accepts current and legacy Vercel deployment identifier fields", () => {
  const expected = {
    deploymentId: "dpl_Example123",
    deploymentUrl: "https://nutsnews-example.vercel.app",
    sourceCommit: "a".repeat(40),
  };
  const common = {
    readyState: "READY",
    target: "production",
    url: "nutsnews-example.vercel.app",
    meta: { githubCommitSha: "a".repeat(40) },
  };
  assert.doesNotThrow(() =>
    assertVercelDeploymentIdentity({ ...common, id: "dpl_Example123" }, expected),
  );
  assert.doesNotThrow(() =>
    assertVercelDeploymentIdentity({ ...common, uid: "dpl_Example123" }, expected),
  );
});

test("rejects mismatched Vercel production deployment identity", () => {
  const expected = {
    deploymentId: "dpl_Example123",
    deploymentUrl: "https://nutsnews-example.vercel.app",
    sourceCommit: "a".repeat(40),
  };
  const deployment = {
    id: "dpl_Different",
    readyState: "READY",
    target: "production",
    url: "nutsnews-example.vercel.app",
    meta: { githubCommitSha: "a".repeat(40) },
  };
  assert.throws(
    () => assertVercelDeploymentIdentity(deployment, expected),
    /vercel_deployment_identity_mismatch/,
  );

  deployment.id = "dpl_Example123";
  deployment.meta.githubCommitSha = "b".repeat(40);
  assert.throws(
    () => assertVercelDeploymentIdentity(deployment, expected),
    /vercel_deployment_identity_mismatch/,
  );
});

test("accepts current and legacy Vercel project identifier fields", () => {
  assert.equal(
    extractVercelProjectId({ project: { id: "prj_Current123" } }),
    "prj_Current123",
  );
  assert.equal(extractVercelProjectId({ projectId: "prj_Legacy123" }), "prj_Legacy123");
  assert.throws(
    () =>
      extractVercelProjectId({
        projectId: "prj_First",
        project: { id: "prj_Second" },
      }),
    /vercel_project_identity_mismatch/,
  );
  assert.throws(() => extractVercelProjectId({}), /vercel_project_identity_missing/);
});

test("selects exactly one current Production auth and allowlist record", () => {
  const selected = selectVercelProductionAuthRecords({
    envs: [
      { id: "env-auth", key: "AUTH_SECRET", target: "production", type: "encrypted" },
      {
        id: "env-admins",
        key: "ADMIN_EMAILS",
        target: ["preview", "production"],
        type: "encrypted",
      },
      { id: "env-preview", key: "AUTH_SECRET", target: ["preview"], type: "encrypted" },
    ],
  });
  assert.equal(selected.AUTH_SECRET.id, "env-auth");
  assert.equal(selected.ADMIN_EMAILS.id, "env-admins");
});

test("rejects missing or duplicate Production auth records", () => {
  assert.throws(
    () =>
      selectVercelProductionAuthRecords({
        envs: [{ id: "env-auth", key: "AUTH_SECRET", target: ["production"] }],
      }),
    /vercel_production_auth_record_missing/,
  );
  assert.throws(
    () =>
      selectVercelProductionAuthRecords({
        envs: [
          { id: "env-auth-a", key: "AUTH_SECRET", target: ["production"] },
          { id: "env-auth-b", key: "AUTH_SECRET", target: ["production"] },
          { id: "env-admins", key: "ADMIN_EMAILS", target: ["production"] },
        ],
      }),
    /vercel_production_auth_record_duplicate/,
  );
});

test("validates decrypted Production auth inputs and allowlist membership", () => {
  assert.deepEqual(
    validateVercelProductionAuthInputs({
      authSecretRecord: {
        type: "encrypted",
        decrypted: true,
        value: "s".repeat(64),
      },
      adminEmailsRecord: {
        type: "encrypted",
        decrypted: true,
        value: "admin@example.com, second@example.com",
      },
      evidenceIdentity: "ADMIN@example.com",
    }),
    { authSecret: "s".repeat(64) },
  );
});

test("rejects ciphertext, invalid secrets, and identities outside the Production allowlist", () => {
  const validAdmins = {
    type: "encrypted",
    decrypted: true,
    value: "admin@example.com",
  };
  for (const authSecretRecord of [
    { type: "encrypted", decrypted: false, value: "s".repeat(64) },
    {
      type: "encrypted",
      decrypted: true,
      value: JSON.stringify({ ciphertext: "fixture" }),
    },
    { type: "encrypted", decrypted: true, value: "too-short" },
  ]) {
    assert.throws(() =>
      validateVercelProductionAuthInputs({
        authSecretRecord,
        adminEmailsRecord: validAdmins,
        evidenceIdentity: "admin@example.com",
      }),
    );
  }
  assert.throws(
    () =>
      validateVercelProductionAuthInputs({
        authSecretRecord: {
          type: "encrypted",
          decrypted: true,
          value: "s".repeat(64),
        },
        adminEmailsRecord: validAdmins,
        evidenceIdentity: "different@example.com",
      }),
    /admin_evidence_identity_not_allowlisted/,
  );
});

test("rejects missing unauthenticated access control proof", () => {
  const evidence = passingEvidence();
  evidence.access.unauthenticated.result = "allowed";
  assert.throws(() => validateEvidence(evidence), /unauthenticated access rejection/);
});

test("rejects uplift production writes", () => {
  const fixture = liveProjectionFixture();
  fixture.metrics.find((entry) => entry.label === "Writes").value = "Enabled";
  assert.throws(() => parsePipelineProjection(fixture), /production writes are not disabled/);
});

test("rejects zero consumers on a main queue", () => {
  const evidence = passingEvidence();
  evidence.projection.stages.find((row) => row.stage === "fetcher").consumers = 0;
  assert.throws(() => validateEvidence(evidence), /zero or unknown consumers/);
});

test("rejects stale or missing main-queue state in current production evidence", () => {
  const stale = passingEvidence();
  stale.projection.stages.find((row) => row.stage === "approval").status = "stale";
  assert.throws(() => validateEvidence(stale), /stage telemetry is not current/);

  const missingQueueAge = passingEvidence();
  missingQueueAge.projection.stages.find((row) => row.stage === "translation").queue_age = "—";
  assert.throws(() => validateEvidence(missingQueueAge), /main queue age is missing/);
});

test("rejects missing worker candidate identity", () => {
  const evidence = passingEvidence();
  evidence.projection.stages.find((row) => row.stage === "publication").deployment_version = "—";
  assert.throws(() => validateEvidence(evidence), /candidate identity is missing/);
});

test("stale and unavailable fixtures expose state without private values", () => {
  assert.deepEqual(validateSafeStateContracts(), {
    stale_projection: "pass",
    unavailable_projection: "pass",
    private_value_rejection: "pass",
  });
});

test("rejects personal and private endpoint values anywhere in evidence", () => {
  const withPersonalValue = passingEvidence();
  withPersonalValue.projection.stages[1].deployment_version = "operator@example.com";
  assert.throws(() => validateEvidence(withPersonalValue), /forbidden private or personal value/);

  const withPrivateEndpoint = passingEvidence();
  withPrivateEndpoint.projection.stages[1].deployment_version = "amqp://private-broker";
  assert.throws(() => validateEvidence(withPrivateEndpoint), /forbidden private or personal value/);
});

test("protected workflow is manual, read-only, exact-source, and artifact-backed", () => {
  const workflow = readFileSync(
    new URL(
      "../.github/workflows/worker-uplift-admin-production-evidence.yml",
      import.meta.url,
    ),
    "utf8",
  );
  for (const token of [
    "environment: Production",
    "permissions:\n  contents: read",
    "EVIDENCE_TOOL_COMMIT: ${{ github.sha }}",
    "ref: ${{ github.sha }}",
    "confirm_read_only:",
    "verify-authenticated-admin-read-only",
    "node scripts/worker_uplift_admin_production_evidence.mjs",
    "node scripts/validate_worker_uplift_admin_production_evidence.mjs",
    "actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f",
  ]) {
    assert.ok(workflow.includes(token), `missing workflow guard: ${token}`);
  }
  assert.doesNotMatch(workflow, /contents:\s*write/);
  assert.doesNotMatch(workflow, /ref:\s*\$\{\{\s*inputs\.source_commit\s*\}\}/);
  assert.doesNotMatch(workflow, /\b(?:POST|PUT|PATCH|DELETE)\b/);
  assert.doesNotMatch(workflow, /^\s*AUTH_SECRET:/m);
  assert.doesNotMatch(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /push:/);

  const contractWorkflow = readFileSync(
    new URL(
      "../.github/workflows/worker-uplift-admin-production-evidence-contract.yml",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(contractWorkflow, /pull_request:/);
  assert.match(contractWorkflow, /push:/);
  assert.match(contractWorkflow, /test:admin-worker-uplift-production-evidence/);
  assert.doesNotMatch(contractWorkflow, /environment:\s*Production/);
});
