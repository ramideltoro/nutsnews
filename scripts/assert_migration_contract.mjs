#!/usr/bin/env node

import assert from "node:assert/strict";

import { getMigrationContract, readApplicationMigrationContract } from "./migration_contract.mjs";

const [migrationContract, applicationContract] = await Promise.all([
  getMigrationContract(),
  readApplicationMigrationContract(),
]);

assert.equal(
  applicationContract.migrationHead,
  migrationContract.head,
  "The compiled migration head must match the last repository migration.",
);
assert.notEqual(
  applicationContract.migrationHead,
  applicationContract.legacyVersion,
  "Expand/contract compatibility requires a distinct legacy schema marker.",
);

console.log(`Migration contract is valid at head ${migrationContract.head}.`);
