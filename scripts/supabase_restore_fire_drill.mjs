#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { getLocalSupabaseStatus } from "./supabase_local.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_BACKUP_DIR = join(repoRoot, "backups", "supabase");
const DEFAULT_REPORT_DIR = join(repoRoot, "reports", "supabase-restore");
const DEFAULT_MAX_BACKUP_AGE_HOURS = 30;
const DEFAULT_EXPECTED_TABLES = [
  "articles",
  "article_summaries",
  "rss_feeds",
  "feed_health",
  "worker_runs",
  "article_ai_reviews",
  "ai_usage_runs",
  "quota_usage_events",
  "runtime_feature_flags",
  "release_readiness",
];
const DEFAULT_REQUIRED_NON_EMPTY_TABLES = ["articles", "rss_feeds"];
const RESTORE_TABLE_ORDER = [
  "rss_feeds",
  "articles",
  "article_ai_reviews",
  "article_summaries",
  "feed_health",
  "worker_runs",
  "ai_usage_runs",
  "quota_usage_events",
  "runtime_feature_flags",
  "release_readiness",
];
const DEFAULT_NEXT_STEPS = [
  "Open the Supabase Backup workflow run and inspect the restore fire drill step logs.",
  "Confirm the backup manifest is from the latest production backup run and every listed artifact exists.",
  "Run the command again against a disposable local Supabase database after fixing the backup or schema issue.",
  "Do not use the backup for production recovery until the restore fire drill passes.",
];

export class RestoreFireDrillError extends Error {
  constructor(message, nextSteps = DEFAULT_NEXT_STEPS) {
    super(message);
    this.name = "RestoreFireDrillError";
    this.nextSteps = nextSteps;
  }
}

function parseCsv(value, fallback) {
  const parsed = String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
}

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    backupDir: env.RESTORE_BACKUP_DIR || DEFAULT_BACKUP_DIR,
    reportDir: env.RESTORE_REPORT_DIR || DEFAULT_REPORT_DIR,
    databaseUrl: env.RESTORE_DATABASE_URL || "",
    maxAgeHours: Number(env.RESTORE_MAX_BACKUP_AGE_HOURS || DEFAULT_MAX_BACKUP_AGE_HOURS),
    expectedTables: parseCsv(env.RESTORE_EXPECTED_TABLES, DEFAULT_EXPECTED_TABLES),
    requiredNonEmptyTables: parseCsv(
      env.RESTORE_REQUIRED_NON_EMPTY_TABLES,
      DEFAULT_REQUIRED_NON_EMPTY_TABLES,
    ),
    localSupabase: false,
    skipDatabaseRestore: false,
    allowRemoteDatabase: env.NUTSNEWS_RESTORE_FIRE_DRILL_ALLOW_REMOTE === "true",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = () => {
      index += 1;
      if (index >= argv.length) throw new RestoreFireDrillError(`${arg} requires a value.`);
      return argv[index];
    };

    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--backup-dir") options.backupDir = nextValue();
    else if (arg.startsWith("--backup-dir=")) options.backupDir = arg.slice("--backup-dir=".length);
    else if (arg === "--report-dir") options.reportDir = nextValue();
    else if (arg.startsWith("--report-dir=")) options.reportDir = arg.slice("--report-dir=".length);
    else if (arg === "--database-url") options.databaseUrl = nextValue();
    else if (arg.startsWith("--database-url=")) options.databaseUrl = arg.slice("--database-url=".length);
    else if (arg === "--max-age-hours") options.maxAgeHours = Number(nextValue());
    else if (arg.startsWith("--max-age-hours=")) options.maxAgeHours = Number(arg.slice("--max-age-hours=".length));
    else if (arg === "--expected-tables") options.expectedTables = parseCsv(nextValue(), DEFAULT_EXPECTED_TABLES);
    else if (arg.startsWith("--expected-tables=")) options.expectedTables = parseCsv(arg.slice("--expected-tables=".length), DEFAULT_EXPECTED_TABLES);
    else if (arg === "--required-non-empty-tables") options.requiredNonEmptyTables = parseCsv(nextValue(), DEFAULT_REQUIRED_NON_EMPTY_TABLES);
    else if (arg.startsWith("--required-non-empty-tables=")) options.requiredNonEmptyTables = parseCsv(arg.slice("--required-non-empty-tables=".length), DEFAULT_REQUIRED_NON_EMPTY_TABLES);
    else if (arg === "--local-supabase") options.localSupabase = true;
    else if (arg === "--skip-database-restore") options.skipDatabaseRestore = true;
    else if (arg === "--allow-remote-database") options.allowRemoteDatabase = true;
    else throw new RestoreFireDrillError(`Unknown option: ${arg}`);
  }

  if (!Number.isFinite(options.maxAgeHours) || options.maxAgeHours <= 0) {
    throw new RestoreFireDrillError("Restore fire drill max backup age must be a positive number of hours.");
  }

  options.backupDir = resolve(options.backupDir);
  options.reportDir = resolve(options.reportDir);
  return options;
}

