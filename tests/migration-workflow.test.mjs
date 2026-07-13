import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import {
  classifyPostgresLockFailure,
  getMigrationSourceRoot,
  getMigrationWorkflowPolicy,
  runWithMigrationLock,
} from "../scripts/locked_migration_workflow.mjs";

test("two simultaneous migration requests serialize around one lock", async () => {
  let held = false;
  let waiting = [];
  let concurrentApplications = 0;
  let maximumConcurrentApplications = 0;
  const applied = [];

  async function acquireLock() {
    while (held) {
      await new Promise((resolve) => waiting.push(resolve));
    }
    held = true;
    return async () => {
      held = false;
      waiting.shift()?.();
    };
  }

  async function request(name) {
    await runWithMigrationLock({
      acquireLock,
      applyMigrations: async () => {
        concurrentApplications += 1;
        maximumConcurrentApplications = Math.max(maximumConcurrentApplications, concurrentApplications);
        applied.push(`${name}:apply`);
        await new Promise((resolve) => setTimeout(resolve, 20));
        concurrentApplications -= 1;
      },
      recordContract: async () => applied.push(`${name}:record`),
    });
  }

  await Promise.all([request("first"), request("second")]);
  assert.equal(maximumConcurrentApplications, 1);
  assert.deepEqual(applied, ["first:apply", "first:record", "second:apply", "second:record"]);
});

test("the fixed-purpose migration policy blocks reverse and unprotected production operations", () => {
  const staging = getMigrationWorkflowPolicy({
    NUTSNEWS_MIGRATION_TARGET: "staging",
    NUTSNEWS_MIGRATION_PURPOSE: "staging-qualification",
    NUTSNEWS_MIGRATION_DIRECTION: "up",
    NUTSNEWS_MIGRATION_DATABASE_URL: "postgresql://synthetic",
  });

  assert.equal(staging.target, "staging");
  assert.throws(
    () => getMigrationWorkflowPolicy({
      NUTSNEWS_MIGRATION_TARGET: "production",
      NUTSNEWS_MIGRATION_PURPOSE: "production-protected",
      NUTSNEWS_MIGRATION_DIRECTION: "down",
      NUTSNEWS_MIGRATION_DATABASE_URL: "postgresql://synthetic",
    }),
    /automatic reverse migrations are prohibited/,
  );
  assert.throws(
    () => getMigrationWorkflowPolicy({
      NUTSNEWS_MIGRATION_TARGET: "production",
      NUTSNEWS_MIGRATION_PURPOSE: "production-protected",
      NUTSNEWS_MIGRATION_DIRECTION: "up",
      NUTSNEWS_MIGRATION_DATABASE_URL: "postgresql://synthetic",
    }),
    /explicit protected approval/,
  );
  assert.throws(
    () => getMigrationWorkflowPolicy({
      NUTSNEWS_MIGRATION_TARGET: "production",
      NUTSNEWS_MIGRATION_PURPOSE: "production-protected",
      NUTSNEWS_MIGRATION_DIRECTION: "up",
      NUTSNEWS_MIGRATION_DATABASE_URL: "postgresql://synthetic",
      NUTSNEWS_PRODUCTION_MIGRATION_APPROVAL: "approved",
      NUTSNEWS_PRODUCTION_BACKUP_COMPLETED_AT: "2000-01-01T00:00:00.000Z",
    }),
    /current backup freshness preflight/,
  );
});

test("migration automation can use approved source files without executing source scripts", () => {
  assert.equal(getMigrationSourceRoot({}), resolve(import.meta.dirname, ".."));
  assert.equal(getMigrationSourceRoot({ NUTSNEWS_MIGRATION_SOURCE_ROOT: "/tmp/approved-source" }), "/tmp/approved-source");
});

test("lock failures classify malformed credentials without exposing a connection URL", () => {
  const protectedUrl = "postgresql://postgres.example:do-not-log-me@pooler.example:5432/postgres";
  const diagnosis = classifyPostgresLockFailure(`psql: error: invalid percent-encoded token in ${protectedUrl}`);

  assert.match(diagnosis, /malformed/i);
  assert.doesNotMatch(diagnosis, /do-not-log-me|pooler\.example|postgresql:/i);
});
