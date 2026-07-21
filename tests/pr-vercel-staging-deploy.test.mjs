import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertVercelStagingIsNotProduction,
  buildVercelStagingEvidence,
  runPrVercelStagingDeploy,
  verifyVercelStagingRuntime,
} from "../scripts/pr_vercel_staging_deploy.mjs";

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
    VERCEL_STAGING_DEPLOYMENT_URL: "https://nutsnews-git-pr-42.vercel.app/",
    VERCEL_TOKEN: "vercel-token",
    VERCEL_ORG_ID: "team_123",
    GITHUB_RUN_ID: "456",
    GITHUB_RUN_ATTEMPT: "1",
    NUTSNEWS_DEPLOY_HARDENING_TIMEOUT_MS: "30000",
    ...overrides,
  };
}

test("Vercel staging deployment rejects production targets and aliases", () => {
  assert.equal(
    assertVercelStagingIsNotProduction({
      deploymentUrl: "https://nutsnews-git-pr-42.vercel.app/",
      deployment: { target: "preview", alias: ["nutsnews-git-pr-42.vercel.app"] },
    }),
    true,
  );
  assert.throws(
    () => assertVercelStagingIsNotProduction({ deploymentUrl: "https://www.nutsnews.com/", deployment: { target: "preview" } }),
    /production host/,
  );
  assert.throws(
    () => assertVercelStagingIsNotProduction({ deploymentUrl: "https://nutsnews-git-pr-42.vercel.app/", deployment: { target: "production" } }),
    /production target/,
  );
  assert.throws(
    () =>
      assertVercelStagingIsNotProduction({
        deploymentUrl: "https://nutsnews-git-pr-42.vercel.app/",
        deployment: { target: "preview", alias: ["nutsnews.com"] },
      }),
    /production host/,
  );
});

test("PR Vercel staging deploy waits, verifies runtime identity, and writes evidence shape", async () => {
  const clock = fakeClock();
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (parsed.hostname === "api.vercel.com") {
      return json({
        id: "dpl_abc123",
        readyState: "READY",
        target: "staging",
        alias: ["nutsnews-git-pr-42.vercel.app"],
        meta: { githubCommitSha: sourceCommit },
      });
    }
    if (parsed.hostname === "nutsnews-git-pr-42.vercel.app" && parsed.pathname === "/healthz") {
      return json(
        { ok: true, sourceCommit, buildId: "123-1" },
        200,
        {
          "x-nutsnews-source-commit": sourceCommit,
          "x-nutsnews-build-id": "123-1",
        },
      );
    }
    if (parsed.hostname === "nutsnews-git-pr-42.vercel.app" && parsed.pathname === "/readyz") {
      return json(
        { ok: true, runtimeEnv: "staging" },
        200,
        {
          "x-nutsnews-runtime-environment": "staging",
          "x-nutsnews-deployment-target": "vercel-staging",
          "x-nutsnews-source-commit": sourceCommit,
          "x-nutsnews-build-id": "123-1",
        },
      );
    }
    throw new Error(`Unexpected fetch ${parsed}`);
  };

  const evidence = await runPrVercelStagingDeploy(baseEnv(), { fetchImpl, sleep: clock.sleep, now: clock.now });
  assert.equal(evidence.result, "success");
  assert.equal(evidence.target_type, "vercel-staging");
  assert.equal(evidence.target_url, "https://nutsnews-git-pr-42.vercel.app/");
  assert.equal(evidence.runtime_env, "staging");
  assert.equal(evidence.deployment_target, "vercel-staging");
  assert.equal(evidence.deployment_id, "dpl_abc123");
  assert.equal(evidence.vercel_source_sha, sourceCommit);
  assert.equal(evidence.build_id, "123-1");
  assert.equal(evidence.idempotency_key, `pr-42-${sourceCommit}-vercel-staging`);
});

