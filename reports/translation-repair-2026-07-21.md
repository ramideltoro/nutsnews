# Production article summary translation repair

Issue: #358

Run date: 2026-07-21

Production Supabase project: `mpqfulvvagyzqneiaqky`

## Summary

Production Supabase `public_feed_snapshot` rows 1-9 were missing every supported non-English `article_summaries` row (`fr`, `ja`, `de-CH`, `de`, `el`). Rows 10-15 already had complete coverage.

The incident-window worker and AI usage records showed successful article/review saves and zero translation activity. This points to skipped translation backlog/provider alignment rather than a failed Supabase write.

The repair upserted 45 localized `article_summaries` rows for the current top nine Supabase public-feed articles, refreshed `public_feed_snapshot`, and verified that the top 15 Supabase feed rows now have full supported-language coverage.

## Diagnostic Evidence

- `public_feed_snapshot` relation type: materialized view with `snapshot_rank`.
- Before repair, ranks 1-9 had `supported_summary_rows=0` and were missing `de`, `de-CH`, `el`, `fr`, and `ja`.
- Before repair, ranks 10-15 had `supported_summary_rows=5`.
- Worker window checked: 2026-07-20 18:00:00 UTC through 2026-07-20 21:00:00 UTC.
- Worker run `10176` / AI usage run `10207` at 2026-07-20 19:27:49 UTC accepted two articles; `review_save_ok=true`, `article_save_ok=true`, `ai_usage_save_ok=true`, and `cost_protection_limit_reached=false`.
- AI usage in the same window reported `openai_translation_count=0` and `local_ai_translation_count=0` for every run.
- Later runs in the same window had no eligible/reviewed/accepted articles and no translation activity.

Conclusion: the missing rows were not caused by Supabase write errors. They were caused by translation backlog work not running for the newer top-feed articles, with provider alignment increasing the visible impact.

## Repair

Rows written:

- 9 article URLs
- 5 supported non-English languages per article
- 45 `article_summaries` rows total

Repair metadata:

- `generated_by`: `codex_ops_repair_issue_358`
- `model`: `gpt-5-codex-2026-07-21`
- `source_language_code`: `en`

Snapshot refresh:

- `public.refresh_public_feed_snapshot()` returned `2026-07-21 13:24:26.650092+00`.

Post-repair Supabase verification:

- Ranks 1-15 now report `supported_summary_rows=5`.
- Missing-language arrays are `null` for ranks 1-15.
- Repaired rows: `45`
- Blank title/summary rows: `0`
- Japanese script mismatches: `0`
- Greek script mismatches: `0`
- Max repaired title length: `136`
- Max repaired summary length: `269`

## Live Route Status

Before the repair, `https://www.nutsnews.com/api/articles?home=1&lang=fr` returned `dataSource=public_feed_snapshot` with `translatedCount=0`.

The first live verification after the data repair still returned English text because production Vercel was on commit `d1ec4f790f2e8e4691fc57337b86188148674ef0`, which predates #357. Production also ran in `backend_postgres_primary`, so the backend app database API had to consume `requestedLanguageCode` and apply `article_summaries` rows before the repaired data could be visible.

### #357 production promotion

A protected staging and production promotion was completed for #357 commit `4d2055ea083d523454dad96393dcc935f503ccf6`:

- App staging dispatch: `29836024716`
- Infra staging deploy: `29836035330`
- Infra staging qualification: `29836149813`
- Infra production promotion: `29836256487`
- Protected VPS apply: `29836432091`
- Vercel production dispatch: `29837079009`
- Image digest: `sha256:872e6f19f2b02c5f39c488c82a521451e42caedd7cef7501b3baa3ad82dbca27`
- Build ID: `29832974080-1`

Post-promotion `https://www.nutsnews.com/healthz` returned:

- `ok=true`
- `sourceCommit=4d2055ea083d523454dad96393dcc935f503ccf6`
- `buildId=29832974080-1`
- `deploymentTarget=vercel-production`

### Backend-primary app DB API fix

After #357 reached Vercel, the live French feed still fell back to English because the backend app database API operations `load-public-feed-snapshot` and `load-home-feed-snapshot` ignored `requestedLanguageCode`. The backend service already localized the worker edge-snapshot row operation, but not the app feed operations used by Vercel in `backend_postgres_primary`.

The backend fix was shipped through the backend repository:

- Backend PR: `ramideltoro/nutsnews-backend#269`
- Backend merge commit: `fbffcceb5d124a73d7f05329af8e862810aff6e5`
- Backend main checks: `29837827621`, success
- Protected backend apply: `29838083379`, success

The matching docs update was shipped through `ramideltoro/nutsnews-docs#19`.

### Final live verification

Final verification against `https://www.nutsnews.com/api/articles?home=1&lang=fr` after the backend apply returned:

- HTTP `200`
- `X-NutsNews-Article-Data-Source: public_feed_snapshot`
- `X-NutsNews-Article-Language: fr`
- Response `dataSource=public_feed_snapshot`
- Response `languageCode=fr`
- First page article count: `5`
- French translated first-page article count: `5`
- First article metadata: `language_code=fr`, `requested_language_code=fr`, `translation_available=true`

## Follow-Up

- Backend New Relic change-tracking markers for backend commit `fbffcceb5d124a73d7f05329af8e862810aff6e5` cancelled without allocating jobs; the required backend checks and protected apply passed. Review that optional workflow separately if deployment marker history is required.
- Keep Supabase and backend provider modes aligned during production releases; stale Vercel code can make a healthy provider look untranslated.
- Add scheduled translation backlog coverage for newly accepted top-feed articles so `article_summaries` rows are generated before those articles dominate `public_feed_snapshot`.
- Re-check whether `NUTSNEWS_EDGE_FEED_SNAPSHOT_URL` is configured in production; the live article API reported `X-NutsNews-Edge-Snapshot: not-used` during this run.
