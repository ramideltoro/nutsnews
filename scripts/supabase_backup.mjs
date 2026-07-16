#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { assertProductionOperation } from '../web/runtimeSafety.mjs';

assertProductionOperation('supabase-backup');

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DEFAULT_BACKUP_TABLES = [
  'articles',
  'article_summaries',
  'rss_feeds',
  'feed_health',
  'worker_runs',
  'article_ai_reviews',
  'ai_usage_runs',
  'quota_usage_events',
  'runtime_feature_flags',
  'release_readiness',
];
const TABLES = String(process.env.BACKUP_TABLES || DEFAULT_BACKUP_TABLES.join(','))
  .split(',')
  .map((table) => table.trim())
  .filter(Boolean);
const LIMIT = Math.max(1, Math.min(Number(process.env.BACKUP_LIMIT_PER_TABLE || 5000), 50000));
const OUT_DIR = path.join(process.cwd(), 'backups', 'supabase');
const exportedRowsByTable = new Map();

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.log('Skipping Supabase backup because SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function fetchTable(table) {
  const url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=*&limit=${LIMIT}`;
  const response = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: 'application/json',
      Prefer: 'count=exact',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${table} backup failed ${response.status}: ${text.slice(0, 500)}`);
  return { rows: text ? JSON.parse(text) : [], contentRange: response.headers.get('content-range') || '' };
}

function filterRowsForReferentialClosure(table, rows) {
  if (table !== 'article_summaries') {
    return rows;
  }

  const articleRows = exportedRowsByTable.get('articles');
  if (!Array.isArray(articleRows)) {
    return rows;
  }

  const articleUrls = new Set(
    articleRows
      .map((row) => String(row?.original_url ?? '').trim())
      .filter(Boolean),
  );

  return rows.filter((row) => articleUrls.has(String(row?.original_url ?? '').trim()));
}

const now = new Date().toISOString().replace(/[:.]/g, '-');
const manifest = {
  schemaVersion: 2,
  kind: 'supabase-rest-table-export',
  createdAt: new Date().toISOString(),
  limitPerTable: LIMIT,
  restoreFireDrillCommand: 'node scripts/supabase_restore_fire_drill.mjs --backup-dir backups/supabase --local-supabase',
  tables: [],
};

for (const table of TABLES) {
  console.log(`Exporting ${table}...`);
  try {
    const fetched = await fetchTable(table);
    const sourceRowCount = fetched.rows.length;
    const rows = filterRowsForReferentialClosure(table, fetched.rows);
    if (rows.length !== sourceRowCount) {
      console.log(`Filtered ${sourceRowCount - rows.length} ${table} row(s) without exported parent articles.`);
    }
    const json = JSON.stringify(rows, null, 2);
    const jsonBuffer = Buffer.from(json, 'utf8');
    const gzipBuffer = gzipSync(jsonBuffer);
    const baseName = `${now}-${table}.json`;
    const jsonPath = path.join(OUT_DIR, baseName);
    const gzipPath = `${jsonPath}.gz`;
    writeFileSync(jsonPath, jsonBuffer);
    writeFileSync(gzipPath, gzipBuffer);
    manifest.tables.push({
      table,
      rowCount: rows.length,
      sourceRowCount,
      contentRange: fetched.contentRange,
      file: path.basename(gzipPath),
      jsonFile: path.basename(jsonPath),
      byteSize: jsonBuffer.byteLength,
      gzipByteSize: gzipBuffer.byteLength,
      sha256: sha256(gzipBuffer),
    });
    exportedRowsByTable.set(table, rows);
    console.log(`Exported ${rows.length} row(s) from ${table}.`);
  } catch (error) {
    manifest.tables.push({ table, error: error.message });
    console.error(`Failed to export ${table}: ${error.message}`);
  }
}

writeFileSync(path.join(OUT_DIR, `${now}-manifest.json`), JSON.stringify(manifest, null, 2));
writeFileSync(path.join(OUT_DIR, 'README.md'), `# NutsNews Supabase REST Backup\n\nCreated at: ${manifest.createdAt}\n\nThis backup is a limited REST export for recovery support and diagnostics. It is not a replacement for a full Supabase database dump.\n\nRun the restore fire drill against a disposable local Supabase database with:\n\n\`\`\`bash\nnode scripts/supabase_restore_fire_drill.mjs --backup-dir backups/supabase --local-supabase\n\`\`\`\n\n`);

const failed = manifest.tables.filter((table) => table.error);
if (failed.length > 0) {
  console.error(`${failed.length} table export(s) failed.`);
  process.exit(1);
}
console.log('Supabase REST backup complete.');
