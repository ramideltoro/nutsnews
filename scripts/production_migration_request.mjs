#!/usr/bin/env node

import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export const PRODUCTION_MIGRATION_CONFIRMATION = "apply-production-supabase-migrations";
export const MAX_BACKUP_AGE_MS = 60 * 60 * 1000;

export class ProductionMigrationRequestError extends Error {}

function requiredTrimmedString(request, name) {
  const value = request?.[name];
  if (typeof value !== "string" || !value || value !== value.trim()) {
    throw new ProductionMigrationRequestError(`${name} must be a non-empty, trimmed string.`);
  }
  return value;
}

export function validateProductionMigrationRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new ProductionMigrationRequestError("Production migration request must be an object.");
  }

  const expected = new Set(["sourceCommit", "migrationHead", "backupRunId", "confirmation"]);
  const keys = Object.keys(request);
  if (keys.length !== expected.size || keys.some((key) => !expected.has(key))) {
    throw new ProductionMigrationRequestError(
      "Production migration request must contain exactly sourceCommit, migrationHead, backupRunId, and confirmation.",
    );
  }

  const sourceCommit = requiredTrimmedString(request, "sourceCommit");
  const migrationHead = requiredTrimmedString(request, "migrationHead");
  const backupRunId = requiredTrimmedString(request, "backupRunId");
  const confirmation = requiredTrimmedString(request, "confirmation");

  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new ProductionMigrationRequestError("sourceCommit must be a full lowercase 40-character SHA.");
  }
  if (!/^[0-9]{14}$/.test(migrationHead)) {
    throw new ProductionMigrationRequestError("migrationHead must be a 14-digit migration version.");
  }
  if (!/^[1-9][0-9]*$/.test(backupRunId)) {
    throw new ProductionMigrationRequestError("backupRunId must be a positive GitHub Actions run ID.");
  }
  if (confirmation !== PRODUCTION_MIGRATION_CONFIRMATION) {
    throw new ProductionMigrationRequestError("The production migration confirmation is invalid.");
  }

  return Object.freeze({ sourceCommit, migrationHead, backupRunId });
}

export function assertCommitReachableFromMain(sourceCommit, exec = execFileSync) {
  try {
    exec("git", ["merge-base", "--is-ancestor", sourceCommit, "origin/main"], { stdio: "ignore" });
  } catch {
    throw new ProductionMigrationRequestError("sourceCommit is not reachable from the trusted origin/main history.");
  }
}

export function validateBackupRun(run, { repository, backupRunId, now = Date.now() }) {
  if (!run || typeof run !== "object" || Array.isArray(run)) {
    throw new ProductionMigrationRequestError("The backup workflow response is invalid.");
  }
  if (String(run.id ?? "") !== backupRunId) {
    throw new ProductionMigrationRequestError("The backup workflow run ID does not match the approved request.");
  }
  if (
    run.name !== "Supabase Backup" ||
    run.event !== "workflow_dispatch" ||
    run.status !== "completed" ||
    run.conclusion !== "success" ||
    run.head_branch !== "main" ||
    run.head_repository?.full_name !== repository
  ) {
    throw new ProductionMigrationRequestError("The approved run is not a successful manual main Supabase Backup run.");
  }

  const completedAt = Date.parse(String(run.updated_at ?? run.completed_at ?? ""));
  if (!Number.isFinite(completedAt) || completedAt > now || now - completedAt > MAX_BACKUP_AGE_MS) {
    throw new ProductionMigrationRequestError("The approved Supabase backup is not fresh enough for production migration.");
  }
  return new Date(completedAt).toISOString();
}

export async function fetchBackupRun({ repository, backupRunId, token, fetchImpl = fetch }) {
  if (!/^ramideltoro\/nutsnews$/.test(repository) || !token) {
    throw new ProductionMigrationRequestError("Trusted GitHub repository context is missing.");
  }
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/actions/runs/${backupRunId}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2026-03-10",
    },
  });
  if (!response.ok) {
    throw new ProductionMigrationRequestError(`GitHub backup-run verification returned ${response.status}.`);
  }
  return response.json();
}

export function writeProductionMigrationRequestOutput(request, backupCompletedAt, outputPath) {
  appendFileSync(
    outputPath,
    [
      `source_commit=${request.sourceCommit}`,
      `migration_head=${request.migrationHead}`,
      `backup_run_id=${request.backupRunId}`,
      `backup_completed_at=${backupCompletedAt}`,
      "",
    ].join("\n"),
    "utf8",
  );
}

async function run() {
  const request = validateProductionMigrationRequest({
    sourceCommit: process.env.NUTSNEWS_PRODUCTION_MIGRATION_SOURCE_COMMIT,
    migrationHead: process.env.NUTSNEWS_PRODUCTION_MIGRATION_HEAD,
    backupRunId: process.env.NUTSNEWS_PRODUCTION_BACKUP_RUN_ID,
    confirmation: process.env.NUTSNEWS_PRODUCTION_MIGRATION_CONFIRMATION,
  });
  assertCommitReachableFromMain(request.sourceCommit);
  const repository = String(process.env.GITHUB_REPOSITORY ?? "").trim();
  const backupRun = await fetchBackupRun({
    repository,
    backupRunId: request.backupRunId,
    token: String(process.env.GITHUB_TOKEN ?? ""),
  });
  const backupCompletedAt = validateBackupRun(backupRun, {
    repository,
    backupRunId: request.backupRunId,
  });
  writeProductionMigrationRequestOutput(request, backupCompletedAt, process.env.GITHUB_OUTPUT ?? "");
  console.log(
    `Validated trusted production migration source ${request.sourceCommit}, schema head ${request.migrationHead}, and fresh backup run ${request.backupRunId}.`,
  );
}

const invokedDirectly = process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;
if (invokedDirectly) {
  run().catch((error) => {
    console.error(
      error instanceof Error ? `Production migration request rejected: ${error.message}` : "Production migration request rejected.",
    );
    process.exitCode = 1;
  });
}
