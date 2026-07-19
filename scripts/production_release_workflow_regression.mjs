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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requirePinnedWorkflowUse(text, action, version, message) {
  assert.match(
    text,
    new RegExp(`uses:\\s+${escapeRegExp(action)}@[0-9a-f]{40}\\s+#\\s+${escapeRegExp(version)}`),
    message,
  );
}

function workflowStep(text, name) {
  const marker = `      - name: ${name}\n`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `Workflow step not found: ${name}`);
  const next = text.indexOf("\n      - name:", start + marker.length);
  return text.slice(start, next === -1 ? text.length : next);
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
requirePinnedWorkflowUse(containerWorkflow, "actions/upload-artifact", "v6", "Release metadata must be retained as an artifact.");
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
requirePinnedWorkflowUse(releaseWorkflow, "actions/download-artifact", "v5", "Staging handoff must consume the image workflow artifact.");
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
requireText(vercelProductionWorkflow, "on:\n  repository_dispatch:", "Vercel production must be driven by repository dispatch, not manual workflow dispatch.");
assert.ok(!vercelProductionWorkflow.includes("workflow_dispatch:"), "Vercel production must not allow manual workflow_dispatch.");
requirePinnedWorkflowUse(vercelProductionWorkflow, "actions/checkout", "v5", "Vercel production must checkout the exact source commit.");
requireText(vercelProductionWorkflow, "ref: ${{ env.SOURCE_COMMIT }}", "Vercel production must deploy the dispatch source commit.");
requireText(vercelProductionWorkflow, "vercel@latest deploy", "Vercel production must stage a Vercel deployment.");
requireText(vercelProductionWorkflow, "--prod", "Vercel production must stage a production deployment.");
requireText(vercelProductionWorkflow, "--skip-domain", "Vercel production must stage without assigning production domains.");
requireText(vercelProductionWorkflow, "--force", "Vercel production must force a fresh remote build for the release identity.");
requireText(vercelProductionWorkflow, "--archive=tgz", "Vercel production must archive uploaded source files for CI reliability.");
assert.ok(!vercelProductionWorkflow.includes("vercel@latest build --prod"), "Vercel production must not use the local prebuild path.");
assert.ok(!vercelProductionWorkflow.includes("--prebuilt"), "Vercel production must not deploy prebuilt output from the GitHub runner.");
assert.ok(
  !workflowStep(vercelProductionWorkflow, "Stage remote Vercel production candidate").includes("working-directory: web"),
  "Vercel remote production staging must run from the repository root so the project root is not applied twice.",
);
requireText(vercelProductionWorkflow, "vercel@latest promote \"$VERCEL_DEPLOYMENT_ID\"", "Vercel production must promote the qualified deployment through Vercel.");
requireText(vercelProductionWorkflow, "Run staged Vercel qualification smoke", "Vercel production must qualify the staged deployment before promotion.");
requireText(vercelProductionWorkflow, "Promote staged Vercel deployment after qualification", "Vercel production must promote only after the staged smoke.");
requireText(vercelProductionWorkflow, "Export current Vercel smoke helper", "Vercel production must export current smoke automation before staging.");
requireText(
  vercelProductionWorkflow,
  "https://api.github.com/repos/${repo}/contents/scripts/dual_target_web_smoke.mjs?ref=${sha}",
  "Vercel production must export the current workflow commit smoke helper through the GitHub Contents API.",
);
requireText(
  vercelProductionWorkflow,
  "application/vnd.github.raw",
  "Vercel production must export the smoke helper as raw source content.",
);
requireText(
  workflowStep(vercelProductionWorkflow, "Run staged Vercel qualification smoke"),
  'node "$RUNNER_TEMP/dual_target_web_smoke.mjs"',
  "Vercel staged smoke must use the exported current smoke helper.",
);
assert.ok(
  !workflowStep(vercelProductionWorkflow, "Run staged Vercel qualification smoke").includes("node ../scripts/dual_target_web_smoke.mjs"),
  "Vercel staged smoke must not run the qualified source commit smoke helper.",
);
assert.ok(
  vercelProductionWorkflow.indexOf("Run staged Vercel qualification smoke") <
    vercelProductionWorkflow.indexOf("Promote staged Vercel deployment after qualification"),
  "Vercel staged smoke must run before production promotion.",
);
assert.ok(
  vercelProductionWorkflow.indexOf("Promote staged Vercel deployment after qualification") <
    vercelProductionWorkflow.indexOf("Verify Vercel production identity"),
  "Vercel production aliases must be verified only after promotion.",
);
requireText(vercelProductionWorkflow, 'new Set(["HOME", "PATH", "Path", "SHELL"])', "Vercel production must strip shell control env names from the pulled env file.");
requireText(vercelProductionWorkflow, "Removed shell-sensitive env names from Vercel local build env file.", "Vercel production must report when shell control env names were stripped.");
requireText(vercelProductionWorkflow, '--build-env "NUTSNEWS_SOURCE_COMMIT=$SOURCE_COMMIT"', "Vercel production remote build must receive explicit source identity.");
requireText(vercelProductionWorkflow, '--build-env "NUTSNEWS_BUILD_ID=$BUILD_ID"', "Vercel production remote build must receive explicit build identity.");
requireText(vercelProductionWorkflow, '--build-env "NUTSNEWS_CONFIG_GENERATION=$VERCEL_CONFIG_GENERATION"', "Vercel production remote build must receive explicit config generation.");
requireText(vercelProductionWorkflow, '--build-env "NUTSNEWS_DEPLOYMENT_TARGET=vercel-production"', "Vercel production remote build must receive explicit target identity.");
requireText(vercelProductionWorkflow, '--env "NUTSNEWS_SOURCE_COMMIT=$SOURCE_COMMIT"', "Vercel production runtime must receive explicit source identity.");
requireText(vercelProductionWorkflow, '--env "NUTSNEWS_BUILD_ID=$BUILD_ID"', "Vercel production runtime must receive explicit build identity.");
requireText(vercelProductionWorkflow, '--env "NUTSNEWS_CONFIG_GENERATION=$VERCEL_CONFIG_GENERATION"', "Vercel production runtime must receive explicit config generation.");
requireText(vercelProductionWorkflow, '--env "NUTSNEWS_DEPLOYMENT_TARGET=vercel-production"', "Vercel production runtime must receive explicit target identity.");
assert.ok(!vercelProductionWorkflow.includes('export SHELL="/bin/sh"'), "Vercel production must not rely on runner shell overrides for Vercel builds.");
assert.ok(
  !vercelProductionWorkflow.includes("JSON.stringify(String(value))"),
  "Vercel production must not JSON-quote PATH/SHELL/HOME in .vercel env files.",
);
assert.ok(
  !vercelProductionWorkflow.includes("localBuildControlEnv") &&
    !vercelProductionWorkflow.includes("safeControlEnvValuePattern") &&
    !vercelProductionWorkflow.includes("formatEnvLine"),
  "Vercel production must not write shell control env names back into .vercel env files.",
);
requireText(vercelProductionWorkflow, "VERCEL_TOKEN", "Vercel production must use the scoped Vercel token secret.");
requireText(vercelProductionWorkflow, "VERCEL_ORG_ID", "Vercel production must set the Vercel org identity.");
requireText(vercelProductionWorkflow, "VERCEL_PROJECT_ID", "Vercel production must set the Vercel project identity.");
requireText(vercelProductionWorkflow, "https://api.vercel.com/v13/deployments", "Vercel production must resolve and record the Vercel deployment ID.");
requireText(vercelProductionWorkflow, "VPS_STAGING_DEPLOYMENT_ID", "Vercel production releases must receive VPS staging deployment evidence.");
requireText(vercelProductionWorkflow, "VPS_QUALIFICATION_RUN_ID", "Vercel production releases must receive staging qualification evidence.");
requireText(vercelProductionWorkflow, "STAGED_SMOKE_RESULT", "Vercel production promotion must depend on the staged smoke result.");
requireText(vercelProductionWorkflow, "NUTSNEWS_SOURCE_COMMIT: ${{ env.SOURCE_COMMIT }}", "Vercel production must build with explicit source identity.");
requireText(vercelProductionWorkflow, "NUTSNEWS_BUILD_ID: ${{ env.BUILD_ID }}", "Vercel production must build with explicit build identity.");
requireText(vercelProductionWorkflow, "NUTSNEWS_CONFIG_GENERATION: ${{ env.VERCEL_CONFIG_GENERATION }}", "Vercel production must expose a qualified config generation.");
requireText(vercelProductionWorkflow, "NUTSNEWS_DEPLOYMENT_TARGET: vercel-production", "Vercel production must build with explicit target identity.");
requireText(vercelProductionWorkflow, "PRODUCTION_WRITES_PAUSED: ${{ github.event.client_payload.production_writes_paused || 'false' }}", "Vercel production must consume the production writer-pause release payload.");
requireText(vercelProductionWorkflow, "Production writes paused must be true or false.", "Vercel production must validate the production writer-pause value.");
requireText(vercelProductionWorkflow, '--build-env "NUTSNEWS_PRODUCTION_WRITES_PAUSED=$PRODUCTION_WRITES_PAUSED"', "Vercel production remote build must receive the production writer-pause value.");
requireText(vercelProductionWorkflow, '--env "NUTSNEWS_PRODUCTION_WRITES_PAUSED=$PRODUCTION_WRITES_PAUSED"', "Vercel production runtime must receive the production writer-pause value.");
requireText(vercelProductionWorkflow, '--expected-production-writes-paused "$PRODUCTION_WRITES_PAUSED"', "Vercel production smoke must assert the production writer-pause value.");
requireText(vercelProductionWorkflow, "Retain sanitized Vercel release evidence", "Vercel production must retain staged URL, deployment ID, and test evidence.");
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
requireText(dualTargetSmoke, "VERCEL_SET_BYPASS_COOKIE", "Programmatic Vercel smoke must make bypass-cookie setup explicit.");
requireText(dualTargetSmoke, "--expected-production-writes-paused", "Post-production smoke must expose a production writer-pause assertion.");
requireText(dualTargetSmoke, "Readiness production writes paused header", "Post-production smoke must assert the readiness pause header.");
requireText(dualTargetSmoke, "Runtime production writes paused", "Post-production smoke must assert the runtime config pause value.");
assert.doesNotMatch(
  dualTargetSmoke,
  /"x-vercel-protection-bypass": bypassSecret,\s*"x-vercel-set-bypass-cookie": "true"/,
  "Programmatic Vercel smoke must not request bypass-cookie redirects by default.",
);
assert.ok(
  !workflowStep(vercelProductionWorkflow, "Verify Vercel production identity").includes('"x-vercel-set-bypass-cookie": "true"'),
  "Programmatic Vercel production identity verification must not request bypass-cookie redirects.",
);

console.log("Staging release workflow regression checks passed.");
