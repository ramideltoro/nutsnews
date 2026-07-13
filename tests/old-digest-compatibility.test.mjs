import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { readLegacySchemaVersion } from "./fixtures/old-digest-release-reader.mjs";
import { LEGACY_COMPATIBLE_SCHEMA_VERSION, MIGRATION_HEAD } from "../web/migrationContract.mjs";

test("the recorded old-digest reader remains compatible with the expanded schema contract", () => {
  const expandedRow = {
    singleton: true,
    schema_version: LEGACY_COMPATIBLE_SCHEMA_VERSION,
    migration_head: MIGRATION_HEAD,
    schema_fingerprint: "a".repeat(32),
  };

  assert.equal(readLegacySchemaVersion(expandedRow), LEGACY_COMPATIBLE_SCHEMA_VERSION);
});

test("the expand migration does not mutate the legacy readiness marker", async () => {
  const migration = await readFile(
    resolve(import.meta.dirname, "../supabase/migrations/20260713000000_add_migration_schema_contract.sql"),
    "utf8",
  );

  assert.doesNotMatch(migration, /update\s+public\.release_readiness/i);
  assert.doesNotMatch(migration, /alter\s+table\s+public\.release_readiness/i);
});
