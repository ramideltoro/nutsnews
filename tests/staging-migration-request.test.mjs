import assert from "node:assert/strict";
import test from "node:test";

import {
  STAGING_MIGRATION_CONFIRMATION,
  StagingMigrationRequestError,
  assertCommitReachableFromMain,
  validateStagingMigrationRequest,
} from "../scripts/staging_migration_request.mjs";

const validRequest = {
  sourceCommit: "4a9b727b260f1380f1529524b8a01ba0b0caaac2",
  migrationHead: "20260716090000",
  confirmation: STAGING_MIGRATION_CONFIRMATION,
};

test("a fixed-purpose staging migration request accepts one complete main candidate", () => {
  assert.deepEqual(validateStagingMigrationRequest(validRequest), {
    sourceCommit: validRequest.sourceCommit,
    migrationHead: validRequest.migrationHead,
  });
});

test("staging migration requests reject partial, mutable, and unconfirmed values before environment access", () => {
  for (const request of [
    { sourceCommit: validRequest.sourceCommit, migrationHead: validRequest.migrationHead },
    { ...validRequest, sourceCommit: "main" },
    { ...validRequest, sourceCommit: `${validRequest.sourceCommit}\n` },
    { ...validRequest, migrationHead: "latest" },
    { ...validRequest, confirmation: "yes" },
    { ...validRequest, unexpected: "value" },
  ]) {
    assert.throws(() => validateStagingMigrationRequest(request), StagingMigrationRequestError);
  }
});

test("a staging migration source must already be reachable from trusted main", () => {
  const calls = [];
  assert.doesNotThrow(() => assertCommitReachableFromMain(validRequest.sourceCommit, (command, args, options) => {
    calls.push({ command, args, options });
  }));
  assert.deepEqual(calls[0].args, ["merge-base", "--is-ancestor", validRequest.sourceCommit, "origin/main"]);
  assert.throws(
    () => assertCommitReachableFromMain(validRequest.sourceCommit, () => { throw new Error("not an ancestor"); }),
    /not reachable from the trusted origin\/main history/,
  );
});
