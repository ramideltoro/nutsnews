import assert from "node:assert/strict";
import { mkdir, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  buildExpectedStandbyManifest,
  loadStandbyManifest,
  schemaFingerprintForManifest,
  validateStandbyManifest,
} from "../scripts/supabase_standby_manifest.mjs";

test("repository standby manifest matches the Supabase migration contract", async () => {
  const summary = await validateStandbyManifest();

  assert.equal(summary.migrationHead, "20260802040522");
  assert.match(summary.schemaFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(summary.replicatedTables, 15);
  assert.equal(summary.excludedViews, 7);
  assert.equal(summary.sequenceBackedTables, 6);
  assert.equal(summary.primaryDatabase, "backend-postgres-primary-read-write");
  assert.equal(summary.standbyTarget, "existing-production-supabase");
});

test("manifest excludes views from row replication and keeps every table keyed", async () => {
  const manifest = await loadStandbyManifest();
  const tableNames = new Set(manifest.replication.tables.map((table) => table.name));

  assert.ok(tableNames.has("public.articles"));
  assert.ok(tableNames.has("public.article_engagement_daily"));
  assert.equal(tableNames.has("public.public_feed_snapshot"), false);

  for (const view of manifest.replication.excludedViews) {
    assert.equal(view.rowReplication, false);
    assert.equal(tableNames.has(view.name), false);
    assert.ok(view.validation.includes("schema-fingerprint"));
    assert.ok(view.validation.includes("derived-query-parity"));
  }

  for (const table of manifest.replication.tables) {
    assert.equal(table.rowReplication, true);
    assert.ok(table.primaryKey.length > 0 || ["full", "index"].includes(table.replicaIdentity.type));
  }
});

test("missing primary key or replica identity fails the manifest check", async () => {
  const manifest = await loadStandbyManifest();
  const table = manifest.replication.tables.find((entry) => entry.name === "public.articles");
  table.primaryKey = [];
  table.replicaIdentity = { type: "missing" };
  manifest.schemaFingerprint = schemaFingerprintForManifest(manifest);

  await assert.rejects(
    () => validateStandbyManifest(resolve(import.meta.dirname, ".."), manifest),
    /lacks primary key or replica identity metadata/,
  );
});

test("missing primary key in migrations fails before a standby manifest can be generated", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "nutsnews-standby-manifest-"));
  const migrations = resolve(root, "supabase/migrations");
  await mkdir(migrations, { recursive: true });
  await writeFile(
    resolve(migrations, "20260701000000_unkeyed_table.sql"),
    [
      "create table if not exists public.unkeyed_events (",
      "  event_name text not null",
      ");",
      "select public.nutsnews_record_migration_head('20260701000000');",
      "",
    ].join("\n"),
  );

  await assert.rejects(
    () => buildExpectedStandbyManifest(root),
    /lacks a primary key or explicit replica identity/,
  );
});

test("schema fingerprint mismatch blocks standby promotion", async () => {
  const manifest = await loadStandbyManifest();
  manifest.schemaFingerprint = "0".repeat(64);

  await assert.rejects(
    () => validateStandbyManifest(resolve(import.meta.dirname, ".."), manifest),
    /schema fingerprint mismatch; standby promotion must remain blocked/,
  );
});
