#!/usr/bin/env node

import { appendFileSync } from "node:fs";

export const STANDBY_PROJECT_POLICY = "fresh-project";

export const REQUIRED_STANDBY_VALUES = Object.freeze([
  "NUTSNEWS_STANDBY_SUPABASE_PROJECT_REF",
  "NUTSNEWS_STANDBY_SUPABASE_URL",
  "NUTSNEWS_STANDBY_SUPABASE_DB_URL",
  "NUTSNEWS_STANDBY_SUPABASE_SERVICE_ROLE_KEY",
  "NUTSNEWS_STANDBY_SUPABASE_ANON_KEY",
]);

export class SupabaseStandbyReadinessError extends Error {}

function requireTrimmedEnv(env, name) {
  const value = env?.[name];
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    throw new SupabaseStandbyReadinessError(`${name} must be present as a trimmed protected value.`);
  }
  return value;
}

function parseUrl(value, name) {
  try {
    return new URL(value);
  } catch {
    throw new SupabaseStandbyReadinessError(`${name} must be a valid URL.`);
  }
}

function validateProjectRef(projectRef, name) {
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new SupabaseStandbyReadinessError(`${name} must be a lowercase 20-character Supabase project ref.`);
  }
}

function validateKeyShape(value, name, allowedPrefixes) {
  const legacyJwt = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
  const modernKey = allowedPrefixes.some((prefix) => value.startsWith(prefix));
  if (!legacyJwt && !modernKey) {
    throw new SupabaseStandbyReadinessError(`${name} must look like a Supabase legacy JWT or modern API key.`);
  }
}

export function validateSupabaseStandbyReadinessEnv(env = process.env) {
  const policy = String(env.NUTSNEWS_STANDBY_PROJECT_POLICY ?? STANDBY_PROJECT_POLICY).trim();
  if (policy !== STANDBY_PROJECT_POLICY) {
    throw new SupabaseStandbyReadinessError("Supabase standby must use the fresh-project policy for issue #496.");
  }

  const projectRef = requireTrimmedEnv(env, "NUTSNEWS_STANDBY_SUPABASE_PROJECT_REF");
  const standbyUrlValue = requireTrimmedEnv(env, "NUTSNEWS_STANDBY_SUPABASE_URL");
  const databaseUrlValue = requireTrimmedEnv(env, "NUTSNEWS_STANDBY_SUPABASE_DB_URL");
  const serviceRoleKey = requireTrimmedEnv(env, "NUTSNEWS_STANDBY_SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = requireTrimmedEnv(env, "NUTSNEWS_STANDBY_SUPABASE_ANON_KEY");
  const productionProjectRef = String(env.NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF ?? "").trim();

  validateProjectRef(projectRef, "NUTSNEWS_STANDBY_SUPABASE_PROJECT_REF");
  if (productionProjectRef) {
    validateProjectRef(productionProjectRef, "NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF");
    if (productionProjectRef === projectRef) {
      throw new SupabaseStandbyReadinessError("Standby project ref must differ from the production Supabase project ref.");
    }
  }

  const standbyUrl = parseUrl(standbyUrlValue, "NUTSNEWS_STANDBY_SUPABASE_URL");
  if (standbyUrl.protocol !== "https:" || standbyUrl.hostname !== `${projectRef}.supabase.co` || !["", "/"].includes(standbyUrl.pathname)) {
    throw new SupabaseStandbyReadinessError("NUTSNEWS_STANDBY_SUPABASE_URL must be the HTTPS URL for the standby project ref.");
  }

  const databaseUrl = parseUrl(databaseUrlValue, "NUTSNEWS_STANDBY_SUPABASE_DB_URL");
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new SupabaseStandbyReadinessError("NUTSNEWS_STANDBY_SUPABASE_DB_URL must use the postgres/postgresql protocol.");
  }
  if (databaseUrl.hostname !== `db.${projectRef}.supabase.co` || !["", "5432"].includes(databaseUrl.port)) {
    throw new SupabaseStandbyReadinessError("NUTSNEWS_STANDBY_SUPABASE_DB_URL must target the direct standby Supabase database host.");
  }
  if (databaseUrl.pathname !== "/postgres") {
    throw new SupabaseStandbyReadinessError("NUTSNEWS_STANDBY_SUPABASE_DB_URL must target the postgres database.");
  }
  if (databaseUrl.searchParams.get("sslmode") !== "require") {
    throw new SupabaseStandbyReadinessError("NUTSNEWS_STANDBY_SUPABASE_DB_URL must require TLS with sslmode=require.");
  }
  if (!databaseUrl.username || !databaseUrl.password) {
    throw new SupabaseStandbyReadinessError("NUTSNEWS_STANDBY_SUPABASE_DB_URL must include protected database credentials.");
  }

  validateKeyShape(serviceRoleKey, "NUTSNEWS_STANDBY_SUPABASE_SERVICE_ROLE_KEY", ["sb_secret_"]);
  validateKeyShape(anonKey, "NUTSNEWS_STANDBY_SUPABASE_ANON_KEY", ["sb_publishable_"]);
  if (serviceRoleKey === anonKey) {
    throw new SupabaseStandbyReadinessError("Standby service-role and anon keys must be distinct.");
  }

  return Object.freeze({
    policy,
    requiredValueCount: REQUIRED_STANDBY_VALUES.length,
    projectRefIsPresent: true,
    standbyUrlShape: "https-project-url",
    databaseUrlShape: "direct-postgres-ssl",
    productionIsolation: productionProjectRef ? "standby-ref-differs-from-production-ref" : "production-ref-not-provided",
  });
}

export function standbyReadinessSummary(metadata) {
  return [
    "## Supabase standby credential readiness",
    "",
    `- Standby project policy: \`${metadata.policy}\``,
    `- Required protected values present: \`${metadata.requiredValueCount}/${REQUIRED_STANDBY_VALUES.length}\``,
    `- Standby URL shape: \`${metadata.standbyUrlShape}\``,
    `- Direct database URL shape: \`${metadata.databaseUrlShape}\``,
    `- Production isolation: \`${metadata.productionIsolation}\``,
    "- Raw URLs, keys, database users, passwords, and row data were not printed.",
    "",
  ].join("\n");
}

function writeGitHubSummary(summary, outputPath = process.env.GITHUB_STEP_SUMMARY) {
  if (outputPath) {
    appendFileSync(outputPath, summary, "utf8");
  }
}

async function run() {
  const metadata = validateSupabaseStandbyReadinessEnv();
  writeGitHubSummary(standbyReadinessSummary(metadata));
  console.log("Supabase standby protected credential inventory validated with safe metadata only.");
}

const invokedDirectly = process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;
if (invokedDirectly) {
  run().catch((error) => {
    console.error(error instanceof Error ? `Supabase standby readiness rejected: ${error.message}` : "Supabase standby readiness rejected.");
    process.exitCode = 1;
  });
}
