import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildVpsProductionPayload,
  computeVpsProductionDeploymentId,
  runPrVpsProductionDeploy,
  selectVpsProductionRuntimeTargetUrl,
} from "../scripts/pr_vps_production_deploy.mjs";

const sourceCommit = "a".repeat(40);
const imageDigest = `sha256:${"b".repeat(64)}`;
const metadata = {
  artifact_kind: "pr-release-candidate",
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
};

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json", ...headers } });
}

function env(overrides = {}) {
  return {
    PR_RELEASE_METADATA_JSON: JSON.stringify(metadata),
    NUTSNEWS_INFRA_PRODUCTION_TOKEN: "infra-token",
    VERCEL_PRODUCTION_DEPLOYMENT_ID: "dpl_prod123",
    GITHUB_RUN_ID: "456",
    GITHUB_RUN_ATTEMPT: "1",
    NUTSNEWS_DEPLOY_HARDENING_TIMEOUT_MS: "30000",
    ...overrides,
  };
}

function fakeClock() {
  let current = 0;
  return { now: () => current, sleep: async (ms) => { current += ms; } };
}

test("VPS production payload binds artifact identity and idempotency", () => {
  const deploymentId = computeVpsProductionDeploymentId(metadata);
  const payload = buildVpsProductionPayload({ metadata, deploymentId, vercelProductionDeploymentId: "dpl_prod123" });
  assert.match(deploymentId, /^prod-[0-9a-f]{24}$/);
  assert.equal(payload.source_commit, sourceCommit);
  assert.equal(payload.image_digest, imageDigest);
  assert.equal(payload.deployment_target, "production-vps");
  assert.equal(payload.idempotency_key, `pr-42-${sourceCommit}-production-vps`);
  assert.equal(payload.vercel_production_deployment_id, "dpl_prod123");
});

test("PR VPS production deploy dispatches, waits, verifies runtime identity, and writes evidence", async () => {
  const deploymentId = computeVpsProductionDeploymentId(metadata);
  const dispatches = [];
  const fetchImpl = async (url, init = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/repos/ramideltoro/nutsnews-infra/dispatches") {
      dispatches.push(JSON.parse(init.body));
      return new Response(null, { status: 204 });
    }
    if (parsed.pathname === "/repos/ramideltoro/nutsnews-infra/deployments") {
      return json([{ id: 99, statuses_url: "https://api.github.com/repos/ramideltoro/nutsnews-infra/deployments/99/statuses", payload: { deployment_id: deploymentId, source_commit: sourceCommit, build_id: "123-1", requested_digest: imageDigest } }]);
    }
    if (parsed.pathname === "/repos/ramideltoro/nutsnews-infra/deployments/99/statuses") {
      return json([
        {
          state: "success",
          log_url: "https://github.com/ramideltoro/nutsnews-infra/actions/runs/888",
          target_url: "https://github.com/ramideltoro/nutsnews-infra/actions/runs/888",
          environment_url: "https://www.nutsnews.com",
        },
      ]);
    }
    if (parsed.hostname === "www.nutsnews.com" && parsed.pathname === "/healthz") {
      return json({ ok: true, sourceCommit, buildId: "123-1" }, 200, { "x-nutsnews-source-commit": sourceCommit, "x-nutsnews-build-id": "123-1" });
    }
    if (parsed.hostname === "www.nutsnews.com" && parsed.pathname === "/readyz") {
      return json({ ok: true, runtimeEnv: "production" }, 200, { "x-nutsnews-runtime-environment": "production", "x-nutsnews-deployment-target": "production-vps", "x-nutsnews-source-commit": sourceCommit, "x-nutsnews-build-id": "123-1", "x-nutsnews-expected-image-digest": imageDigest });
    }
    throw new Error(`Unexpected fetch ${parsed}`);
  };

  const evidence = await runPrVpsProductionDeploy(env(), { fetchImpl, ...fakeClock() });
  assert.equal(dispatches[0].event_type, "nutsnews-production-vps-release");
  assert.equal(evidence.result, "success");
  assert.equal(evidence.target_type, "production-vps");
  assert.equal(evidence.deployment_id, deploymentId);
  assert.equal(evidence.infra_run_id, "888");
  assert.equal(evidence.runtime_env, "production");
  assert.equal(evidence.deployment_target, "production-vps");
  assert.equal(evidence.image_digest, imageDigest);
});

test("VPS production runtime target prefers environment_url over GitHub status target_url", () => {
  assert.equal(
    selectVpsProductionRuntimeTargetUrl({
      configuredTargetUrl: "https://www.nutsnews.com/",
      pollResult: {
        status: {
          target_url: "https://github.com/ramideltoro/nutsnews-infra/actions/runs/888",
          environment_url: "https://www.nutsnews.com",
        },
      },
    }),
    "https://www.nutsnews.com/",
  );
});
