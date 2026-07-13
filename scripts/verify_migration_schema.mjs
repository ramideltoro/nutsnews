#!/usr/bin/env node

import assert from "node:assert/strict";

import { getMigrationContract } from "./migration_contract.mjs";
import { getLocalSupabaseStatus, runLocalSupabaseSql } from "./supabase_local.mjs";

async function readSchemaContract(status) {
  const response = await fetch(`${status.apiUrl}/rest/v1/rpc/nutsnews_migration_schema_contract`, {
    method: "POST",
    headers: {
      apikey: status.serviceRoleKey,
      Authorization: `Bearer ${status.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) throw new Error("Disposable database migration contract query failed.");
  const body = await response.json();
  const row = Array.isArray(body) ? body[0] : body;
  if (!row || typeof row !== "object") throw new Error("Disposable database returned no migration contract.");
  return row;
}

function runDatabaseCommand(databaseUrl, sql) {
  runLocalSupabaseSql(databaseUrl, sql);
}

const status = getLocalSupabaseStatus();
const contract = await getMigrationContract();
const baseline = await readSchemaContract(status);

assert.equal(baseline.migration_head, contract.head, "Disposable database did not reach repository migration head.");
assert.equal(
  baseline.expected_schema_fingerprint,
  baseline.actual_schema_fingerprint,
  "Disposable database schema fingerprint does not match its recorded migration contract.",
);

if (process.argv.includes("--negative-drift")) {
  try {
    runDatabaseCommand(
      status.databaseUrl,
      "ALTER TABLE public.migration_schema_contract ADD COLUMN issue_109_synthetic_drift boolean;",
    );
    const drifted = await readSchemaContract(status);
    assert.notEqual(
      drifted.expected_schema_fingerprint,
      drifted.actual_schema_fingerprint,
      "Catalog drift must be visible without updating the migration contract.",
    );
  } finally {
    runDatabaseCommand(
      status.databaseUrl,
      "ALTER TABLE public.migration_schema_contract DROP COLUMN IF EXISTS issue_109_synthetic_drift;",
    );
  }

  const restored = await readSchemaContract(status);
  assert.equal(
    restored.expected_schema_fingerprint,
    restored.actual_schema_fingerprint,
    "Disposable database schema did not return to its migration contract after the negative test.",
  );
}

console.log("Disposable database schema reaches migration head and schema drift is detected.");
