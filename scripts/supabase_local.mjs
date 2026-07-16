import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvironment(output) {
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const rawValue = line.slice(separator + 1);
    values[line.slice(0, separator)] =
      rawValue.startsWith('"') && rawValue.endsWith('"') ? JSON.parse(rawValue) : rawValue;
  }
  return values;
}

/** Read local Supabase connection values without printing them. */
export function getLocalSupabaseStatus({ requireAnonKey = false } = {}) {
  let output;
  try {
    output = execFileSync("supabase", ["status", "--output", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("Local Supabase status is unavailable.");
  }

  const values = parseEnvironment(output);
  if (!values.API_URL || !values.SERVICE_ROLE_KEY || !values.DB_URL || (requireAnonKey && !values.ANON_KEY)) {
    throw new Error("Local Supabase status did not provide the required disposable-database values.");
  }

  return Object.freeze({
    apiUrl: values.API_URL.replace(/\/+$/, ""),
    anonKey: values.ANON_KEY,
    serviceRoleKey: values.SERVICE_ROLE_KEY,
    databaseUrl: values.DB_URL,
  });
}

/**
 * Execute SQL only against the disposable local stack. CI uses its psql
 * client; developer machines without psql use the local database container.
 */
export function runLocalSupabaseSql(databaseUrl, sql) {
  const args = ["--no-psqlrc", "--set", "ON_ERROR_STOP=1", databaseUrl, "--command", sql];
  try {
    execFileSync("psql", args, { stdio: "ignore" });
    return;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new Error("Disposable database schema command failed.");
    }
  }

  const config = readFileSync(resolve(import.meta.dirname, "../supabase/config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([a-z0-9-]+)"/m)?.[1];
  if (!projectId) throw new Error("Local Supabase project identity is unavailable.");

  try {
    execFileSync(
      "docker",
      ["exec", `supabase_db_${projectId}`, "psql", "-U", "postgres", "-d", "postgres", "--command", sql],
      { stdio: "ignore" },
    );
  } catch {
    throw new Error("Disposable database schema command failed.");
  }
}