function usage() {
  return `Usage:
  node scripts/supabase_restore_fire_drill.mjs --backup-dir backups/supabase --local-supabase
  RESTORE_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" node scripts/supabase_restore_fire_drill.mjs --backup-dir backups/supabase

This command validates the latest Supabase REST backup manifest, restores exported rows into a disposable database, runs supabase/restore_validation.sql, and writes reports/supabase-restore/latest.md.
`;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function assertSafeTableName(table) {
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
    throw new RestoreFireDrillError(`Unsafe backup table name in manifest: ${table}`);
  }
}

function quoteIdent(identifier) {
  assertSafeTableName(identifier);
  return `"${identifier.replaceAll('"', '""')}"`;
}

function parseDate(value, label) {
  const parsed = Date.parse(String(value ?? ""));
  if (!Number.isFinite(parsed)) {
    throw new RestoreFireDrillError(`${label} is missing or invalid.`);
  }
  return parsed;
}

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new RestoreFireDrillError(`Could not read JSON ${path}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

function findLatestManifest(backupDir) {
  if (!existsSync(backupDir)) {
    throw new RestoreFireDrillError(`Backup directory does not exist: ${backupDir}`);
  }

  const manifestPaths = readdirSync(backupDir)
    .filter((name) => name.endsWith("-manifest.json"))
    .map((name) => join(backupDir, name));

  if (manifestPaths.length === 0) {
    throw new RestoreFireDrillError(`No Supabase backup manifest found in ${backupDir}.`);
  }

  return manifestPaths
    .map((manifestPath) => {
      const manifest = loadJson(manifestPath);
      return {
        manifestPath,
        manifest,
        createdAtMs: parseDate(manifest.createdAt, `Manifest ${manifestPath} createdAt`),
      };
    })
    .sort((a, b) => b.createdAtMs - a.createdAtMs)[0];
}

function readArtifactRows({ backupDir, entry }) {
  const table = String(entry.table ?? "");
  assertSafeTableName(table);
  const file = String(entry.file ?? "");
  if (!file || file !== file.split(/[\\/]/).pop()) {
    throw new RestoreFireDrillError(`Backup manifest entry for ${table} must reference a basename artifact file.`);
  }

  const artifactPath = join(backupDir, file);
  if (!existsSync(artifactPath)) {
    throw new RestoreFireDrillError(`Backup artifact missing for ${table}: ${artifactPath}`);
  }

  const compressed = readFileSync(artifactPath);
  if (compressed.byteLength === 0) {
    throw new RestoreFireDrillError(`Backup artifact is empty for ${table}: ${artifactPath}`);
  }

  const artifactSha = sha256(compressed);
  if (entry.sha256 && entry.sha256 !== artifactSha) {
    throw new RestoreFireDrillError(`Backup artifact checksum mismatch for ${table}.`);
  }

  let jsonBuffer;
  try {
    jsonBuffer = file.endsWith(".gz") ? gunzipSync(compressed) : compressed;
  } catch (error) {
    throw new RestoreFireDrillError(`Backup artifact is not readable gzip for ${table}: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  let rows;
  try {
    rows = JSON.parse(jsonBuffer.toString("utf8"));
  } catch (error) {
    throw new RestoreFireDrillError(`Backup artifact is not valid JSON for ${table}: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  if (!Array.isArray(rows)) {
    throw new RestoreFireDrillError(`Backup artifact for ${table} must be a JSON array.`);
  }

  if (Number(entry.rowCount) !== rows.length) {
    throw new RestoreFireDrillError(`Backup manifest row count for ${table} does not match the artifact.`);
  }

  return {
    table,
    rows,
    rowCount: rows.length,
    file,
    artifactPath,
    byteSize: jsonBuffer.byteLength,
    gzipByteSize: compressed.byteLength,
    sha256: artifactSha,
    contentRange: String(entry.contentRange ?? ""),
  };
}

export function validateBackupArtifacts({
  backupDir = DEFAULT_BACKUP_DIR,
  now = Date.now(),
  maxAgeHours = DEFAULT_MAX_BACKUP_AGE_HOURS,
  expectedTables = DEFAULT_EXPECTED_TABLES,
  requiredNonEmptyTables = DEFAULT_REQUIRED_NON_EMPTY_TABLES,
} = {}) {
  const latest = findLatestManifest(backupDir);
  const ageMs = now - latest.createdAtMs;
  if (ageMs < -5 * 60 * 1000) {
    throw new RestoreFireDrillError("The latest backup manifest is timestamped in the future.");
  }
  if (ageMs > maxAgeHours * 60 * 60 * 1000) {
    throw new RestoreFireDrillError(
      `The latest backup manifest is older than ${maxAgeHours} hours.`,
    );
  }

  if (!Array.isArray(latest.manifest.tables) || latest.manifest.tables.length === 0) {
    throw new RestoreFireDrillError("Backup manifest does not list any exported tables.");
  }

  const failed = latest.manifest.tables.filter((entry) => entry?.error);
  if (failed.length > 0) {
    throw new RestoreFireDrillError(
      `Backup manifest includes failed table exports: ${failed.map((entry) => entry.table).join(", ")}`,
    );
  }

  const tables = latest.manifest.tables.map((entry) =>
    readArtifactRows({ backupDir, entry }),
  );
  const byTable = new Map(tables.map((table) => [table.table, table]));
  const missing = expectedTables.filter((table) => !byTable.has(table));
  if (missing.length > 0) {
    throw new RestoreFireDrillError(`Backup manifest is missing expected tables: ${missing.join(", ")}`);
  }

  const emptyRequired = requiredNonEmptyTables.filter(
    (table) => (byTable.get(table)?.rowCount ?? 0) === 0,
  );
  if (emptyRequired.length > 0) {
    throw new RestoreFireDrillError(`Backup required non-empty table check failed: ${emptyRequired.join(", ")}`);
  }

  return {
    manifestPath: latest.manifestPath,
    manifest: latest.manifest,
    createdAt: new Date(latest.createdAtMs).toISOString(),
    ageHours: Math.round((ageMs / 60 / 60 / 1000) * 10) / 10,
    tables,
  };
}

function databaseHostname(databaseUrl) {
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    throw new RestoreFireDrillError("RESTORE_DATABASE_URL is not a valid PostgreSQL URL.");
  }
}

function isLocalDatabaseUrl(databaseUrl) {
  const hostname = databaseHostname(databaseUrl);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function redact(value, databaseUrl) {
  let redacted = String(value ?? "");
  if (databaseUrl) {
    redacted = redacted.replaceAll(databaseUrl, "[hidden database url]");
    try {
      const parsed = new URL(databaseUrl);
      if (parsed.password) {
        redacted = redacted.replaceAll(parsed.password, "[hidden password]");
      }
      if (parsed.username) {
        redacted = redacted.replaceAll(parsed.username, "[hidden user]");
      }
    } catch {
      // Ignore malformed values here; validation reports those separately.
    }
  }
  return redacted;
}

function runPsql({ databaseUrl, input, args = [] }) {
  const result = spawnSync(
    "psql",
    ["--no-psqlrc", "--set", "ON_ERROR_STOP=1", databaseUrl, ...args],
    {
      input,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new RestoreFireDrillError("psql is required for the restore fire drill but was not found in PATH.");
    }
    throw new RestoreFireDrillError(`psql failed to start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = redact(result.stderr, databaseUrl).trim();
    throw new RestoreFireDrillError(
      `psql restore fire drill command failed.${stderr ? ` ${stderr.split(/\r?\n/).slice(-6).join(" ")}` : ""}`,
    );
  }

  return {
    stdout: redact(result.stdout, databaseUrl),
    stderr: redact(result.stderr, databaseUrl),
  };
}

function runPsqlSqlFile({ databaseUrl, sql }) {
  const dir = mkdtempSync(join(tmpdir(), "nutsnews-restore-sql-"));
  const sqlPath = join(dir, "restore.sql");

  try {
    writeFileSync(sqlPath, sql, { encoding: "utf8", mode: 0o600 });
    return runPsql({ databaseUrl, input: "", args: ["--file", sqlPath] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function dollarQuote(value, baseTag) {
  let suffix = 0;
  let tag = `$${baseTag}$`;
  while (value.includes(tag)) {
    suffix += 1;
    tag = `$${baseTag}_${suffix}$`;
  }
  return `${tag}${value}${tag}`;
}

function sortRestoreTables(tables) {
  const order = new Map(RESTORE_TABLE_ORDER.map((table, index) => [table, index]));
  return [...tables].sort((a, b) => {
    const aOrder = order.get(a.table) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = order.get(b.table) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.table.localeCompare(b.table);
  });
}

export function buildRestoreSql(tables) {
  const ordered = sortRestoreTables(tables);
  const tableRefs = ordered.map((entry) => `public.${quoteIdent(entry.table)}`).join(", ");
  const statements = [
    "begin;",
    "set local statement_timeout = '120s';",
    `truncate table ${tableRefs} restart identity cascade;`,
  ];

  for (const entry of ordered) {
    if (entry.rows.length === 0) continue;
    const json = JSON.stringify(entry.rows);
    const tableRef = `public.${quoteIdent(entry.table)}`;
    const relationLiteral = dollarQuote(`public.${entry.table}`, `nutsnews_restore_${entry.table}_relation`);
    const rowsLiteral = dollarQuote(json, `nutsnews_restore_${entry.table}_rows`);
    statements.push(
      `do ${dollarQuote(
        `
declare
  insert_columns text;
  select_columns text;
begin
  select
    string_agg(quote_ident(attname), ', ' order by attnum),
    string_agg('restore_rows.' || quote_ident(attname), ', ' order by attnum)
  into insert_columns, select_columns
  from pg_attribute
  where attrelid = ${relationLiteral}::regclass
    and attnum > 0
    and not attisdropped
    and attgenerated = '';

  if insert_columns is null then
    raise exception 'No insertable columns found for %', ${relationLiteral};
  end if;

  execute format(
    'insert into ${tableRef} (%s) select %s from jsonb_populate_recordset(null::${tableRef}, %L::jsonb) as restore_rows',
    insert_columns,
    select_columns,
    ${rowsLiteral}
  );
end;
`,
        `nutsnews_restore_${entry.table}_block`,
      )};`,
    );
  }

  statements.push("commit;");
  return `${statements.join("\n\n")}\n`;
}

function ensureDisposableDatabase(databaseUrl, allowRemoteDatabase) {
  if (!databaseUrl) {
    throw new RestoreFireDrillError(
      "RESTORE_DATABASE_URL is required unless --local-supabase is used.",
      [
        "Start local Supabase and rerun with --local-supabase.",
        "Or set RESTORE_DATABASE_URL to a disposable localhost PostgreSQL/Supabase database.",
        ...DEFAULT_NEXT_STEPS.slice(2),
      ],
    );
  }

  if (!allowRemoteDatabase && !isLocalDatabaseUrl(databaseUrl)) {
    throw new RestoreFireDrillError(
      "Refusing to run a restore fire drill against a non-local database URL.",
      [
        "Use a disposable local Supabase database for routine restore validation.",
        "If this is an intentionally isolated remote restore target, set NUTSNEWS_RESTORE_FIRE_DRILL_ALLOW_REMOTE=true.",
        ...DEFAULT_NEXT_STEPS.slice(2),
      ],
    );
  }
}

function validationSqlPath() {
  const path = join(repoRoot, "supabase", "restore_validation.sql");
  if (!existsSync(path)) {
    throw new RestoreFireDrillError(`Missing restore validation SQL: ${path}`);
  }
  return path;
}

function runRestoreValidationSql(databaseUrl) {
  const path = validationSqlPath();
  return runPsql({ databaseUrl, input: "", args: ["--file", path] });
}

function tableSummaries(tables) {
  return tables.map((entry) => ({
    table: entry.table,
    rowCount: entry.rowCount,
    file: entry.file,
    byteSize: entry.byteSize,
    gzipByteSize: entry.gzipByteSize,
    sha256: entry.sha256,
    contentRange: entry.contentRange,
  }));
}

function markdownReport(report) {
  const rows = report.tables
    .map((entry) => `| ${entry.table} | ${entry.rowCount} | ${entry.file} | ${entry.gzipByteSize} |`)
    .join("\n");
  const nextSteps = report.nextSteps.map((step) => `- ${step}`).join("\n");

  return `# NutsNews Supabase Restore Fire Drill

Status: ${report.status}

Generated: ${report.completedAt}

Backup manifest: ${report.manifestPath ?? "not available"}

Backup created: ${report.backupCreatedAt ?? "not available"}

Backup age hours: ${report.backupAgeHours ?? "not available"}

Database restore: ${report.databaseRestore}

Validation SQL: ${report.validationSql}

${report.errorMessage ? `Failure: ${report.errorMessage}\n\n` : ""}## Table Artifacts

| Table | Rows | Artifact | Gzip bytes |
| --- | ---: | --- | ---: |
${rows || "| n/a | 0 | n/a | 0 |"}

## Next Steps

${nextSteps}
`;
}

function writeReports(report, reportDir) {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(join(reportDir, "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(reportDir, "latest.md"), markdownReport(report));
}

function resolveDatabaseUrl(options) {
  if (options.databaseUrl) return options.databaseUrl;
  if (!options.localSupabase) return "";
  return getLocalSupabaseStatus().databaseUrl;
}

export async function runRestoreFireDrill(options = {}) {
  const startedAt = new Date().toISOString();
  const validation = validateBackupArtifacts({
    backupDir: options.backupDir,
    maxAgeHours: options.maxAgeHours,
    expectedTables: options.expectedTables,
    requiredNonEmptyTables: options.requiredNonEmptyTables,
  });
  const databaseUrl = resolveDatabaseUrl(options);
  const validationSql = "supabase/restore_validation.sql";
  let databaseRestore = "skipped";
  let validationOutput = "";

  if (!options.skipDatabaseRestore) {
    ensureDisposableDatabase(databaseUrl, options.allowRemoteDatabase);
    const restoreSql = buildRestoreSql(validation.tables);
    runPsqlSqlFile({ databaseUrl, sql: restoreSql });
    databaseRestore = "restored exported rows into disposable database";
    validationOutput = runRestoreValidationSql(databaseUrl).stdout;
  }

  return {
    status: "success",
    startedAt,
    completedAt: new Date().toISOString(),
    manifestPath: validation.manifestPath,
    backupCreatedAt: validation.createdAt,
    backupAgeHours: validation.ageHours,
    databaseRestore,
    validationSql,
    validationOutputTail: validationOutput.split(/\r?\n/).slice(-20).join("\n"),
    tables: tableSummaries(validation.tables),
    nextSteps: [
      "Use the latest successful Supabase Backup workflow run as the visible restore-check record.",
      "Keep production restore work gated on a successful disposable restore fire drill.",
    ],
  };
}

function failureReport({ error, options, startedAt }) {
  const message = error instanceof Error ? error.message : "Unknown restore fire drill failure.";
  return {
    status: "failure",
    startedAt,
    completedAt: new Date().toISOString(),
    manifestPath: null,
    backupCreatedAt: null,
    backupAgeHours: null,
    databaseRestore: "failed",
    validationSql: "supabase/restore_validation.sql",
    errorMessage: message,
    tables: [],
    nextSteps: error instanceof RestoreFireDrillError ? error.nextSteps : DEFAULT_NEXT_STEPS,
    reportDir: options.reportDir,
  };
}

async function main() {
  let options;
  const startedAt = new Date().toISOString();
  try {
    options = parseArgs();
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    const report = await runRestoreFireDrill(options);
    writeReports(report, options.reportDir);
    console.log(`Supabase restore fire drill passed. Report: ${join(options.reportDir, "latest.md")}`);
  } catch (error) {
    options ??= {
      reportDir: DEFAULT_REPORT_DIR,
    };
    const report = failureReport({ error, options, startedAt });
    writeReports(report, options.reportDir);
    console.error(`Supabase restore fire drill failed: ${report.errorMessage}`);
    for (const step of report.nextSteps) {
      console.error(`- ${step}`);
    }
    process.exitCode = 1;
  }
}

const invokedDirectly = process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;
if (invokedDirectly) {
  main();
}
