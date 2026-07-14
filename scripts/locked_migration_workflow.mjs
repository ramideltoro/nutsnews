#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { getMigrationContract } from "./migration_contract.mjs";

const LOCK_NAME = "nutsnews:migration-workflow";
const LOCK_CLIENT_SLEEP_SECONDS = 600;
const LOCK_MARKER_POLL_MS = 100;
const MAX_PRODUCTION_BACKUP_AGE_MS = 60 * 60 * 1000;
const MAX_LOCK_CLIENT_STDERR_BYTES = 8_192;

function environmentValue(env, name) {
  return String(env[name] ?? "").trim();
}

export function getMigrationSourceRoot(env = process.env) {
  const configuredRoot = environmentValue(env, "NUTSNEWS_MIGRATION_SOURCE_ROOT");
  return configuredRoot ? resolve(configuredRoot) : resolve(import.meta.dirname, "..");
}

export function getMigrationWorkflowPolicy(env = process.env, now = Date.now()) {
  const target = environmentValue(env, "NUTSNEWS_MIGRATION_TARGET");
  const purpose = environmentValue(env, "NUTSNEWS_MIGRATION_PURPOSE");
  const direction = environmentValue(env, "NUTSNEWS_MIGRATION_DIRECTION");
  const databaseUrl = environmentValue(env, "NUTSNEWS_MIGRATION_DATABASE_URL");

  if (!databaseUrl) {
    throw new Error("Locked migration workflow requires a database connection supplied by its protected environment.");
  }
  if (direction !== "up") {
    throw new Error("Only forward migrations are supported; automatic reverse migrations are prohibited.");
  }
  if (target === "staging" && purpose === "staging-qualification") {
    return Object.freeze({ target, databaseUrl, useLinkedProject: false });
  }
  if (target !== "production" || purpose !== "production-protected") {
    throw new Error("Migration target must be staging-qualification or production-protected.");
  }
  if (environmentValue(env, "NUTSNEWS_PRODUCTION_MIGRATION_APPROVAL") !== "approved") {
    throw new Error("Production migration requires explicit protected approval.");
  }

  const backupAt = Date.parse(environmentValue(env, "NUTSNEWS_PRODUCTION_BACKUP_COMPLETED_AT"));
  if (!Number.isFinite(backupAt) || backupAt > now || now - backupAt > MAX_PRODUCTION_BACKUP_AGE_MS) {
    throw new Error("Production migration requires a current backup freshness preflight.");
  }
  const useLinkedProject = environmentValue(env, "NUTSNEWS_MIGRATION_USE_LINKED_PROJECT") === "true";
  return Object.freeze({ target, databaseUrl, useLinkedProject });
}

export function classifyPostgresLockFailure(stderr) {
  const output = String(stderr ?? "");

  if (/invalid percent-encoded token|invalid connection option|could not parse connection string/i.test(output)) {
    return "the protected staging database URL is malformed; use the complete Session Pooler URL and percent-encode password special characters";
  }
  if (/password authentication failed|authentication failed|tenant or user not found/i.test(output)) {
    return "staging database authentication was rejected; verify the protected URL username and password";
  }
  if (/could not translate host name|name or service not known|nodename nor servname provided/i.test(output)) {
    return "the staging database host could not be resolved; verify the protected Session Pooler host";
  }
  if (/network is unreachable|connection timed out|timeout expired|could not connect to server|connection refused/i.test(output)) {
    return "the staging database could not be reached; verify the protected Session Pooler host and port";
  }
  if (/database .* does not exist/i.test(output)) {
    return "the configured staging database does not exist; verify the database name in the protected URL";
  }
  if (/no pg_hba\.conf entry|ssl.*(?:required|disabled)|server does not support ssl/i.test(output)) {
    return "the staging database TLS or access policy rejected the connection; verify the protected Session Pooler URL";
  }
  return "the protected staging database connection failed before the advisory lock was acquired";
}

export function getPostgresLockScript(markerPath) {
  return [
    "\\set ON_ERROR_STOP on",
    "SET ROLE postgres;",
    `SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtext('${LOCK_NAME}'));`,
    `\\o ${markerPath}`,
    "SELECT 'LOCK_ACQUIRED';",
    "\\o",
    `SELECT pg_catalog.pg_sleep(${LOCK_CLIENT_SLEEP_SECONDS});`,
    "",
  ].join("\n");
}

export function getPostgresLockClient(databaseUrl, lockScriptPath) {
  return Object.freeze({
    command: "psql",
    args: ["--no-psqlrc", "--tuples-only", "--no-align", databaseUrl, "--file", lockScriptPath],
  });
}

