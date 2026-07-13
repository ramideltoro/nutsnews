#!/usr/bin/env node

import assert from "node:assert/strict";

import { getLocalSupabaseStatus } from "./supabase_local.mjs";

const status = getLocalSupabaseStatus();

async function lockProbe(holdMilliseconds) {
  const response = await fetch(`${status.apiUrl}/rest/v1/rpc/nutsnews_migration_lock_probe`, {
    method: "POST",
    headers: {
      apikey: status.serviceRoleKey,
      Authorization: `Bearer ${status.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ hold_milliseconds: holdMilliseconds }),
  });
  if (!response.ok) throw new Error("Disposable database migration lock probe failed.");
  return response.json();
}

const startedAt = Date.now();
const first = lockProbe(400).then(() => Date.now());
await new Promise((resolve) => setTimeout(resolve, 40));
const secondStartedAt = Date.now();
const second = lockProbe(0).then(() => Date.now());
const [firstFinishedAt, secondFinishedAt] = await Promise.all([first, second]);

assert.ok(firstFinishedAt - startedAt >= 350, "The first migration lock request did not hold the advisory lock.");
assert.ok(secondFinishedAt >= firstFinishedAt, "A second migration request bypassed the advisory lock.");
assert.ok(secondFinishedAt - secondStartedAt >= 250, "The second migration request did not wait for the advisory lock.");

console.log("Two simultaneous migration requests serialized on the disposable database advisory lock.");
