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
