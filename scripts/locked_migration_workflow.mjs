#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";

import { getMigrationContract } from "./migration_contract.mjs";

const LOCK_SQL = "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtext('nutsnews:migration-workflow')); SELECT 'LOCK_ACQUIRED'; SELECT pg_catalog.pg_sleep(3600);";
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
    return Object.freeze({ target, databaseUrl });
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
  return Object.freeze({ target, databaseUrl });
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

function waitForLock(process) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stderr = "";
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => {
      process.kill("SIGTERM");
      finish(reject, new Error("Timed out waiting for the database migration lock."));
    }, 30_000);

    process.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("LOCK_ACQUIRED")) {
        finish(resolve);
      }
    });
    process.stderr.on("data", (chunk) => {
      if (stderr.length >= MAX_LOCK_CLIENT_STDERR_BYTES) return;
      stderr += chunk.toString().slice(0, MAX_LOCK_CLIENT_STDERR_BYTES - stderr.length);
    });
    process.once("error", () => {
      finish(reject, new Error("Unable to start the database migration lock client."));
    });
    process.once("exit", (code) => {
      if (!settled) {
        const reason = classifyPostgresLockFailure(stderr);
        finish(reject, new Error(`Database migration lock client exited before acquiring the lock: ${reason}.`));
      }
    });
  });
}

export async function acquirePostgresMigrationLock(databaseUrl) {
  const lockProcess = spawn(
    "psql",
    ["--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align", databaseUrl, "--command", LOCK_SQL],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  await waitForLock(lockProcess);

  return async () => {
    if (!lockProcess.killed) lockProcess.kill("SIGTERM");
    await new Promise((resolve) => lockProcess.once("exit", resolve));
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
      runCommand("supabase", ["db", "push", "--db-url", policy.databaseUrl, "--include-all"], { cwd: migrationSourceRoot });
    },
    recordContract: async () => {
      runCommand("psql", [
        "--no-psqlrc",
        "--set",
        "ON_ERROR_STOP=1",
        policy.databaseUrl,
        "--command",
        `SELECT public.nutsnews_record_migration_head('${contract.head}'); NOTIFY pgrst, 'reload schema';`,
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
