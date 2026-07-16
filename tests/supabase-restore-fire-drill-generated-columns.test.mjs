import assert from "node:assert/strict";
import test from "node:test";

import { buildRestoreSql } from "../scripts/supabase_restore_fire_drill.mjs";

test("restore SQL filters generated columns out of insert projections", () => {
  const sql = buildRestoreSql([
    {
      table: "articles",
      rows: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          source: "Fixture",
          title: "Kind neighbors restore a park",
          original_url: "https://fixture.nutsnews.test/article",
          search_vector: "'kind':1 'neighbors':2",
        },
      ],
    },
  ]);

  assert.match(sql, /attgenerated = ''/);
  assert.match(sql, /insert into public\."articles" \(%s\) select %s/);
  assert.match(sql, /string_agg\('restore_rows\.' \|\| quote_ident\(attname\)/);
  assert.match(sql, /"search_vector"/);
  assert.doesNotMatch(sql, /select \* from jsonb_populate_recordset/);
});
