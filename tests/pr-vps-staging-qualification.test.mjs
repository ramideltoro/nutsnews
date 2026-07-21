import assert from "node:assert/strict";
import { test } from "node:test";

import { findInfraStagingQualification } from "../scripts/pr_vps_staging_qualification.mjs";

const deploymentId = `stg-${"a".repeat(24)}`;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
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

test("findInfraStagingQualification returns the successful run with the exact deployment artifact", async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/actions/runs/777")) {
      return json({ id: 777, updated_at: "2026-07-20T00:01:00Z" });
    }
    if (parsed.pathname.endsWith("/actions/workflows/nutsnews-staging-qualification.yml/runs")) {
      return json({
        workflow_runs: [
          {
            id: 101,
            status: "completed",
            conclusion: "success",
            run_attempt: 1,
            html_url: "https://github.com/run/101",
            run_started_at: "2026-07-19T23:55:00Z",
          },
          {
            id: 202,
            status: "completed",
            conclusion: "success",
            run_attempt: 2,
            html_url: "https://github.com/run/202",
            run_started_at: "2026-07-20T00:02:00Z",
          },
        ],
      });
    }
    if (parsed.pathname.endsWith("/actions/runs/101/artifacts")) {
      return json({ artifacts: [{ id: 1, name: `staging-qualification-${deploymentId}-101-1` }] });
    }
    if (parsed.pathname.endsWith("/actions/runs/202/artifacts")) {
      return json({ artifacts: [{ id: 2, name: `staging-qualification-${deploymentId}-202-2` }] });
    }
    throw new Error(`Unexpected fetch ${parsed}`);
  };

  const result = await findInfraStagingQualification({
    fetchImpl,
    token: "token",
    stagingDeployRunId: "777",
    stagingDeploymentId: deploymentId,
    timeoutMs: 30_000,
    ...fakeClock(),
  });
  assert.equal(result.run_id, "202");
  assert.equal(result.artifact_name, `staging-qualification-${deploymentId}-202-2`);
});

test("findInfraStagingQualification fails fast when the matching qualification failed", async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/actions/runs/777")) {
      return json({ id: 777, updated_at: "2026-07-20T00:01:00Z" });
    }
    if (parsed.pathname.endsWith("/actions/workflows/nutsnews-staging-qualification.yml/runs")) {
      return json({
        workflow_runs: [
          {
            id: 303,
            status: "completed",
            conclusion: "failure",
            run_attempt: 1,
            html_url: "https://github.com/run/303",
            run_started_at: "2026-07-20T00:02:00Z",
          },
        ],
      });
    }
    if (parsed.pathname.endsWith("/actions/runs/303/artifacts")) {
      return json({ artifacts: [{ id: 3, name: `staging-qualification-${deploymentId}-303-1` }] });
    }
    throw new Error(`Unexpected fetch ${parsed}`);
  };

  await assert.rejects(
    () =>
      findInfraStagingQualification({
        fetchImpl,
        token: "token",
        stagingDeployRunId: "777",
        stagingDeploymentId: deploymentId,
        timeoutMs: 30_000,
        ...fakeClock(),
      }),
    /concluded failure/,
  );
});