async function createMigrationLockFiles() {
  const directory = await mkdtemp(join(tmpdir(), "nutsnews-migration-lock-"));
  const markerPath = join(directory, "acquired");
  const lockScriptPath = join(directory, "lock.sql");
  try {
    await chmod(directory, 0o700);
    await writeFile(lockScriptPath, getPostgresLockScript(markerPath), { mode: 0o600 });
    return Object.freeze({ directory, markerPath, lockScriptPath });
  } catch (error) {
    await removeMigrationLockFiles(directory);
    throw error;
  }
}

async function removeMigrationLockFiles(directory) {
  await rm(directory, { recursive: true, force: true });
}

function waitForLock(lockProcess, markerPath) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stderr = "";
    let markerPoll;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(markerPoll);
      callback(value);
    };
    const timeout = setTimeout(() => {
      lockProcess.kill("SIGTERM");
      finish(reject, new Error("Timed out waiting for the database migration lock."));
    }, 30_000);

    const pollMarker = async () => {
      try {
        const marker = await readFile(markerPath, "utf8");
        if (marker.includes("LOCK_ACQUIRED")) {
          finish(resolve);
          return;
        }
      } catch (error) {
        if (error?.code !== "ENOENT") {
          finish(reject, new Error("Unable to read the database migration lock marker."));
          return;
        }
      }
      if (!settled) markerPoll = setTimeout(pollMarker, LOCK_MARKER_POLL_MS);
    };

    lockProcess.stderr.on("data", (chunk) => {
      if (stderr.length >= MAX_LOCK_CLIENT_STDERR_BYTES) return;
      stderr += chunk.toString().slice(0, MAX_LOCK_CLIENT_STDERR_BYTES - stderr.length);
    });
    lockProcess.once("error", () => {
      finish(reject, new Error("Unable to start the database migration lock client."));
    });
    lockProcess.once("exit", () => {
      if (!settled) {
        const reason = classifyPostgresLockFailure(stderr);
        finish(reject, new Error(`Database migration lock client exited before acquiring the lock: ${reason}.`));
      }
    });
    pollMarker();
  });
}

async function stopLockClient(lockProcess) {
  if (lockProcess.exitCode !== null || lockProcess.signalCode !== null) return;
  lockProcess.kill("SIGTERM");
  await new Promise((resolve) => {
    const onExit = () => resolve();
    lockProcess.once("exit", onExit);
    if (lockProcess.exitCode !== null || lockProcess.signalCode !== null) {
      lockProcess.off("exit", onExit);
      resolve();
    }
  });
}

export async function acquirePostgresMigrationLock(databaseUrl) {
  const lockFiles = await createMigrationLockFiles();
  const lockClient = getPostgresLockClient(databaseUrl, lockFiles.lockScriptPath);
  const lockProcess = spawn(lockClient.command, lockClient.args, { stdio: ["ignore", "pipe", "pipe"] });
  try {
    await waitForLock(lockProcess, lockFiles.markerPath);
  } catch (error) {
    await stopLockClient(lockProcess);
    await removeMigrationLockFiles(lockFiles.directory);
    throw error;
  }

  let released = false;
  return async () => {
    if (released) return;
    released = true;
    await stopLockClient(lockProcess);
    await removeMigrationLockFiles(lockFiles.directory);
  };
}

export async function runWithMigrationLock({ acquireLock, applyMigrations, recordContract }) {
  const releaseLock = await acquireLock();
  try {
    await applyMigrations();
    await recordContract();
  } finally {
    await releaseLock();
  }
}

function runCommand(command, args, options = {}) {
  try {
    execFileSync(command, args, { stdio: "inherit", ...options });
  } catch {
    throw new Error("Locked migration workflow command failed.");
  }
}

export async function runLockedMigrationWorkflow(env = process.env) {
  const policy = getMigrationWorkflowPolicy(env);
  const migrationSourceRoot = getMigrationSourceRoot(env);
  const contract = await getMigrationContract(migrationSourceRoot);

  await runWithMigrationLock({
    acquireLock: () => acquirePostgresMigrationLock(policy.databaseUrl),
    applyMigrations: async () => {
      const args = policy.useLinkedProject
        ? ["db", "push", "--linked", "--include-all"]
        : ["db", "push", "--db-url", policy.databaseUrl, "--include-all"];
      runCommand("supabase", args, { cwd: migrationSourceRoot });
    },
    recordContract: async () => {
      runCommand("psql", [
        "--no-psqlrc",
        "--set",
        "ON_ERROR_STOP=1",
        policy.databaseUrl,
        "--command",
        `SET ROLE postgres; SELECT public.nutsnews_record_migration_head('${contract.head}'); NOTIFY pgrst, 'reload schema';`,
      ]);
    },
  });

  console.log(`Locked ${policy.target} forward migration workflow completed at head ${contract.head}.`);
}

const invokedDirectly = process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;
if (invokedDirectly) {
  runLockedMigrationWorkflow().catch((error) => {
    console.error(error instanceof Error ? error.message : "Locked migration workflow failed.");
    process.exitCode = 1;
  });
}
