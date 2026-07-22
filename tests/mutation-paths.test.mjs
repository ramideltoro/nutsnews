import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const guardedPaths = {
  "web/app/api/contact/route.ts": "assertExternalSideEffect",
  "web/lib/quotaUsage.ts": "assertIsolatedDataMutation",
  "web/lib/articleEngagement.ts": "assertIsolatedDataMutation",
  "web/lib/adminFeedManagement.ts": "assertDataMutation",
  "web/lib/logger.ts": "isTelemetryDeliveryAllowed",
  "web/app/api/log-test/route.ts": "assertProductionOperation",
  "web/app/api/auth/[...nextauth]/route.ts": "assertOAuthCallback",
  "scripts/backfill_article_summaries.mjs": "assertProductionOperation",
  "scripts/backfill_french_summaries.mjs": "assertProductionOperation",
  "scripts/backfill_japanese_summaries.mjs": "assertProductionOperation",
  "scripts/worker_smoke_test.mjs": "assertProductionOperation",
  "scripts/post_deploy_verify.sh": "assert_runtime_safety.mjs",
  "scripts/cloudflare_purge_cache.mjs": "assertProductionOperation",
  "scripts/audit_article_translations.mjs": "assertProductionOperation",
  "scripts/diagnose_missing_article_translations.mjs": "assertProductionOperation",
  "scripts/supabase_backup.mjs": "assertProductionOperation",
  "scripts/feed_health_report.mjs": "assertProductionOperation",
  "scripts/db_size_warning.mjs": "assertProductionOperation",
  "scripts/image_coverage_report.mjs": "assertProductionOperation",
  "web/scripts/cache-observability.mjs": "assertProductionOperation",
  "web/scripts/pagespeed-insights.mjs": "assertProductionOperation",
  "web/scripts/seo-structured-data-audit.mjs": "assertProductionOperation",
  "scripts/check_sitemap_robots.mjs": "assertProductionOperation",
  "scripts/create_ios_pwa_kanban.sh": "assert_runtime_safety.mjs",
  "scripts/create_nutsnews_github_roadmap.sh": "assert_runtime_safety.mjs",
  "scripts/update_ios_pwa_issues.sh": "assert_runtime_safety.mjs",
  "scripts/create_platform_improvement_issues.mjs": "assertProductionOperation",
};

test("every discovered mutation or live operational path has a central runtime guard", async () => {
  for (const [relativePath, requiredGuard] of Object.entries(guardedPaths)) {
    const source = await readFile(resolve(root, relativePath), "utf8");
    assert.match(source, new RegExp(requiredGuard.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), relativePath);
  }
});

test("service-role clients are centralized behind the runtime-validated Supabase factory", async () => {
  const sources = await Promise.all(
    [
      "web/lib/adminCostGuardrails.ts",
      "web/lib/adminFeedHealth.ts",
      "web/lib/adminFeedManagement.ts",
      "web/lib/adminShardHealth.ts",
      "web/lib/runtimeFeatureFlags.ts",
      "web/lib/articleEngagement.ts",
    ].map((relativePath) => readFile(resolve(root, relativePath), "utf8")),
  );

  for (const source of sources) {
    assert.match(source, /@\/lib\/supabase/);
    assert.doesNotMatch(source, /createClient\(/);
  }

  const migratedReadinessSource = await readFile(
    resolve(root, "web/lib/adminProductionReadiness.ts"),
    "utf8",
  );
  assert.match(migratedReadinessSource, /@\/lib\/adminDatabase/);
  assert.doesNotMatch(migratedReadinessSource, /createClient\(/);
  assert.doesNotMatch(migratedReadinessSource, /getServerSupabase\(/);

  const migratedArticleReviewsSource = await readFile(
    resolve(root, "web/lib/adminArticleReviews.ts"),
    "utf8",
  );
  assert.match(migratedArticleReviewsSource, /@\/lib\/adminDatabase/);
  assert.doesNotMatch(migratedArticleReviewsSource, /createClient\(/);
  assert.doesNotMatch(migratedArticleReviewsSource, /getServerSupabase\(/);

  const migratedArticleEngagementSource = await readFile(
    resolve(root, "web/lib/adminArticleEngagement.ts"),
    "utf8",
  );
  assert.match(migratedArticleEngagementSource, /@\/lib\/adminDatabase/);
  assert.doesNotMatch(migratedArticleEngagementSource, /createClient\(/);
  assert.doesNotMatch(migratedArticleEngagementSource, /getServerSupabase\(/);

  const migratedAiUsageSource = await readFile(
    resolve(root, "web/lib/adminAiUsage.ts"),
    "utf8",
  );
  assert.match(migratedAiUsageSource, /@\/lib\/adminDatabase/);
  assert.doesNotMatch(migratedAiUsageSource, /createClient\(/);
  assert.doesNotMatch(migratedAiUsageSource, /getServerSupabase\(/);

  const migratedLocalAiSource = await readFile(
    resolve(root, "web/lib/adminLocalAi.ts"),
    "utf8",
  );
  assert.match(migratedLocalAiSource, /@\/lib\/adminDatabase/);
  assert.doesNotMatch(migratedLocalAiSource, /createClient\(/);
  assert.doesNotMatch(migratedLocalAiSource, /getServerSupabase\(/);

  const migratedTranslationQualitySource = await readFile(
    resolve(root, "web/lib/adminTranslationQuality.ts"),
    "utf8",
  );
  assert.match(migratedTranslationQualitySource, /@\/lib\/adminDatabase/);
  assert.doesNotMatch(migratedTranslationQualitySource, /createClient\(/);
  assert.doesNotMatch(migratedTranslationQualitySource, /getServerSupabase\(/);
});

test("the web image has no ingestion schedule, startup migration, and CI fixtures remain non-production", async () => {
  const [dockerfile, webCi, publicSmoke] = await Promise.all([
    readFile(resolve(root, "web/Dockerfile"), "utf8"),
    readFile(resolve(root, ".github/workflows/web-ci.yml"), "utf8"),
    readFile(resolve(root, "scripts/web_public_reader_smoke.mjs"), "utf8"),
  ]);

  assert.match(dockerfile, /NUTSNEWS_RUNTIME_ENV=staging/);
  assert.match(dockerfile, /NUTSNEWS_SIDE_EFFECTS_MODE=disabled/);
  assert.doesNotMatch(dockerfile, /(?:cron|crond|supervisord)/i);
  assert.doesNotMatch(dockerfile, /supabase\s+db\s+(?:push|reset)|locked_migration_workflow/i);
  assert.match(webCi, /NUTSNEWS_RUNTIME_ENV: staging/);
  assert.match(webCi, /NUTSNEWS_SIDE_EFFECTS_MODE: disabled/);
  assert.doesNotMatch(webCi, /secrets\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(publicSmoke, /NUTSNEWS_SIDE_EFFECTS_MODE: "disabled"/);
});

test("the staging fixture commands require synthetic namespaces, bounded TTL, and resettable cleanup", async () => {
  const fixture = await readFile(resolve(root, "scripts/staging_fixtures.mjs"), "utf8");

  assert.match(fixture, /nutsnews-test-/);
  assert.match(fixture, /assertSyntheticFixtureMutation/);
  assert.match(fixture, /fixture_namespace/);
  assert.match(fixture, /expires_at/);
  assert.match(fixture, /fixture\.invalid/);
  assert.match(fixture, /nutsnews_reset_staging_fixture/);
  assert.match(fixture, /auth\/v1\/admin\/users/);
  assert.match(fixture, /cleanupFailure/);
  assert.match(fixture, /cleanup failed and requires manual follow-up/);
});
