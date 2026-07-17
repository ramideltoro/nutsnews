import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(source, expected, filePath) {
  assert.ok(
    source.includes(expected),
    `${filePath} must include ${JSON.stringify(expected)}.`,
  );
}

const migration = read(
  "supabase/migrations/20260717103000_add_ai_decision_versions.sql",
);
const migrationContract = read("web/migrationContract.mjs");
const containerWorkflow = read(".github/workflows/container-image.yml");
const adminReviewLib = read("web/lib/adminArticleReviews.ts");
const adminArticlesPage = read("web/app/admin/(protected)/articles/page.tsx");
const packageJson = read("web/package.json");

for (const expected of [
  "add column if not exists prompt_version",
  "add column if not exists model_version",
  "set_article_ai_review_versions",
  "article_ai_reviews_prompt_model_version_reviewed_idx",
  "article_ai_reviews_version_decision_reviewed_idx",
  "create or replace view public.ai_decision_version_report",
  "acceptance_rate_delta_pct",
  "revoke all on public.ai_decision_version_report from anon, authenticated",
  "grant select on public.ai_decision_version_report to service_role",
  "select public.nutsnews_record_migration_head('20260717103000');",
]) {
  assertIncludes(migration, expected, "20260717103000_add_ai_decision_versions.sql");
}

for (const expected of [
  '"prompt_version"',
  '"model_version"',
  "AI_DECISION_VERSION_REPORT_SELECT_COLUMNS",
  "AiDecisionVersionReportRow",
  '.from("ai_decision_version_report")',
  "versionReports",
  "versionReportSql",
]) {
  assertIncludes(adminReviewLib, expected, "web/lib/adminArticleReviews.ts");
}

for (const expected of [
  "AI Version Audit",
  "Prompt and Model Version Quality",
  "Current Acceptance",
  "Previous Acceptance",
  "Acceptance Delta",
  "data.versionReportSql",
  "review.promptVersion",
  "review.modelVersion",
]) {
  assertIncludes(adminArticlesPage, expected, "web/app/admin/(protected)/articles/page.tsx");
}

assertIncludes(
  migrationContract,
  'MIGRATION_HEAD = "20260717113000"',
  "web/migrationContract.mjs",
);
assertIncludes(
  containerWorkflow,
  '"migration_head":"20260717113000"',
  ".github/workflows/container-image.yml",
);
assertIncludes(
  packageJson,
  '"test:ai-decision-versions": "node ../scripts/ai_decision_versions_regression.mjs"',
  "web/package.json",
);

console.log("AI decision version regression checks passed.");
