#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { getMigrationContract, listMigrations } from "./migration_contract.mjs";

export const STANDBY_MANIFEST_PATH = "supabase/standby_manifest.json";
export const STANDBY_MANIFEST_VERSION = 1;
export const STANDBY_POLICY = "backend-postgres-primary-to-existing-production-supabase-standby";
export const STANDBY_TARGET = "existing-production-supabase";
export const PRIMARY_DATABASE = "backend-postgres-primary-read-write";
export const REQUIRED_FAILOVER_GATES = Object.freeze([
  "standby-manifest-present",
  "protected-standby-env-ready",
  "lag-seconds-lte-30",
  "table-parity-match",
  "schema-fingerprint-match",
  "sequence-safety-verified",
  "primary-writers-paused",
  "split-brain-absence-verified",
]);

const RELATION_NAME_PATTERN = String.raw`(?:"?[a-z_][a-z0-9_]*"?\.)?"?[a-z_][a-z0-9_]*"?`;
const IDENTIFIER_PATTERN = String.raw`"?[a-z_][a-z0-9_]*"?`;

export class SupabaseStandbyManifestError extends Error {}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeIdentifier(identifier) {
  return identifier.replace(/^"|"$/g, "").toLowerCase();
}

export function normalizeRelationName(relationName) {
  const parts = relationName.split(".").map((part) => normalizeIdentifier(part.trim()));
  if (parts.length === 1) return `public.${parts[0]}`;
  if (parts.length === 2) return `${parts[0]}.${parts[1]}`;
  throw new SupabaseStandbyManifestError(`Invalid relation name: ${relationName}`);
}

function unqualifiedRelationName(relationName) {
  return normalizeRelationName(relationName).split(".")[1];
}

function sequenceNameForColumn(tableName, columnName) {
  return `public.${unqualifiedRelationName(tableName)}_${columnName}_seq`;
}

function makeTable(name, sourceMigration) {
  return {
    name,
    sourceMigration,
    primaryKey: [],
    replicaIdentity: null,
    sequenceBackedColumns: [],
  };
}

function tableState(state, name, sourceMigration) {
  const normalized = normalizeRelationName(name);
  if (!state.tables.has(normalized)) {
    state.tables.set(normalized, makeTable(normalized, sourceMigration));
  }
  return state.tables.get(normalized);
}

function relationState(state, name, kind, sourceMigration) {
  const normalized = normalizeRelationName(name);
  state.views.set(normalized, { name: normalized, kind, sourceMigration });
}

function setPrimaryKey(table, columns) {
  table.primaryKey = columns.map((column) => normalizeIdentifier(column.trim())).filter(Boolean);
}

function addSequence(state, table, column) {
  const normalizedColumn = normalizeIdentifier(column);
  const name = sequenceNameForColumn(table.name, normalizedColumn);
  if (!table.sequenceBackedColumns.includes(normalizedColumn)) {
    table.sequenceBackedColumns.push(normalizedColumn);
    table.sequenceBackedColumns.sort();
  }
  state.sequences.set(name, {
    name,
    table: table.name,
    column: normalizedColumn,
  });
}

function removeColumn(state, table, column) {
  const normalizedColumn = normalizeIdentifier(column);
  table.primaryKey = table.primaryKey.filter((primaryKeyColumn) => primaryKeyColumn !== normalizedColumn);
  table.sequenceBackedColumns = table.sequenceBackedColumns.filter((sequenceColumn) => sequenceColumn !== normalizedColumn);
  for (const [sequenceName, sequence] of state.sequences.entries()) {
    if (sequence.table === table.name && sequence.column === normalizedColumn) {
      state.sequences.delete(sequenceName);
    }
  }
}

