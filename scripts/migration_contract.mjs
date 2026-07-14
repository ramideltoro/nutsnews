import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const MIGRATION_FILENAME = /^(?<version>[0-9]{14})_(?<name>[a-z0-9][a-z0-9_]*[a-z0-9])\.sql$/;

export async function listMigrations(root = resolve(import.meta.dirname, "..")) {
  const directory = resolve(root, "supabase/migrations");
  const names = await readdir(directory);
  const migrations = [];

  for (const filename of names) {
    const match = filename.match(MIGRATION_FILENAME);
    if (!match?.groups) {
      throw new Error(`Invalid migration filename: ${filename}`);
    }
    migrations.push({
      filename,
      version: match.groups.version,
      path: resolve(directory, filename),
    });
  }

  migrations.sort((left, right) => left.filename.localeCompare(right.filename));

  if (migrations.length === 0) {
    throw new Error("No repository migrations were found.");
  }

  for (let index = 1; index < migrations.length; index += 1) {
    const previous = migrations[index - 1];
    const current = migrations[index];
    if (previous.version >= current.version) {
      throw new Error(`Migration versions must be strictly increasing: ${previous.filename}, ${current.filename}`);
    }
  }

  return Object.freeze(migrations);
}

export async function getMigrationContract(root = resolve(import.meta.dirname, "..")) {
  const migrations = await listMigrations(root);
  const hash = createHash("sha256");
  let headSource = "";

  for (const migration of migrations) {
    const source = await readFile(migration.path);
    hash.update(migration.filename);
    hash.update("\0");
    hash.update(source);
    hash.update("\0");
    if (migration === migrations.at(-1)) headSource = source.toString("utf8");
  }

  const head = migrations.at(-1).version;
  const escapedHead = head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`select\\s+public\\.nutsnews_record_migration_head\\(\\s*'${escapedHead}'\\s*\\)\\s*;`, "i").test(headSource)) {
    throw new Error(`Head migration ${head} must atomically record its migration contract.`);
  }

  return Object.freeze({
    head,
    sourceFingerprint: hash.digest("hex"),
    migrations,
  });
}

export async function readApplicationMigrationContract(root = resolve(import.meta.dirname, "..")) {
  const source = await readFile(resolve(root, "web/migrationContract.mjs"), "utf8");
  const migrationHead = source.match(/MIGRATION_HEAD\s*=\s*"([0-9]{14})"/);
  const legacyVersion = source.match(/LEGACY_COMPATIBLE_SCHEMA_VERSION\s*=\s*"([0-9]{14})"/);

  if (!migrationHead || !legacyVersion) {
    throw new Error("web/migrationContract.mjs must declare both migration contract versions.");
  }

  return Object.freeze({ migrationHead: migrationHead[1], legacyVersion: legacyVersion[1] });
}
