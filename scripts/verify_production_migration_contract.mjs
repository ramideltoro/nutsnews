#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { getMigrationContract, readApplicationMigrationContract } from "./migration_contract.mjs";

const databaseUrl = String(process.env.NUTSNEWS_MIGRATION_DATABASE_URL ?? "").trim();
const expectedHead = String(process.env.NUTSNEWS_EXPECTED_MIGRATION_HEAD ?? "").trim();
const expectedLegacyVersion = String(process.env.NUTSNEWS_EXPECTED_SCHEMA_VERSION ?? "").trim();
const configuredSourceRoot = String(process.env.NUTSNEWS_MIGRATION_SOURCE_ROOT ?? "").trim();

if (!databaseUrl) throw new Error("Production migration contract verification requires its protected database connection.");
if (!/^[0-9]{14}$/.test(expectedHead) || !/^[0-9]{14}$/.test(expectedLegacyVersion)) {
  throw new Error("Production migration contract verification requires approved 14-digit schema versions.");
}

const sourceRoot = configuredSourceRoot ? resolve(configuredSourceRoot) : undefined;
const [contract, applicationContract] = await Promise.all([
  getMigrationContract(sourceRoot),
  readApplicationMigrationContract(sourceRoot),
]);
if (
  contract.head !== expectedHead ||
  applicationContract.migrationHead !== contract.head ||
  applicationContract.legacyVersion !== expectedLegacyVersion
) {
  throw new Error("Checked-out migration files do not match the approved production schema contract.");
}

const result = execFileSync(
  "psql",
  [
    "--no-psqlrc",
    "--quiet",
    "--set",
    "ON_ERROR_STOP=1",
    "--tuples-only",
    "--no-align",
    databaseUrl,
    "--command",
    `SET ROLE postgres; SELECT migration_head = '${contract.head}' AND legacy_schema_version = '${applicationContract.legacyVersion}' AND expected_schema_fingerprint = actual_schema_fingerprint FROM public.nutsnews_migration_schema_contract();`,
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
).trim();

if (result !== "t") {
  throw new Error("Production database did not report the approved migration head, legacy marker, and schema fingerprint.");
}

console.log(
  `Verified production database migration head ${contract.head}, legacy schema ${applicationContract.legacyVersion}, and schema fingerprint.`,
);
