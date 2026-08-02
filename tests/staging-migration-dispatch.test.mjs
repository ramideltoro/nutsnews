import assert from "node:assert/strict";
import test from "node:test";

import {
  dispatchAndWaitForStagingMigration,
  getStagingMigrationDispatchRequest,
} from "../scripts/staging_migration_dispatch.mjs";

const sourceCommit = "a".repeat(40);
const migrationHead = "20260802040522";
const request = getStagingMigrationDispatchRequest({
  GITHUB_TOKEN: "synthetic-token",
  GITHUB_REPOSITORY: "ramideltoro/nutsnews",
  GITHUB_API_URL: "https://api.github.com",
  NUTSNEWS_STAGING_MIGRATION_SOURCE_COMMIT: sourceCommit,
  NUTSNEWS_STAGING_MIGRATION_HEAD: migrationHead,
});

function jsonResponse(value) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

test("dispatches the exact migration and waits for its successful run", async () => {
  const calls = [];
  const result = await dispatchAndWaitForStagingMigration({
    request,
    now: () => Date.parse("2026-08-02T05:00:00Z"),
    sleep: async () => {},
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });
      if (url.endsWith("/dispatches")) return new Response(null, { status: 204 });
      return jsonResponse({
        workflow_runs: [{
          id: 42,
          event: "workflow_dispatch",
          display_title: `Staging Supabase migration for ${sourceCommit}`,
          created_at: "2026-08-02T05:00:00Z",
          status: "completed",
          conclusion: "success",
          html_url: "https://github.com/ramideltoro/nutsnews/actions/runs/42",
        }],
      });
    },
  });

  assert.equal(result.runId, "42");
  const payload = JSON.parse(calls[0].init.body);
  assert.deepEqual(payload, {
    ref: "main",
    inputs: {
      source_commit: sourceCommit,
      migration_head: migrationHead,
      confirmation: "apply-staging-supabase-migrations",
    },
  });
});

test("fails closed when the isolated migration fails", async () => {
  await assert.rejects(
    dispatchAndWaitForStagingMigration({
      request,
      now: () => Date.parse("2026-08-02T05:00:00Z"),
      sleep: async () => {},
      fetchImpl: async (url) => {
        if (url.endsWith("/dispatches")) return new Response(null, { status: 204 });
        return jsonResponse({
          workflow_runs: [{
            id: 43,
            event: "workflow_dispatch",
            display_title: `Staging Supabase migration for ${sourceCommit}`,
            created_at: "2026-08-02T05:00:00Z",
            status: "completed",
            conclusion: "failure",
          }],
        });
      },
    }),
    /completed with failure/,
  );
});

test("rejects an untrusted repository or mutable migration identity", () => {
  assert.throws(
    () => getStagingMigrationDispatchRequest({
      GITHUB_TOKEN: "synthetic-token",
      GITHUB_REPOSITORY: "other/repository",
      GITHUB_API_URL: "https://api.github.com",
      NUTSNEWS_STAGING_MIGRATION_SOURCE_COMMIT: sourceCommit,
      NUTSNEWS_STAGING_MIGRATION_HEAD: migrationHead,
    }),
    /trusted NutsNews GitHub API repository/,
  );
  assert.throws(
    () => getStagingMigrationDispatchRequest({
      GITHUB_TOKEN: "synthetic-token",
      GITHUB_REPOSITORY: "ramideltoro/nutsnews",
      GITHUB_API_URL: "https://api.github.com",
      NUTSNEWS_STAGING_MIGRATION_SOURCE_COMMIT: "main",
      NUTSNEWS_STAGING_MIGRATION_HEAD: migrationHead,
    }),
    /immutable source/,
  );
});
