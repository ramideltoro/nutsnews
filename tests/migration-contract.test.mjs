import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  MIGRATION_FILENAME,
  getMigrationContract,
  listMigrations,
  readApplicationMigrationContract,
} from "../scripts/migration_contract.mjs";
import { MIGRATION_HEAD } from "../web/migrationContract.mjs";

test("all repository migrations use ordered unique 14-digit filenames and match the compiled head", async () => {
  const [contract, appContract] = await Promise.all([
    getMigrationContract(),
    readApplicationMigrationContract(),
  ]);

  assert.equal(contract.head, MIGRATION_HEAD);
  assert.equal(appContract.migrationHead, MIGRATION_HEAD);
  assert.equal(new Set(contract.migrations.map(({ version }) => version)).size, contract.migrations.length);
  assert.deepEqual(
    contract.migrations.map(({ filename }) => filename),
    [...contract.migrations.map(({ filename }) => filename)].sort(),
  );
  assert.match(contract.sourceFingerprint, /^[a-f0-9]{64}$/);
});

test("migration validation rejects filenames that cannot have a deterministic order", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "nutsnews-migration-contract-"));
  const migrations = resolve(root, "supabase/migrations");
  await mkdir(migrations, { recursive: true });
  await writeFile(resolve(migrations, "not-a-migration.sql"), "select 1;\n");

  await assert.rejects(() => listMigrations(root), /Invalid migration filename/);
  assert.match("20260713000000_add_contract.sql", MIGRATION_FILENAME);
});

test("migration validation rejects duplicate versions before a database is touched", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "nutsnews-migration-duplicate-"));
  const migrations = resolve(root, "supabase/migrations");
  await mkdir(migrations, { recursive: true });
  await Promise.all([
    writeFile(resolve(migrations, "20260713000000_first.sql"), "select 1;\n"),
    writeFile(resolve(migrations, "20260713000000_second.sql"), "select 2;\n"),
  ]);

  await assert.rejects(() => listMigrations(root), /strictly increasing/);
});

test("migration validation requires the head migration to record its own contract atomically", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "nutsnews-migration-head-contract-"));
  const migrations = resolve(root, "supabase/migrations");
  await mkdir(migrations, { recursive: true });
  await writeFile(resolve(migrations, "20260713000000_missing_contract.sql"), "select 1;\n");

  await assert.rejects(() => getMigrationContract(root), /must atomically record its migration contract/);
});
