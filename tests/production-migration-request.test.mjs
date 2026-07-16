import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_BACKUP_AGE_MS,
  PRODUCTION_MIGRATION_CONFIRMATION,
  ProductionMigrationRequestError,
  assertCommitReachableFromMain,
  validateBackupRun,
  validateProductionMigrationRequest,
} from "../scripts/production_migration_request.mjs";

const validRequest = {
  sourceCommit: "7a843f502893c5160c028622112c6df849171010",
  migrationHead: "20260716090000",
  backupRunId: "123456789",
  confirmation: PRODUCTION_MIGRATION_CONFIRMATION,
};

test("a protected production request requires one immutable main candidate and backup run", () => {
  assert.deepEqual(validateProductionMigrationRequest(validRequest), {
    sourceCommit: validRequest.sourceCommit,
    migrationHead: validRequest.migrationHead,
    backupRunId: validRequest.backupRunId,
  });
});

test("production requests reject mutable, partial, unconfirmed, and extra values", () => {
  for (const request of [
    { sourceCommit: validRequest.sourceCommit, migrationHead: validRequest.migrationHead },
    { ...validRequest, sourceCommit: "main" },
    { ...validRequest, migrationHead: "latest" },
    { ...validRequest, backupRunId: "0" },
    { ...validRequest, confirmation: "yes" },
    { ...validRequest, unexpected: "value" },
  ]) {
    assert.throws(() => validateProductionMigrationRequest(request), ProductionMigrationRequestError);
  }
});

test("production source must already be reachable from trusted main", () => {
  const calls = [];
  assert.doesNotThrow(() => assertCommitReachableFromMain(validRequest.sourceCommit, (command, args) => {
    calls.push({ command, args });
  }));
  assert.deepEqual(calls[0].args, ["merge-base", "--is-ancestor", validRequest.sourceCommit, "origin/main"]);
  assert.throws(
    () => assertCommitReachableFromMain(validRequest.sourceCommit, () => { throw new Error("not an ancestor"); }),
    /not reachable from the trusted origin\/main history/,
  );
});

test("only a fresh successful manual main Supabase Backup run is accepted", () => {
  const now = Date.parse("2026-07-14T06:00:00.000Z");
  const run = {
    id: Number(validRequest.backupRunId),
    name: "Supabase Backup",
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    head_branch: "main",
    head_repository: { full_name: "ramideltoro/nutsnews" },
    updated_at: "2026-07-14T05:30:00.000Z",
  };
  assert.equal(
    validateBackupRun(run, {
      repository: "ramideltoro/nutsnews",
      backupRunId: validRequest.backupRunId,
      now,
    }),
    run.updated_at,
  );

  for (const invalid of [
    { ...run, name: "Container Image" },
    { ...run, event: "schedule" },
    { ...run, conclusion: "failure" },
    { ...run, head_branch: "feature" },
    { ...run, head_repository: { full_name: "fork/nutsnews" } },
    { ...run, updated_at: new Date(now - MAX_BACKUP_AGE_MS - 1).toISOString() },
  ]) {
    assert.throws(
      () => validateBackupRun(invalid, {
        repository: "ramideltoro/nutsnews",
        backupRunId: validRequest.backupRunId,
        now,
      }),
      ProductionMigrationRequestError,
    );
  }
});
