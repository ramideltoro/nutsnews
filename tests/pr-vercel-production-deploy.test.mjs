import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertVercelProductionAliases,
  runPrVercelProductionDeploy,
  verifyVercelProductionRuntime,
} from "../scripts/pr_vercel_production_deploy.mjs";

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
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json", ...headers } });
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

function env(overrides = {}) {
  return {
    PR_RELEASE_METADATA_JSON: JSON.stringify(metadata),
    VERCEL_PRODUCTION_DEPLOYMENT_URL: "https://nutsnews-prod-candidate.vercel.app/",
    VERCEL_DEPLOYMENT_ID: "dpl_prod123",
    VERCEL_TOKEN: "vercel-token",
    VERCEL_ORG_ID: "team_123",
    NUTSNEWS_VERCEL_PRODUCTION_ALIASES: "https://www.nutsnews.com/,https://nutsnews.com/",
    GITHUB_RUN_ID: "456",
    GITHUB_RUN_ATTEMPT: "1",
    NUTSNEWS_DEPLOY_HARDENING_TIMEOUT_MS: "30000",
    ...overrides,
  };
}

test("Vercel production alias validation requires production target aliases", () => {
  assert.equal(
    assertVercelProductionAliases({
      deployment: { target: "production", alias: ["www.nutsnews.com", "nutsnews.com"] },
      aliases: ["https://www.nutsnews.com/", "https://nutsnews.com/"],
    }),
    true,
  );
  assert.throws(
    () => assertVercelProductionAliases({ deployment: { target: "preview", alias: ["www.nutsnews.com"] }, aliases: ["https://www.nutsnews.com/"] }),
    /target mismatch/,
  );
  assert.throws(
    () => assertVercelProductionAliases({ deployment: { target: "production", alias: ["preview.vercel.app"] }, aliases: ["https://www.nutsnews.com/"] }),
    /not attached/,
  );
});

test("PR Vercel production deploy validates aliases and writes evidence shape", async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (parsed.hostname === "api.vercel.com") {
      return json({
        id: "dpl_prod123",
        readyState: "READY",
        target: "production",
        alias: ["www.nutsnews.com", "nutsnews.com"],
        meta: { githubCommitSha: sourceCommit },
      });
    }
    if (["www.nutsnews.com", "nutsnews.com"].includes(parsed.hostname) && parsed.pathname === "/healthz") {
      return json({ ok: true, sourceCommit, buildId: "123-1" }, 200, {
        "x-nutsnews-source-commit": sourceCommit,
        "x-nutsnews-build-id": "123-1",
      });
    }
    if (["www.nutsnews.com", "nutsnews.com"].includes(parsed.hostname) && parsed.pathname === "/readyz") {
      return json({ ok: true, runtimeEnv: "production" }, 200, {
        "x-nutsnews-runtime-environment": "production",
        "x-nutsnews-deployment-target": "vercel-production",
        "x-nutsnews-source-commit": sourceCommit,
        "x-nutsnews-build-id": "123-1",
      });
    }
    throw new Error(`Unexpected fetch ${parsed}`);
  };

  const evidence = await runPrVercelProductionDeploy(env(), { fetchImpl, ...fakeClock() });
  assert.equal(evidence.result, "success");
  assert.equal(evidence.target_type, "vercel-production");
  assert.equal(evidence.target_url, "https://www.nutsnews.com/");
  assert.equal(evidence.deployment_url, "https://nutsnews-prod-candidate.vercel.app/");
  assert.equal(evidence.deployment_id, "dpl_prod123");
  assert.equal(evidence.vercel_source_sha, sourceCommit);
  assert.equal(evidence.runtime_env, "production");
  assert.equal(evidence.deployment_target, "vercel-production");
  assert.deepEqual(evidence.production_aliases, ["https://www.nutsnews.com/", "https://nutsnews.com/"]);
  assert.equal(evidence.idempotency_key, `pr-42-${sourceCommit}-vercel-production`);
});

test("Vercel production runtime validation catches target drift", async () => {
  await assert.rejects(
    () =>
      verifyVercelProductionRuntime({
        env: {},
        metadata,
        aliases: ["https://www.nutsnews.com/"],
        timeoutMs: 10_000,
        ...fakeClock(),
        fetchImpl: async (url) => {
          const parsed = new URL(url);
          if (parsed.pathname === "/healthz") {
            return json({ ok: true, sourceCommit, buildId: "123-1" }, 200, {
              "x-nutsnews-source-commit": sourceCommit,
              "x-nutsnews-build-id": "123-1",
            });
          }
          return json({ ok: true, runtimeEnv: "production" }, 200, {
            "x-nutsnews-runtime-environment": "production",
            "x-nutsnews-deployment-target": "vercel-staging",
            "x-nutsnews-source-commit": sourceCommit,
            "x-nutsnews-build-id": "123-1",
          });
        },
      }),
    /deployment target header mismatch/,
  );
});
