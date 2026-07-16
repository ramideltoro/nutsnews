import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import {
  RestoreFireDrillError,
  buildRestoreSql,
  validateBackupArtifacts,
} from "../scripts/supabase_restore_fire_drill.mjs";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function writeBackupFixture({
  createdAt = "2026-07-16T12:00:00.000Z",
  tables = {
    articles: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        source: "Fixture",
        title: "Kind neighbors restore a park",
        original_url: "https://fixture.nutsnews.test/article",
      },
    ],
    rss_feeds: [{ id: 1, source: "Fixture", url: "https://fixture.nutsnews.test/rss.xml" }],
  },
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), "nutsnews-restore-fire-drill-"));
  mkdirSync(dir, { recursive: true });
  const entries = [];

  for (const [table, rows] of Object.entries(tables)) {
    const json = Buffer.from(JSON.stringify(rows, null, 2), "utf8");
    const gzip = gzipSync(json);
    const file = `${createdAt.replace(/[:.]/g, "-")}-${table}.json.gz`;
    writeFileSync(join(dir, file), gzip);
    entries.push({
      table,
      rowCount: rows.length,
      contentRange: `0-${Math.max(rows.length - 1, 0)}/${rows.length}`,
      file,
      byteSize: json.byteLength,
      gzipByteSize: gzip.byteLength,
      sha256: sha256(gzip),
    });
  }

  writeFileSync(
    join(dir, `${createdAt.replace(/[:.]/g, "-")}-manifest.json`),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        kind: "supabase-rest-table-export",
        createdAt,
        limitPerTable: 5000,
        tables: entries,
      },
      null,
      2,
    )}\n`,
  );

  return dir;
}

test("restore fire drill validates a fresh backup manifest and required non-empty tables", () => {
  const backupDir = writeBackupFixture();
  const validation = validateBackupArtifacts({
    backupDir,
    now: Date.parse("2026-07-16T13:00:00.000Z"),
    expectedTables: ["articles", "rss_feeds"],
    requiredNonEmptyTables: ["articles", "rss_feeds"],
  });

  assert.equal(validation.tables.length, 2);
  assert.equal(validation.tables.find((entry) => entry.table === "articles").rowCount, 1);
  assert.equal(validation.ageHours, 1);
});

test("restore fire drill rejects stale, incomplete, and empty required artifacts", () => {
  const staleDir = writeBackupFixture({ createdAt: "2026-07-14T12:00:00.000Z" });
  assert.throws(
    () =>
      validateBackupArtifacts({
        backupDir: staleDir,
        now: Date.parse("2026-07-16T13:00:00.000Z"),
        expectedTables: ["articles", "rss_feeds"],
      }),
    /older than 30 hours/,
  );

  const incompleteDir = writeBackupFixture({ tables: { articles: [{ id: "fixture" }] } });
  assert.throws(
    () =>
      validateBackupArtifacts({
        backupDir: incompleteDir,
        now: Date.parse("2026-07-16T13:00:00.000Z"),
        expectedTables: ["articles", "rss_feeds"],
      }),
    /missing expected tables: rss_feeds/,
  );

  const emptyDir = writeBackupFixture({ tables: { articles: [], rss_feeds: [{ id: 1 }] } });
  assert.throws(
    () =>
      validateBackupArtifacts({
        backupDir: emptyDir,
        now: Date.parse("2026-07-16T13:00:00.000Z"),
        expectedTables: ["articles", "rss_feeds"],
        requiredNonEmptyTables: ["articles"],
      }),
    RestoreFireDrillError,
  );
});

test("restore fire drill generates deterministic restore SQL for disposable databases", () => {
  const backupDir = writeBackupFixture();
  const validation = validateBackupArtifacts({
    backupDir,
    now: Date.parse("2026-07-16T13:00:00.000Z"),
    expectedTables: ["articles", "rss_feeds"],
  });
  const sql = buildRestoreSql(validation.tables);

  assert.match(sql, /begin;/);
  assert.match(sql, /truncate table public\."rss_feeds", public\."articles" restart identity cascade;/);
  assert.match(sql, /jsonb_populate_recordset\(null::public\."rss_feeds"/);
  assert.match(sql, /jsonb_populate_recordset\(null::public\."articles"/);
  assert.match(sql, /commit;/);
});
