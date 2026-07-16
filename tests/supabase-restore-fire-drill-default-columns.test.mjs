import assert from "node:assert/strict";
import test from "node:test";

import { buildRestoreSql } from "../scripts/supabase_restore_fire_drill.mjs";

test("restore SQL lets database defaults fill target columns missing from backup rows", () => {
  const sql = buildRestoreSql([
    {
      table: "article_ai_reviews",
      rows: [
        {
          id: "67e48991-cf0d-4fdb-a935-ffc9c4fef254",
          reviewed_at: "2026-06-07T21:39:17.957496+00:00",
          original_url: "https://example.com/community-garden",
          source: "NPR",
          title: "A community garden brings neighbors together",
          decision: "accept",
        },
      ],
    },
  ]);

  assert.match(sql, /source_columns text\[\]/);
  assert.match(sql, /attname = any\(source_columns\)/);
  assert.match(sql, /reviewed_at/);
  assert.doesNotMatch(sql, /created_at/);
});
