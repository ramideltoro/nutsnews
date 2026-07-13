#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { getMigrationContract } from "./migration_contract.mjs";

const databaseUrl = String(process.env.NUTSNEWS_MIGRATION_DATABASE_URL ?? "").trim();
const expectedHead = String(process.env.NUTSNEWS_EXPECTED_MIGRATION_HEAD ?? "").trim();
const configuredSourceRoot = String(process.env.NUTSNEWS_MIGRATION_SOURCE_ROOT ?? "").trim();

if (!databaseUrl) {
  throw new Error("Staging migration contract verification requires its protected database connection.");
}
if (!/^[0-9]{14}$/.test(expectedHead)) {
  throw new Error("Staging migration contract verification requires a 14-digit expected migration head.");
}

const contract = await getMigrationContract(configuredSourceRoot ? resolve(configuredSourceRoot) : undefined);
if (contract.head !== expectedHead) {
  throw new Error("Checked-out migration files do not match the approved staging migration head.");
}

const result = execFileSync(
  "psql",
  [
    "--no-psqlrc",
    "--set",
    "ON_ERROR_STOP=1",
    "--tuples-only",
    "--no-align",
    databaseUrl,
    "--command",
    "SELECT migration_head = '" + contract.head + "' AND expected_schema_fingerprint = actual_schema_fingerprint FROM public.nutsnews_migration_schema_contract();",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
).trim();

if (result !== "t") {
  throw new Error("Staging database did not report the approved migration head and schema fingerprint.");
}

console.log(`Verified staging database migration head ${contract.head} and schema fingerprint.`);