function scanBalanced(text, startIndex, openCharacter, closeCharacter) {
  let depth = 0;
  let quote = null;
  let dollarQuote = null;

  for (let index = startIndex; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1] ?? "";

    if (dollarQuote) {
      if (text.startsWith(dollarQuote, index)) {
        index += dollarQuote.length - 1;
        dollarQuote = null;
      }
      continue;
    }

    if (quote) {
      if (current === quote) {
        if (quote === "'" && next === "'") {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (current === "-" && next === "-") {
      const lineEnd = text.indexOf("\n", index + 2);
      index = lineEnd === -1 ? text.length : lineEnd;
      continue;
    }

    if (current === "/" && next === "*") {
      const commentEnd = text.indexOf("*/", index + 2);
      index = commentEnd === -1 ? text.length : commentEnd + 1;
      continue;
    }

    if (current === "'" || current === '"') {
      quote = current;
      continue;
    }

    if (current === "$") {
      const match = text.slice(index).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollarQuote = match[0];
        index += dollarQuote.length - 1;
        continue;
      }
    }

    if (current === openCharacter) {
      depth += 1;
    } else if (current === closeCharacter) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  throw new SupabaseStandbyManifestError(`Unbalanced SQL block starting at offset ${startIndex}.`);
}

function splitTopLevelComma(text) {
  const entries = [];
  let start = 0;
  let depth = 0;
  let quote = null;

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1] ?? "";

    if (quote) {
      if (current === quote) {
        if (quote === "'" && next === "'") {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (current === "'" || current === '"') {
      quote = current;
      continue;
    }

    if (current === "(") depth += 1;
    if (current === ")") depth -= 1;
    if (current === "," && depth === 0) {
      entries.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }

  entries.push(text.slice(start).trim());
  return entries.filter(Boolean);
}

function columnNameFromEntry(entry) {
  const match = entry.trim().match(new RegExp(`^(${IDENTIFIER_PATTERN})\\b`, "i"));
  return match ? normalizeIdentifier(match[1]) : null;
}

function parsePrimaryKeyColumns(entry) {
  const match = entry.match(/\bprimary\s+key\s*\(([^)]+)\)/i);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((column) => normalizeIdentifier(column.trim()))
    .filter(Boolean);
}

function applyCreateTable(state, source, sourceMigration) {
  const pattern = new RegExp(`\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(${RELATION_NAME_PATTERN})`, "gi");

  for (const match of source.matchAll(pattern)) {
    const table = tableState(state, match[1], sourceMigration);
    const openIndex = source.indexOf("(", match.index + match[0].length);
    if (openIndex === -1) {
      throw new SupabaseStandbyManifestError(`CREATE TABLE ${table.name} is missing a column list.`);
    }
    const closeIndex = scanBalanced(source, openIndex, "(", ")");
    const body = source.slice(openIndex + 1, closeIndex);

    for (const entry of splitTopLevelComma(body)) {
      const primaryKeyColumns = parsePrimaryKeyColumns(entry);
      if (primaryKeyColumns.length > 0) {
        setPrimaryKey(table, primaryKeyColumns);
        continue;
      }

      const columnName = columnNameFromEntry(entry);
      if (!columnName) continue;

      if (/\bprimary\s+key\b/i.test(entry)) {
        setPrimaryKey(table, [columnName]);
      }

      if (/\b(?:bigserial|serial|smallserial)\b/i.test(entry)) {
        addSequence(state, table, columnName);
      }
    }
  }
}

function applyCreateViews(state, source, sourceMigration) {
  const pattern = new RegExp(
    `\\bcreate\\s+(?:or\\s+replace\\s+)?(?:(materialized)\\s+)?view\\s+(?:if\\s+not\\s+exists\\s+)?(${RELATION_NAME_PATTERN})`,
    "gi",
  );

  for (const match of source.matchAll(pattern)) {
    relationState(state, match[2], match[1] ? "materialized_view" : "view", sourceMigration);
  }
}

function applyCreateSequences(state, source) {
  const pattern = new RegExp(`\\bcreate\\s+sequence\\s+(?:if\\s+not\\s+exists\\s+)?(${RELATION_NAME_PATTERN})`, "gi");
  for (const match of source.matchAll(pattern)) {
    const name = normalizeRelationName(match[1]);
    if (!state.sequences.has(name)) {
      state.sequences.set(name, { name, table: null, column: null });
    }
  }
}

function applyAlterTableReplicaIdentity(state, source, sourceMigration) {
  const pattern = new RegExp(
    `\\balter\\s+table\\s+(?:if\\s+exists\\s+)?(${RELATION_NAME_PATTERN})\\s+replica\\s+identity\\s+(full|nothing|default|using\\s+index\\s+${IDENTIFIER_PATTERN})`,
    "gi",
  );

  for (const match of source.matchAll(pattern)) {
    const table = tableState(state, match[1], sourceMigration);
    const value = match[2].toLowerCase();
    if (value === "full") table.replicaIdentity = { type: "full" };
    if (value === "nothing") table.replicaIdentity = { type: "nothing" };
    if (value === "default") table.replicaIdentity = { type: "default" };
    if (value.startsWith("using index")) {
      table.replicaIdentity = { type: "index", index: normalizeIdentifier(value.replace(/^using\s+index\s+/i, "")) };
    }
  }
}

function applyAlterTableDropColumn(state, source, sourceMigration) {
  const pattern = new RegExp(
    `\\balter\\s+table\\s+(?:if\\s+exists\\s+)?(${RELATION_NAME_PATTERN})[\\s\\S]*?\\bdrop\\s+column\\s+(?:if\\s+exists\\s+)?(${IDENTIFIER_PATTERN})\\b`,
    "gi",
  );

  for (const match of source.matchAll(pattern)) {
    const table = tableState(state, match[1], sourceMigration);
    removeColumn(state, table, match[2]);
  }
}

function applyAlterTableDropPrimaryKey(state, source, sourceMigration) {
  const pattern = new RegExp(
    `\\balter\\s+table\\s+(?:if\\s+exists\\s+)?(${RELATION_NAME_PATTERN})[\\s\\S]*?\\bdrop\\s+constraint\\s+(?:if\\s+exists\\s+)?${IDENTIFIER_PATTERN}_pkey\\b`,
    "gi",
  );

  for (const match of source.matchAll(pattern)) {
    const table = tableState(state, match[1], sourceMigration);
    table.primaryKey = [];
  }
}

function applyAlterTableAddPrimaryColumn(state, source, sourceMigration) {
  const pattern = new RegExp(
    `\\balter\\s+table\\s+(?:if\\s+exists\\s+)?(${RELATION_NAME_PATTERN})[\\s\\S]*?\\badd\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?(${IDENTIFIER_PATTERN})\\b([^;]*?\\bprimary\\s+key\\b[^;]*?);`,
    "gi",
  );

  for (const match of source.matchAll(pattern)) {
    const table = tableState(state, match[1], sourceMigration);
    const column = normalizeIdentifier(match[2]);
    setPrimaryKey(table, [column]);
    if (/\b(?:bigserial|serial|smallserial)\b/i.test(match[3])) {
      addSequence(state, table, column);
    }
  }
}

export async function deriveStandbySchema(root = resolve(import.meta.dirname, "..")) {
  const migrations = await listMigrations(root);
  const state = {
    tables: new Map(),
    views: new Map(),
    sequences: new Map(),
  };

  for (const migration of migrations) {
    const source = await readFile(migration.path, "utf8");
    applyCreateTable(state, source, migration.filename);
    applyCreateViews(state, source, migration.filename);
    applyCreateSequences(state, source);
    applyAlterTableReplicaIdentity(state, source, migration.filename);
    applyAlterTableDropPrimaryKey(state, source, migration.filename);
    applyAlterTableDropColumn(state, source, migration.filename);
    applyAlterTableAddPrimaryColumn(state, source, migration.filename);
  }

  return Object.freeze({
    tables: Object.freeze([...state.tables.values()].sort((left, right) => left.name.localeCompare(right.name))),
    views: Object.freeze([...state.views.values()].sort((left, right) => left.name.localeCompare(right.name))),
    sequences: Object.freeze([...state.sequences.values()].sort((left, right) => left.name.localeCompare(right.name))),
  });
}

function hasSafeReplicaIdentity(table) {
  if (table.primaryKey.length > 0) return true;
  return table.replicaIdentity?.type === "full" || table.replicaIdentity?.type === "index";
}

function replicaIdentityForTable(table) {
  if (table.primaryKey.length > 0) {
    return Object.freeze({ type: "primary_key", columns: table.primaryKey });
  }
  if (table.replicaIdentity?.type === "full") return Object.freeze({ type: "full" });
  if (table.replicaIdentity?.type === "index") {
    return Object.freeze({ type: "index", index: table.replicaIdentity.index });
  }
  return Object.freeze({ type: "missing" });
}

function assertDerivedSchemaIsReplicable(schema) {
  for (const table of schema.tables) {
    if (!hasSafeReplicaIdentity(table)) {
      throw new SupabaseStandbyManifestError(
        `Replicated table ${table.name} lacks a primary key or explicit replica identity for update/delete replication.`,
      );
    }
  }

  for (const sequence of schema.sequences) {
    if (!sequence.table || !sequence.column) {
      throw new SupabaseStandbyManifestError(`Sequence ${sequence.name} is not tied to a sequence-backed table column.`);
    }
  }
}

function tableManifestEntry(table) {
  return {
    name: table.name,
    primaryKey: table.primaryKey,
    replicaIdentity: replicaIdentityForTable(table),
    rowReplication: true,
    sourceMigration: table.sourceMigration,
    validation: [
      "schema-fingerprint",
      "table-row-count-parity",
      "primary-key-sample-parity",
    ],
  };
}

function viewManifestEntry(view) {
  return {
    name: view.name,
    kind: view.kind,
    rowReplication: false,
    sourceMigration: view.sourceMigration,
    validation: [
      "schema-fingerprint",
      "derived-query-parity",
    ],
  };
}

function sequenceManifestEntry(sequence) {
  return {
    name: sequence.name,
    table: sequence.table,
    column: sequence.column,
    validation: [
      "source-last-value-present",
      "target-last-value-gte-source-last-value",
      "target-next-value-gt-target-max-id",
    ],
  };
}

function manifestWithoutFingerprint(manifest) {
  const copy = cloneJson(manifest);
  delete copy.schemaFingerprint;
  return copy;
}

export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function schemaFingerprintForManifest(manifest) {
  return createHash("sha256").update(canonicalJson(manifestWithoutFingerprint(manifest))).digest("hex");
}

export async function buildExpectedStandbyManifest(root = resolve(import.meta.dirname, "..")) {
  const [migrationContract, schema] = await Promise.all([
    getMigrationContract(root),
    deriveStandbySchema(root),
  ]);

  assertDerivedSchemaIsReplicable(schema);

  const manifest = {
    manifestVersion: STANDBY_MANIFEST_VERSION,
    policy: STANDBY_POLICY,
    issueLinks: [
      "https://github.com/ramideltoro/nutsnews/issues/223",
      "https://github.com/ramideltoro/nutsnews/issues/497",
    ],
    source: {
      migrationContract: "supabase/migrations",
      migrationHead: migrationContract.head,
      migrationSourceFingerprint: migrationContract.sourceFingerprint,
      migrationCount: migrationContract.migrations.length,
    },
    safety: {
      primaryDatabase: PRIMARY_DATABASE,
      standbyTarget: STANDBY_TARGET,
      existingProductionSupabaseProject: true,
      createNewSupabaseProject: false,
      createNutsnewsStandbyDatabase: false,
      appWorkerSupabaseWritesBeforeApprovedFailover: false,
      destructiveSupabaseRetirementBlockedUntilManifestExists: true,
      safeMetadataOnly: true,
      failoverRequiresAllGates: REQUIRED_FAILOVER_GATES,
    },
    replication: {
      source: "backend-postgres",
      target: STANDBY_TARGET,
      direction: "backend-postgres-to-existing-production-supabase",
      publicationPolicy: {
        rowReplicationContains: "base-tables-only",
        excludedRelationKinds: [
          "view",
          "materialized_view",
        ],
        viewValidation: "schema-and-derived-query-parity-only",
      },
      tables: schema.tables.map(tableManifestEntry),
      excludedViews: schema.views.map(viewManifestEntry),
    },
    sequences: {
      policy:
        "Before approved failover, every target sequence must be advanced beyond both the source last_value and the target table max(id); fail closed on missing, stale, or unvalidated sequence state.",
      items: schema.sequences.map(sequenceManifestEntry),
    },
  };

  return Object.freeze({
    ...manifest,
    schemaFingerprint: schemaFingerprintForManifest(manifest),
  });
}

export async function loadStandbyManifest(root = resolve(import.meta.dirname, "..")) {
  const path = resolve(root, STANDBY_MANIFEST_PATH);
  return JSON.parse(await readFile(path, "utf8"));
}

function assertArrayEqual(actual, expected, label) {
  const actualJson = canonicalJson(actual);
  const expectedJson = canonicalJson(expected);
  if (actualJson !== expectedJson) {
    throw new SupabaseStandbyManifestError(`${label} does not match the current Supabase migration contract.`);
  }
}

function assertManifestSafety(manifest) {
  if (manifest.manifestVersion !== STANDBY_MANIFEST_VERSION) {
    throw new SupabaseStandbyManifestError(`Standby manifest version must be ${STANDBY_MANIFEST_VERSION}.`);
  }
  if (manifest.policy !== STANDBY_POLICY) {
    throw new SupabaseStandbyManifestError(`Standby manifest policy must be ${STANDBY_POLICY}.`);
  }
  if (manifest.safety?.primaryDatabase !== PRIMARY_DATABASE) {
    throw new SupabaseStandbyManifestError(`Standby manifest primary database must be ${PRIMARY_DATABASE}.`);
  }
  if (manifest.safety?.standbyTarget !== STANDBY_TARGET || manifest.replication?.target !== STANDBY_TARGET) {
    throw new SupabaseStandbyManifestError(`Standby manifest target must be ${STANDBY_TARGET}.`);
  }
  if (manifest.safety?.existingProductionSupabaseProject !== true) {
    throw new SupabaseStandbyManifestError("Standby manifest must target the existing production Supabase project.");
  }
  if (manifest.safety?.createNewSupabaseProject !== false || manifest.safety?.createNutsnewsStandbyDatabase !== false) {
    throw new SupabaseStandbyManifestError("Standby manifest must not create a new Supabase project or nutsnews-standby database.");
  }
  if (manifest.safety?.appWorkerSupabaseWritesBeforeApprovedFailover !== false) {
    throw new SupabaseStandbyManifestError("Standby manifest must keep app and worker writes to Supabase disabled before approved failover.");
  }
  if (manifest.safety?.destructiveSupabaseRetirementBlockedUntilManifestExists !== true) {
    throw new SupabaseStandbyManifestError("Standby manifest must block destructive Supabase retirement work until this manifest exists.");
  }
  assertArrayEqual(manifest.safety?.failoverRequiresAllGates ?? [], REQUIRED_FAILOVER_GATES, "Failover gate list");
}

function assertManifestRelations(manifest) {
  const tables = manifest.replication?.tables;
  const views = manifest.replication?.excludedViews;
  const sequences = manifest.sequences?.items;

  if (!Array.isArray(tables) || tables.length === 0) {
    throw new SupabaseStandbyManifestError("Standby manifest must list replicated tables.");
  }
  if (!Array.isArray(views)) {
    throw new SupabaseStandbyManifestError("Standby manifest must list excluded views.");
  }
  if (!Array.isArray(sequences)) {
    throw new SupabaseStandbyManifestError("Standby manifest must list sequence-backed tables.");
  }

  const tableNames = new Set();
  for (const table of tables) {
    if (tableNames.has(table.name)) {
      throw new SupabaseStandbyManifestError(`Duplicate replicated table in standby manifest: ${table.name}`);
    }
    tableNames.add(table.name);
    if (table.rowReplication !== true) {
      throw new SupabaseStandbyManifestError(`Replicated table ${table.name} must have rowReplication=true.`);
    }
    const identityType = table.replicaIdentity?.type;
    const primaryKey = Array.isArray(table.primaryKey) ? table.primaryKey : [];
    if (primaryKey.length === 0 && !["full", "index"].includes(identityType)) {
      throw new SupabaseStandbyManifestError(`Replicated table ${table.name} lacks primary key or replica identity metadata.`);
    }
    if (identityType === "primary_key") {
      assertArrayEqual(table.replicaIdentity.columns ?? [], primaryKey, `${table.name} replica identity`);
    }
  }

  const viewNames = new Set();
  for (const view of views) {
    if (viewNames.has(view.name)) {
      throw new SupabaseStandbyManifestError(`Duplicate excluded view in standby manifest: ${view.name}`);
    }
    viewNames.add(view.name);
    if (tableNames.has(view.name)) {
      throw new SupabaseStandbyManifestError(`Excluded view ${view.name} must not also be row replicated as a table.`);
    }
    if (view.rowReplication !== false) {
      throw new SupabaseStandbyManifestError(`Excluded view ${view.name} must have rowReplication=false.`);
    }
  }

  for (const sequence of sequences) {
    if (!tableNames.has(sequence.table)) {
      throw new SupabaseStandbyManifestError(`Sequence ${sequence.name} references non-replicated table ${sequence.table}.`);
    }
  }
}

export async function validateStandbyManifest(root = resolve(import.meta.dirname, ".."), manifest = null) {
  const loadedManifest = manifest ?? (await loadStandbyManifest(root));
  assertManifestSafety(loadedManifest);
  assertManifestRelations(loadedManifest);

  const expectedFingerprint = schemaFingerprintForManifest(loadedManifest);
  if (loadedManifest.schemaFingerprint !== expectedFingerprint) {
    throw new SupabaseStandbyManifestError(
      "Standby manifest schema fingerprint mismatch; standby promotion must remain blocked.",
    );
  }

  const expectedManifest = await buildExpectedStandbyManifest(root);
  if (canonicalJson(loadedManifest) !== canonicalJson(expectedManifest)) {
    throw new SupabaseStandbyManifestError("Standby manifest is stale or incomplete for the current Supabase migration contract.");
  }

  return Object.freeze({
    migrationHead: loadedManifest.source.migrationHead,
    schemaFingerprint: loadedManifest.schemaFingerprint,
    replicatedTables: loadedManifest.replication.tables.length,
    excludedViews: loadedManifest.replication.excludedViews.length,
    sequenceBackedTables: loadedManifest.sequences.items.length,
    standbyTarget: loadedManifest.safety.standbyTarget,
    primaryDatabase: loadedManifest.safety.primaryDatabase,
  });
}

export function standbyManifestSummary(summary) {
  return [
    "Supabase standby manifest validated.",
    `migration_head=${summary.migrationHead}`,
    `schema_fingerprint=${summary.schemaFingerprint}`,
    `replicated_tables=${summary.replicatedTables}`,
    `excluded_views=${summary.excludedViews}`,
    `sequence_backed_tables=${summary.sequenceBackedTables}`,
    `primary_database=${summary.primaryDatabase}`,
    `standby_target=${summary.standbyTarget}`,
  ].join("\n");
}

async function run() {
  const command = process.argv[2] ?? "validate";
  if (command === "--print-manifest") {
    console.log(`${JSON.stringify(await buildExpectedStandbyManifest(), null, 2)}\n`);
    return;
  }
  if (command !== "validate") {
    throw new SupabaseStandbyManifestError(`Unsupported command: ${command}`);
  }
  console.log(standbyManifestSummary(await validateStandbyManifest()));
}

const invokedDirectly = process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;
if (invokedDirectly) {
  run().catch((error) => {
    console.error(error instanceof Error ? `Supabase standby manifest rejected: ${error.message}` : "Supabase standby manifest rejected.");
    process.exitCode = 1;
  });
}
