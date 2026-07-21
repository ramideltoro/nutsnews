import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DeploymentValidationError,
  deploymentStageIdempotencyKey,
  fetchJsonWithRetry,
  pollGitHubWorkflowRun,
  pollInfraGitHubDeployment,
  pollVercelDeployment,
  preMergeDeploymentConcurrencyGroup,
  safeDeploymentDebugSummary,
  withBoundedExponentialBackoff,
} from "../scripts/deployment_hardening.mjs";

const commit = "a".repeat(40);
const digest = `sha256:${"b".repeat(64)}`;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fakeClock() {
  let current = 0;
  const sleeps = [];
  return {
    sleeps,
    now: () => current,
    sleep: async (ms) => {
      sleeps.push(ms);
      current += ms;
    },
  };
}

test("bounded backoff retries transient failures and keeps validation failures fast", async () => {
  const clock = fakeClock();
  let attempts = 0;
  const result = await withBoundedExponentialBackoff(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("temporary network failure");
      return "ready";
    },
    { label: "test operation", timeoutMs: 10_000, initialDelayMs: 100, maxDelayMs: 1_000, sleep: clock.sleep, now: clock.now },
  );
  assert.equal(result, "ready");
  assert.equal(attempts, 3);
  assert.deepEqual(clock.sleeps, [100, 200]);

  attempts = 0;
  await assert.rejects(
    () =>
      withBoundedExponentialBackoff(
        async () => {
          attempts += 1;
          throw new DeploymentValidationError("identity mismatch");
        },
        { label: "validation", timeoutMs: 10_000, sleep: clock.sleep, now: clock.now },
      ),
    /identity mismatch/,
  );
  assert.equal(attempts, 1);
});

test("fetchJsonWithRetry retries transient HTTP failures and rejects terminal HTTP failures", async () => {
  const clock = fakeClock();
  const responses = [json({ retry: true }, 502), json({ ok: true })];
  const payload = await fetchJsonWithRetry(
    async () => responses.shift(),
    "https://api.example.test/status",
    {},
    { label: "status lookup", timeoutMs: 5_000, initialDelayMs: 50, sleep: clock.sleep, now: clock.now },
  );
  assert.deepEqual(payload, { ok: true });
  assert.deepEqual(clock.sleeps, [50]);

  await assert.rejects(
    () =>
      fetchJsonWithRetry(async () => json({ error: "bad input" }, 400), "https://api.example.test/status", {}, {
        label: "bad request",
        timeoutMs: 5_000,
        sleep: clock.sleep,
        now: clock.now,
      }),
    /HTTP 400/,
  );
});

test("GitHub workflow polling waits for success and fails fast on stale source identity", async () => {
  const clock = fakeClock();
  const states = [
    { status: "in_progress", conclusion: null, head_sha: commit },
    { status: "completed", conclusion: "success", head_sha: commit },
  ];
  const run = await pollGitHubWorkflowRun({
    fetchImpl: async () => json(states.shift()),
    repository: "ramideltoro/nutsnews",
    runId: "12345",
    expectedHeadSha: commit,
    timeoutMs: 5_000,
    initialDelayMs: 100,
    sleep: clock.sleep,
    now: clock.now,
  });
  assert.equal(run.conclusion, "success");
  assert.deepEqual(clock.sleeps, [100]);

  await assert.rejects(
    () =>
      pollGitHubWorkflowRun({
        fetchImpl: async () => json({ status: "in_progress", conclusion: null, head_sha: "c".repeat(40) }),
        repository: "ramideltoro/nutsnews",
        runId: "12345",
        expectedHeadSha: commit,
        timeoutMs: 5_000,
        sleep: clock.sleep,
        now: clock.now,
      }),
    /head SHA mismatch/,
  );
});

