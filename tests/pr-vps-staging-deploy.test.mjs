import assert from "node:assert/strict";
import { test } from "node:test";

import { deploymentStageIdempotencyKey, pollInfraGitHubDeployment } from "../scripts/deployment_hardening.mjs";
import {
  buildVpsStagingCandidate,
  buildVpsStagingEvidence,
  computeVpsStagingDeploymentId,
  parsePrReleaseMetadata,
  runPrVpsStagingDeploy,
  verifyVpsStagingRuntime,
} from "../scripts/pr_vps_staging_deploy.mjs";

const sourceCommit = "a".repeat(40);
const imageDigest = `sha256:${"b".repeat(64)}`;
const metadata = {
  artifact_kind: "pr-release-candidate",
  artifact_name: `nutsnews-pr-release-42-${sourceCommit}`,
  source_repository: "ramideltoro/nutsnews",
  source_commit: sourceCommit,
  source_workflow_run_id: "123",
  build_id: "123-1",
  pr_number: "42",
  image_repository: "ghcr.io/ramideltoro/nutsnews",
  image_tag: sourceCommit,
  image_digest: imageDigest,
  image: `ghcr.io/ramideltoro/nutsnews@${imageDigest}`,
  migration_head: "20260720120000",
  schema_version: "20260720110000",
  supabase_project_ref: "abcdefghijklmnopqrst",
  retention_days: 7,
};

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function fakeClock() {
  let current = 0;
  return {
    now: () => current,
    sleep: async (ms) => {
      current += ms;
    },
  };
}

function baseEnv(overrides = {}) {
  return {
    PR_RELEASE_METADATA_JSON: JSON.stringify(metadata),
    TRUSTED_PR_HEAD_SHA: sourceCommit,
    GITHUB_REPOSITORY: "ramideltoro/nutsnews",
    GITHUB_TOKEN: "github-token",
    NUTSNEWS_INFRA_STAGING_TOKEN: "infra-token",
    NUTSNEWS_VPS_STAGING_URL: "https://staging.nutsnews.com/",
    GITHUB_RUN_ID: "456",
    GITHUB_RUN_ATTEMPT: "1",
    NUTSNEWS_DEPLOY_HARDENING_TIMEOUT_MS: "30000",
    ...overrides,
  };
}

test("VPS staging candidate uses the immutable PR release artifact identity", () => {
  const parsed = parsePrReleaseMetadata(JSON.stringify(metadata));
  const candidate = buildVpsStagingCandidate(parsed);
  assert.deepEqual(candidate, {
    schema_version: metadata.schema_version,
    migration_head: metadata.migration_head,
    supabase_project_ref: metadata.supabase_project_ref,
    source_repository: "ramideltoro/nutsnews",
    source_commit: sourceCommit,
    image_repository: "ghcr.io/ramideltoro/nutsnews",
    image_digest: imageDigest,
    build_id: "123-1",
    source_workflow_run_id: "123",
  });
  assert.match(computeVpsStagingDeploymentId(candidate), /^stg-[0-9a-f]{24}$/);
});

test("PR VPS staging deploy dispatches, waits, verifies runtime identity, and writes evidence shape", async () => {
  const parsed = parsePrReleaseMetadata(JSON.stringify(metadata));
  const candidate = buildVpsStagingCandidate(parsed);
  const deploymentId = computeVpsStagingDeploymentId(candidate);
  const dispatches = [];
  const clock = fakeClock();

  const fetchImpl = async (url, init = {}) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.pathname === "/repos/ramideltoro/nutsnews/pulls/42") {
      return json({ head: { sha: sourceCommit } });
    }
    if (parsedUrl.pathname === "/repos/ramideltoro/nutsnews-infra/dispatches") {
      dispatches.push(JSON.parse(init.body));
      return new Response(null, { status: 204 });
    }
    if (parsedUrl.pathname === "/repos/ramideltoro/nutsnews-infra/deployments") {
      return json([
        {
          id: 99,
          statuses_url: "https://api.github.com/repos/ramideltoro/nutsnews-infra/deployments/99/statuses",
          payload: {
            deployment_id: deploymentId,
            source_commit: sourceCommit,
            build_id: "123-1",
            requested_digest: imageDigest,
          },
        },
      ]);
    }
    if (parsedUrl.pathname === "/repos/ramideltoro/nutsnews-infra/deployments/99/statuses") {
      return json([
        {
          state: "success",
          log_url: "https://github.com/ramideltoro/nutsnews-infra/actions/runs/777",
          target_url: "https://staging.nutsnews.com/",
          description: `actual=${imageDigest}`,
        },
      ]);
    }
    if (parsedUrl.hostname === "staging.nutsnews.com" && parsedUrl.pathname === "/healthz") {
      return json(
        { ok: true, sourceCommit, buildId: "123-1" },
        200,
        {
          "x-nutsnews-source-commit": sourceCommit,
          "x-nutsnews-build-id": "123-1",
        },
      );
    }
    if (parsedUrl.hostname === "staging.nutsnews.com" && parsedUrl.pathname === "/readyz") {
      return json(
        { ok: true, runtimeEnv: "staging" },
        200,
        {
          "x-nutsnews-runtime-environment": "staging",
          "x-nutsnews-deployment-target": "vps-staging",
          "x-nutsnews-source-commit": sourceCommit,
          "x-nutsnews-build-id": "123-1",
          "x-nutsnews-expected-image-digest": imageDigest,
        },
      );
    }
    throw new Error(`Unexpected fetch ${parsedUrl}`);
  };

  const evidence = await runPrVpsStagingDeploy(baseEnv(), { fetchImpl, sleep: clock.sleep, now: clock.now });
  assert.equal(dispatches.length, 1);
  assert.equal(dispatches[0].event_type, "nutsnews-staging-release");
  assert.deepEqual(dispatches[0].client_payload, candidate);
  assert.equal(evidence.result, "success");
  assert.equal(evidence.target_type, "vps-staging");
  assert.equal(evidence.target_url, "https://staging.nutsnews.com/");
  assert.equal(evidence.runtime_env, "staging");
  assert.equal(evidence.deployment_target, "vps-staging");
  assert.equal(evidence.deployment_id, deploymentId);
  assert.equal(evidence.infra_run_id, "777");
  assert.equal(evidence.source_commit, sourceCommit);
  assert.equal(evidence.image_digest, imageDigest);
  assert.equal(evidence.idempotency_key, `pr-42-${sourceCommit}-vps-staging`);
});

test("PR VPS staging deploy fails before dispatch when the PR head is stale", async () => {
  let dispatched = false;
  await assert.rejects(
    () =>
      runPrVpsStagingDeploy(baseEnv(), {
        fetchImpl: async (url) => {
          const parsedUrl = new URL(url);
          if (parsedUrl.pathname === "/repos/ramideltoro/nutsnews/pulls/42") {
            return json({ head: { sha: "c".repeat(40) } });
          }
          if (parsedUrl.pathname.endsWith("/dispatches")) dispatched = true;
          return new Response(null, { status: 204 });
        },
        ...fakeClock(),
      }),
    /Current PR head changed/,
  );
  assert.equal(dispatched, false);
});
