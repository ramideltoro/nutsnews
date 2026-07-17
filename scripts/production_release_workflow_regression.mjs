import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const containerWorkflow = await readFile(resolve(root, ".github/workflows/container-image.yml"), "utf8");
const releaseWorkflow = await readFile(resolve(root, ".github/workflows/staging-release.yml"), "utf8");
const regressionWorkflow = await readFile(resolve(root, ".github/workflows/staging-release-regression.yml"), "utf8");
const vercelProductionWorkflow = await readFile(resolve(root, ".github/workflows/vercel-production-release.yml"), "utf8");
const dualTargetSmoke = await readFile(resolve(root, "scripts/dual_target_web_smoke.mjs"), "utf8");
const vercelConfig = JSON.parse(await readFile(resolve(root, "web/vercel.json"), "utf8"));
const workflowNames = await readdir(resolve(root, ".github/workflows"));

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

assert.doesNotMatch(containerWorkflow, /^\s+paths:\s*$/m, "Container Image must run for every main merge, not a path subset.");
requireText(containerWorkflow, "cancel-in-progress: false", "Container Image must not skip a merged release.");
requireText(containerWorkflow, "name: nutsnews-staging-release", "Container Image must publish staging metadata.");
requireText(containerWorkflow, "image_digest", "Release metadata must include the immutable image digest.");
requireText(containerWorkflow, "image_tag: sourceCommit", "Release metadata must use the full commit tag.");
requireText(containerWorkflow, "migration_head: migrationContract.head", "Release metadata must include the repository migration head.");
requireText(containerWorkflow, "schema_version: applicationContract.legacyVersion", "Release metadata must include the rollback-compatible schema marker.");
requireText(containerWorkflow, "supabase_project_ref: productionSupabaseProjectRef", "Release metadata must include the production Supabase project reference.");
requireText(containerWorkflow, "source_repository: \"ramideltoro/nutsnews\"", "Release metadata must bind the source repository.");
requireText(containerWorkflow, "source_workflow_run_id: sourceWorkflowRunId", "Release metadata must bind the source workflow run.");
requireText(containerWorkflow, "uses: actions/upload-artifact@v6", "Release metadata must be retained as an artifact.");
requireText(containerWorkflow, "NUTSNEWS_DEPLOYMENT_TARGET=vps", "OCI provenance must keep the infra-approved VPS build target.");

requireText(releaseWorkflow, "workflow_run:", "Staging handoff must wait for Container Image completion.");
requireText(releaseWorkflow, 'workflows: ["Container Image"]', "Staging handoff must trust only the image workflow.");
requireText(releaseWorkflow, "github.event.workflow_run.conclusion == 'success'", "Staging handoff must require a successful image workflow.");
requireText(releaseWorkflow, "github.event.workflow_run.event == 'push'", "Staging handoff must reject pull-request workflow runs.");
requireText(releaseWorkflow, "github.event.workflow_run.head_branch == 'main'", "Staging handoff must require main.");
requireText(
  releaseWorkflow,
  "github.event.workflow_run.head_repository.full_name == github.repository",
  "Staging handoff must reject untrusted fork workflow runs.",
);
requireText(releaseWorkflow, "uses: actions/download-artifact@v5", "Staging handoff must consume the image workflow artifact.");
requireText(releaseWorkflow, "path: ${{ runner.temp }}/nutsnews-staging-release", "Release metadata must be downloaded outside the workspace.");
requireText(releaseWorkflow, "run-id: ${{ github.event.workflow_run.id }}", "Release metadata must come from the triggering run.");
requireText(releaseWorkflow, "NUTSNEWS_INFRA_STAGING_TOKEN", "Cross-repository staging handoff must use the staging-only token.");
requireText(releaseWorkflow, "nutsnews-staging-release", "The dispatch event must request staging only.");
requireText(releaseWorkflow, "https://api.github.com/repos/ramideltoro/nutsnews-infra/dispatches", "Staging handoff must target only nutsnews-infra.");
requireText(releaseWorkflow, "client_payload: candidate", "Staging dispatch payload must be the exact candidate object.");
requireText(releaseWorkflow, "schema_version", "Staging candidate must include schema version.");
requireText(releaseWorkflow, "source_repository", "Staging candidate must include source repository.");
requireText(releaseWorkflow, "source_workflow_run_id", "Staging candidate must include source workflow run.");
requireText(releaseWorkflow, "image_digest", "Staging candidate must include the immutable image digest.");
requireText(releaseWorkflow, "migration_head", "Staging candidate must include migration head.");
requireText(releaseWorkflow, "supabase_project_ref", "Staging candidate must include production Supabase project ref.");
requireText(
  releaseWorkflow,
  "Vercel Production is disabled for app main and deploys only after the protected VPS release workflow dispatches the exact same source commit.",
  "Staging handoff summary must document that Vercel Production is part of the protected release chain.",
);
requireText(regressionWorkflow, ".github/workflows/staging-release.yml", "Regression workflow must watch the staging handoff workflow.");