test("Vercel staging runtime validation falls back to protected bypass query parameter", async () => {
  const calls = [];
  const runtime = await verifyVercelStagingRuntime({
    env: { VERCEL_AUTOMATION_BYPASS_SECRET: "vercel-secret" },
    metadata,
    targetUrl: "https://nutsnews-git-pr-42.vercel.app/",
    timeoutMs: 10_000,
    ...fakeClock(),
    fetchImpl: async (url, init = {}) => {
      const parsed = new URL(url);
      calls.push({
        pathname: parsed.pathname,
        bypassQuery: parsed.searchParams.get("x-vercel-protection-bypass"),
        bypassHeader: init.headers?.["x-vercel-protection-bypass"],
        bypassCookieHeader: init.headers?.["x-vercel-set-bypass-cookie"],
      });

      if (!parsed.searchParams.has("x-vercel-protection-bypass")) {
        return new Response(null, { status: 302, headers: { location: "https://vercel.com/sso-api" } });
      }
      assert.equal(parsed.searchParams.get("x-vercel-protection-bypass"), "vercel-secret");
      assert.equal(init.headers?.["x-vercel-protection-bypass"], undefined);
      assert.equal(init.headers?.["x-vercel-set-bypass-cookie"], undefined);

      if (parsed.pathname === "/healthz") {
        return json({ ok: true, sourceCommit, buildId: "123-1" }, 200, {
          "x-nutsnews-source-commit": sourceCommit,
          "x-nutsnews-build-id": "123-1",
        });
      }
      if (parsed.pathname === "/readyz") {
        return json({ ok: true, runtimeEnv: "staging" }, 200, {
          "x-nutsnews-runtime-environment": "staging",
          "x-nutsnews-deployment-target": "vercel-staging",
          "x-nutsnews-source-commit": sourceCommit,
          "x-nutsnews-build-id": "123-1",
        });
      }
      throw new Error(`Unexpected fetch ${parsed.pathname}`);
    },
  });

  assert.deepEqual(runtime, { runtime_env: "staging", deployment_target: "vercel-staging" });
  assert.ok(calls.some((call) => call.bypassHeader === "vercel-secret"));
  assert.ok(calls.some((call) => call.bypassQuery === "vercel-secret"));
  assert.ok(calls.every((call) => call.bypassCookieHeader === undefined));
});

test("Vercel staging runtime validation reports redacted endpoint fetch failures", async () => {
  let failure;
  try {
    await verifyVercelStagingRuntime({
      env: { VERCEL_AUTOMATION_BYPASS_SECRET: "vercel-secret" },
      metadata,
      targetUrl: "https://nutsnews-git-pr-42.vercel.app/",
      timeoutMs: 6_000,
      ...fakeClock(),
      fetchImpl: async () => {
        const error = new TypeError("fetch failed with vercel-secret");
        error.cause = { code: "UND_ERR_CONNECT_TIMEOUT", message: "timeout with vercel-secret" };
        throw error;
      },
    });
  } catch (error) {
    failure = error;
  }

  assert.ok(failure);
  assert.match(failure.message, /Vercel staging (health|readiness) fetch failed: UND_ERR_CONNECT_TIMEOUT/);
  assert.doesNotMatch(failure.message, /vercel-secret/);
});

test("Vercel staging runtime validation catches source drift", async () => {
  await assert.rejects(
    () =>
      verifyVercelStagingRuntime({
        env: {},
        metadata,
        targetUrl: "https://nutsnews-git-pr-42.vercel.app/",
        timeoutMs: 10_000,
        ...fakeClock(),
        fetchImpl: async (url) => {
          const parsed = new URL(url);
          if (parsed.pathname === "/healthz") {
            return json({ ok: true, sourceCommit: "c".repeat(40), buildId: "123-1" }, 200, {
              "x-nutsnews-source-commit": "c".repeat(40),
              "x-nutsnews-build-id": "123-1",
            });
          }
          return json({ ok: true, runtimeEnv: "staging" }, 200, {
            "x-nutsnews-runtime-environment": "staging",
            "x-nutsnews-deployment-target": "vercel-staging",
            "x-nutsnews-source-commit": sourceCommit,
            "x-nutsnews-build-id": "123-1",
          });
        },
      }),
    /Health source commit mismatch/,
  );
});
