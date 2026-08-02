import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const backupScript = readFileSync(
  resolve(import.meta.dirname, "../scripts/supabase_backup.mjs"),
  "utf8",
);

test("Supabase REST backup keeps article summaries inside the exported article sample", () => {
  assert.match(backupScript, /function filterRowsForReferentialClosure/);
  assert.match(backupScript, /table !== 'article_summaries'/);
  assert.match(backupScript, /exportedRowsByTable\.get\('articles'\)/);
  assert.match(backupScript, /row\?\.original_url/);
  assert.match(backupScript, /sourceRowCount/);
});

test("Supabase REST backup paginates and retries bounded transient failures", () => {
  assert.match(backupScript, /BACKUP_PAGE_SIZE \|\| 250/);
  assert.match(backupScript, /offset=\$\{offset\}/);
  assert.match(backupScript, /MAX_ATTEMPTS = 4/);
  assert.match(backupScript, /408, 425, 429, 500, 502, 503, 504/);
  assert.match(backupScript, /page\.rows\.length < pageLimit/);
  assert.doesNotMatch(backupScript, /select=\*&limit=\$\{LIMIT\}`/);
});
