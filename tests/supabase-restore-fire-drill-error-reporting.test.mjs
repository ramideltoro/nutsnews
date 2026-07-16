import assert from "node:assert/strict";
import test from "node:test";

import { summarizePsqlStderrForReport } from "../scripts/supabase_restore_fire_drill.mjs";

test("restore fire drill reports redact failing rows and generated SQL context", () => {
  const summary = summarizePsqlStderrForReport(`
psql:/tmp/nutsnews-restore-sql/restore.sql:89: ERROR:  null value in column "created_at" violates not-null constraint
DETAIL:  Failing row contains (secret-title, https://example.com/private-source).
CONTEXT:  SQL statement "insert into public.article_ai_reviews select * from jsonb_populate_recordset(null::public.article_ai_reviews, '[{"title":"secret-title"}]'::jsonb)"
PL/pgSQL function inline_code_block line 20 at EXECUTE
`);

  assert.match(summary, /created_at/);
  assert.match(summary, /Failing row redacted/);
  assert.match(summary, /Restore SQL context redacted/);
  assert.doesNotMatch(summary, /secret-title/);
  assert.doesNotMatch(summary, /private-source/);
  assert.doesNotMatch(summary, /jsonb_populate_recordset/);
});
