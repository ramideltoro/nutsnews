#!/usr/bin/env node

import assert from "node:assert/strict";

import { LEGACY_COMPATIBLE_SCHEMA_VERSION } from "../web/migrationContract.mjs";
import { readLegacySchemaVersion } from "../tests/fixtures/old-digest-release-reader.mjs";
import { getLocalSupabaseStatus } from "./supabase_local.mjs";

const status = getLocalSupabaseStatus();
const response = await fetch(
  `${status.apiUrl}/rest/v1/release_readiness?singleton=eq.true&select=schema_version`,
  {
    headers: {
      apikey: status.serviceRoleKey,
      Authorization: `Bearer ${status.serviceRoleKey}`,
    },
  },
);
if (!response.ok) throw new Error("Old-digest compatibility reader could not query the expanded disposable schema.");

const rows = await response.json();
assert.equal(readLegacySchemaVersion(Array.isArray(rows) ? rows[0] : rows), LEGACY_COMPATIBLE_SCHEMA_VERSION);

console.log("Recorded old-digest reader remains compatible with the expanded disposable schema.");