assert.equal(
  vercelConfig.git?.deploymentEnabled?.main,
  false,
  "Vercel Git auto-deploys for main must be disabled so VPS and Vercel cannot deploy independently.",
);
requireText(vercelProductionWorkflow, "repository_dispatch:", "Vercel production must be dispatched by infra after VPS apply.");
requireText(vercelProductionWorkflow, "nutsnews-vercel-production-release", "Vercel production workflow must use the infra release event.");
requireText(vercelProductionWorkflow, "deploy-vercel-production", "Manual Vercel production dispatch must require an explicit confirmation.");
requireText(vercelProductionWorkflow, "actions/checkout@v5", "Vercel production must checkout the exact source commit.");
requireText(vercelProductionWorkflow, "ref: ${{ env.SOURCE_COMMIT }}", "Vercel production must deploy the dispatch source commit.");
requireText(vercelProductionWorkflow, "vercel@latest build --prod", "Vercel production must use a production build.");
requireText(vercelProductionWorkflow, "vercel@latest deploy --prebuilt --prod", "Vercel production must deploy the prebuilt production artifact.");
requireText(vercelProductionWorkflow, "localBuildControlEnv", "Vercel production must set local build control env names for the CI shell.");
requireText(vercelProductionWorkflow, "Prepared Vercel local build control env names: HOME, PATH, SHELL.", "Vercel production must report when local build control env names were prepared.");
requireText(vercelProductionWorkflow, "VERCEL_TOKEN", "Vercel production must use the scoped Vercel token secret.");
requireText(vercelProductionWorkflow, "VERCEL_ORG_ID", "Vercel production must set the Vercel org identity.");
requireText(vercelProductionWorkflow, "VERCEL_PROJECT_ID", "Vercel production must set the Vercel project identity.");
requireText(vercelProductionWorkflow, "NUTSNEWS_SOURCE_COMMIT: ${{ env.SOURCE_COMMIT }}", "Vercel production must build with explicit source identity.");
requireText(vercelProductionWorkflow, "NUTSNEWS_BUILD_ID: ${{ env.BUILD_ID }}", "Vercel production must build with explicit build identity.");
requireText(vercelProductionWorkflow, "NUTSNEWS_DEPLOYMENT_TARGET: vercel-production", "Vercel production must build with explicit target identity.");
requireText(vercelProductionWorkflow, "https://www.nutsnews.com/healthz", "Vercel production must verify the public www alias.");
requireText(vercelProductionWorkflow, "https://nutsnews.com/healthz", "Vercel production must verify the apex alias.");
requireText(vercelProductionWorkflow, "deploymentTarget !== \"vercel-production\"", "Vercel production health must verify the production target.");

assert.ok(!workflowNames.includes("production-release.yml"), "Direct production release workflow file must not exist.");
assert.ok(!workflowNames.includes("production-release-regression.yml"), "Old production release regression workflow file must not exist.");
assert.ok(workflowNames.includes("vercel-production-release.yml"), "Vercel production must be an explicit post-VPS workflow.");
for (const [label, text] of [
  ["Container Image", containerWorkflow],
  ["Staging handoff", releaseWorkflow],
  ["Staging regression", regressionWorkflow],
]) {
  assert.doesNotMatch(text, /nutsnews-production-release/, `${label} must not reference the old production dispatch event.`);
  assert.doesNotMatch(text, /NUTSNEWS_INFRA_RELEASE_TOKEN/, `${label} must not use the production release token.`);
  assert.doesNotMatch(text, /ghcr\.io\/ramideltoro\/nutsnews:latest|image_tag:\s*latest|IMAGE_TAG=.*latest/i, `${label} must not use a mutable image tag.`);
}
for (const [label, text] of [
  ["Staging handoff", releaseWorkflow],
  ["Staging regression", regressionWorkflow],
]) {
  assert.doesNotMatch(text, /environment:\s*production-vps|gh\s+workflow\s+run\s+protected-ansible-apply\.yml/i, `${label} must not request production apply.`);
}

requireText(dualTargetSmoke, "--production-safe-surfaces", "Post-production smoke must expose the safe production surface option.");
requireText(dualTargetSmoke, "Contact validation probe", "Post-production smoke must include non-mutating contact validation.");
requireText(dualTargetSmoke, "Auth session probe", "Post-production smoke must include an auth surface probe.");
requireText(dualTargetSmoke, "Next.js static asset", "Post-production smoke must include a public asset probe.");
requireText(dualTargetSmoke, "Public articles CORS probe", "Post-production smoke must include a CORS-shape probe.");

console.log("Staging release workflow regression checks passed.");
