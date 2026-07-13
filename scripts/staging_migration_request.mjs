#!/usr/bin/env node

import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export const STAGING_MIGRATION_CONFIRMATION = "apply-staging-supabase-migrations";
export const SOURCE_COMMIT_PATTERN = /^[0-9a-f]{40}$/;
export const MIGRATION_HEAD_PATTERN = /^[0-9]{14}$/;

export class StagingMigrationRequestError extends Error {}

function requiredTrimmedString(request, name) {
  const value = request?.[name];
  if (typeof value !== "string" || !value || value !== value.trim()) {
    throw new StagingMigrationRequestError(`${name} must be a non-empty, trimmed string.`);
  }
  return value;
}

export function validateStagingMigrationRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new StagingMigrationRequestError("Staging migration request must be an object.");
  }

  const expected = new Set(["sourceCommit", "migrationHead", "confirmation"]);
  const keys = Object.keys(request);
  if (keys.length !== expected.size || keys.some((key) => !expected.has(key))) {
    throw new StagingMigrationRequestError("Staging migration request must contain exactly sourceCommit, migrationHead, and confirmation.");
  }

  const sourceCommit = requiredTrimmedString(request, "sourceCommit");
  const migrationHead = requiredTrimmedString(request, "migrationHead");
  const confirmation = requiredTrimmedString(request, "confirmation");

  if (!SOURCE_COMMIT_PATTERN.test(sourceCommit)) {
    throw new StagingMigrationRequestError("sourceCommit must be a full lowercase 40-character SHA.");
  }
  if (!MIGRATION_HEAD_PATTERN.test(migrationHead)) {
    throw new StagingMigrationRequestError("migrationHead must be a 14-digit migration version.");
  }
  if (confirmation !== STAGING_MIGRATION_CONFIRMATION) {
    throw new StagingMigrationRequestError("The staging migration confirmation is invalid.");
  }

  return Object.freeze({ sourceCommit, migrationHead });
}

export function assertCommitReachableFromMain(sourceCommit, exec = execFileSync) {
  try {
    exec("git", ["merge-base", "--is-ancestor", sourceCommit, "origin/main"], { stdio: "ignore" });
  } catch {
    throw new StagingMigrationRequestError("sourceCommit is not reachable from the trusted origin/main history.");
  }
}

export function writeStagingMigrationRequestOutput(request, outputPath) {
  appendFileSync(outputPath, `source_commit=${request.sourceCommit}\nmigration_head=${request.migrationHead}\n`, "utf8");
}

function run() {
  const request = validateStagingMigrationRequest({
    sourceCommit: process.env.NUTSNEWS_STAGING_MIGRATION_SOURCE_COMMIT,
    migrationHead: process.env.NUTSNEWS_STAGING_MIGRATION_HEAD,
    confirmation: process.env.NUTSNEWS_STAGING_MIGRATION_CONFIRMATION,
  });
  assertCommitReachableFromMain(request.sourceCommit);
  writeStagingMigrationRequestOutput(request, process.env.GITHUB_OUTPUT ?? "");
  console.log(`Validated trusted staging migration source ${request.sourceCommit} for schema head ${request.migrationHead}.`);
}

const invokedDirectly = process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;
if (invokedDirectly) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? `Staging migration request rejected: ${error.message}` : "Staging migration request rejected.");
    process.exitCode = 1;
  }
}
