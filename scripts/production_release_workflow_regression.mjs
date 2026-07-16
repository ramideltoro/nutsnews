import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const containerWorkflow = await readFile(resolve(root, ".github/workflows/container-image.yml"), "utf8");
const releaseWorkflow = await readFile(resolve(root, ".github/workflows/production-release.yml"), "utf8");
const dualTargetSmoke = await readFile(resolve(root, "scripts/dual_target_web_smoke.mjs"), "utf8");

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

assert.doesNotMatch(containerWorkflow, /^\s+paths:\s*$/m, "Container Image must run for every main merge, not a path subset.");
requireText(containerWorkflow, "cancel-in-progress: false", "Container Image must not skip a merged release.");
requireText(containerWorkflow, "name: nutsnews-production-release", "Container Image must publish release metadata.");
requireText(containerWorkflow, "image_digest", "Release metadata must include the immutable image digest.");
requireText(containerWorkflow, "image_tag: sourceCommit", "Release metadata must use the full commit tag.");
requireText(containerWorkflow, "migration_head: migrationContract.head", "Release metadata must include the repository migration head.");
requireText(containerWorkflow, "schema_version: applicationContract.legacyVersion", "Release metadata must include the rollback-compatible schema marker.");
requireText(containerWorkflow, "uses: actions/upload-artifact@v6", "Release metadata must be retained as an artifact.");

requireText(releaseWorkflow, "workflow_run:", "Release promotion must wait for Container Image completion.");
requireText(releaseWorkflow, 'workflows: ["Container Image"]', "Release promotion must trust only the image workflow.");
requireText(releaseWorkflow, "github.event.workflow_run.conclusion == 'success'", "Release promotion must require a successful image workflow.");
requireText(releaseWorkflow, "github.event.workflow_run.event == 'push'", "Release promotion must reject pull-request workflow runs.");
requireText(releaseWorkflow, "github.event.workflow_run.head_branch == 'main'", "Release promotion must require main.");
requireText(
  releaseWorkflow,
  "github.event.workflow_run.head_repository.full_name == github.repository",
  "Release promotion must reject untrusted fork workflow runs.",
);
requireText(releaseWorkflow, "uses: actions/download-artifact@v5", "Release promotion must consume the image workflow artifact.");
requireText(releaseWorkflow, "path: ${{ runner.temp }}/nutsnews-production-release", "Release metadata must be downloaded outside the workspace.");
requireText(releaseWorkflow, "run-id: ${{ github.event.workflow_run.id }}", "Release metadata must come from the triggering run.");
requireText(releaseWorkflow, 'deployment.creator?.login === "vercel[bot]"', "Only Vercel may satisfy the production deployment gate.");
requireText(releaseWorkflow, 'deployment.environment === "Production"', "The Vercel deployment gate must require Production.");
requireText(releaseWorkflow, "NUTSNEWS_INFRA_RELEASE_TOKEN", "Cross-repository promotion must use a dedicated token.");
requireText(releaseWorkflow, "nutsnews-production-release", "The dispatch event must be narrowly named.");
requireText(releaseWorkflow, "https://api.github.com/repos/ramideltoro/nutsnews-infra/dispatches", "Promotion must target only nutsnews-infra.");
requireText(releaseWorkflow, "image_digest", "Promotion payload must include the immutable image digest.");
requireText(releaseWorkflow, "nutsnews_migration_schema_contract", "Release promotion must verify the live production database contract.");
requireText(releaseWorkflow, "expected_schema_fingerprint", "Release promotion must reject live catalog drift.");
requireText(
  releaseWorkflow,
  'url !== `https://${projectRef}.supabase.co`',
  "Release promotion must bind its database check to the reviewed production project reference.",
);
requireText(
  releaseWorkflow,
  "SUPABASE_ANON_KEY: ${{ secrets.NUTSNEWS_PRODUCTION_SUPABASE_ANON_KEY }}",
  "Release promotion must use the production-specific Supabase anon credential.",
);
assert.doesNotMatch(
  releaseWorkflow,
  /SUPABASE_ANON_KEY:\s*\$\{\{[^\n]*(?:secrets\.SUPABASE_ANON_KEY|secrets\.NEXT_PUBLIC_SUPABASE_ANON_KEY)/,
  "Release promotion must not fall back to legacy generic Supabase anon credentials.",
);
requireText(releaseWorkflow, "migration_head: migrationHead", "Promotion payload must include the verified migration head.");
requireText(releaseWorkflow, "schema_version: schemaVersion", "Promotion payload must include the rollback-compatible schema marker.");
requireText(releaseWorkflow, "supabase_project_ref: supabaseProjectRef", "Promotion payload must include the verified Supabase project identity.");

requireText(dualTargetSmoke, "--production-safe-surfaces", "Post-production smoke must expose the safe production surface option.");
requireText(dualTargetSmoke, "Contact validation probe", "Post-production smoke must include non-mutating contact validation.");
requireText(dualTargetSmoke, "Auth session probe", "Post-production smoke must include an auth surface probe.");
requireText(dualTargetSmoke, "Next.js static asset", "Post-production smoke must include a public asset probe.");
requireText(dualTargetSmoke, "Public articles CORS probe", "Post-production smoke must include a CORS-shape probe.");

console.log("Production release workflow regression checks passed.");