test("Vercel deployment polling retries transient states and rejects terminal deployment failures", async () => {
  const clock = fakeClock();
  const states = [
    json({ id: "dpl_1", readyState: "BUILDING", meta: { githubCommitSha: commit } }),
    json({ id: "dpl_1", readyState: "READY", meta: { githubCommitSha: commit } }),
  ];
  const deployment = await pollVercelDeployment({
    fetchImpl: async () => states.shift(),
    deploymentIdOrHost: "dpl_1",
    teamId: "team_1",
    token: "vercel-token",
    expectedSourceCommit: commit,
    timeoutMs: 5_000,
    initialDelayMs: 100,
    sleep: clock.sleep,
    now: clock.now,
  });
  assert.equal(deployment.normalizedReadyState, "READY");
  assert.deepEqual(clock.sleeps, [100]);

  await assert.rejects(
    () =>
      pollVercelDeployment({
        fetchImpl: async () => json({ id: "dpl_2", readyState: "ERROR", meta: { githubCommitSha: commit } }),
        deploymentIdOrHost: "dpl_2",
        token: "vercel-token",
        expectedSourceCommit: commit,
        timeoutMs: 5_000,
        sleep: clock.sleep,
        now: clock.now,
      }),
    /terminal failure/,
  );
});

test("infra deployment polling validates candidate identity and terminal status", async () => {
  const clock = fakeClock();
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/deployments")) {
      return json([
        {
          id: 99,
          statuses_url: "https://api.github.com/repos/ramideltoro/nutsnews-infra/deployments/99/statuses",
          payload: {
            deployment_id: "stg-abc",
            source_commit: commit,
            build_id: "123-1",
            requested_digest: digest,
            config_generation: "staging-stg-abc",
          },
        },
      ]);
    }
    return json([{ state: "success", description: `actual=${digest}` }]);
  };

  const deployment = await pollInfraGitHubDeployment({
    fetchImpl,
    repository: "ramideltoro/nutsnews-infra",
    environment: "staging",
    deploymentId: "stg-abc",
    expectedSourceCommit: commit,
    expectedBuildId: "123-1",
    expectedImageDigest: digest,
    expectedConfigGeneration: "staging-stg-abc",
    timeoutMs: 5_000,
    sleep: clock.sleep,
    now: clock.now,
  });
  assert.equal(deployment.state, "success");

  await assert.rejects(
    () =>
      pollInfraGitHubDeployment({
        fetchImpl: async (url) => {
          if (new URL(url).pathname.endsWith("/deployments")) {
            return json([{ id: 99, statuses_url: "https://api.github.com/statuses/99", payload: { deployment_id: "stg-abc", source_commit: "c".repeat(40) } }]);
          }
          return json([{ state: "success" }]);
        },
        repository: "ramideltoro/nutsnews-infra",
        environment: "staging",
        deploymentId: "stg-abc",
        expectedSourceCommit: commit,
        timeoutMs: 5_000,
        sleep: clock.sleep,
        now: clock.now,
      }),
    /source_commit mismatch/,
  );
});

test("pre-merge deployment concurrency, idempotency, and summaries are stable and secret-free", () => {
  assert.equal(preMergeDeploymentConcurrencyGroup({ prNumber: 42 }), "nutsnews-premerge-deploy-pr-42");
  assert.equal(
    deploymentStageIdempotencyKey({ prNumber: 42, sourceCommit: commit, targetType: "Vercel Production" }),
    `pr-42-${commit}-vercel-production`,
  );
  assert.deepEqual(
    safeDeploymentDebugSummary({
      pr_number: 42,
      source_commit: commit,
      build_id: "123-1",
      target_type: "vercel-production",
      target_url: "https://user:password@example.test/path?token=secret&safe=ok",
      token: "secret",
      authorization: "Bearer secret",
    }),
    {
      pr_number: "42",
      target_type: "vercel-production",
      target_url: "https://example.test/path?token=%5BREDACTED%5D&safe=ok",
      source_commit: commit,
      build_id: "123-1",
    },
  );
});
