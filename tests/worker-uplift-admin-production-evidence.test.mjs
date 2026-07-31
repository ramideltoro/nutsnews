import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  EXPECTED_STAGES,
  parsePipelineProjection,
  validateEvidence,
  validateSafeStateContracts,
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
    "ref: ${{ inputs.source_commit }}",
    "confirm_read_only:",
    "verify-authenticated-admin-read-only",
    "node scripts/worker_uplift_admin_production_evidence.mjs",
    "node scripts/validate_worker_uplift_admin_production_evidence.mjs",
    "actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f",
  ]) {
    assert.ok(workflow.includes(token), `missing workflow guard: ${token}`);
  }
  assert.doesNotMatch(workflow, /contents:\s*write/);
  assert.doesNotMatch(workflow, /\b(?:POST|PUT|PATCH|DELETE)\b/);
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
