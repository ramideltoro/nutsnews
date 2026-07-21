import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const containerWorkflow = await readFile(resolve(root, ".github/workflows/container-image.yml"), "utf8");
const releaseWorkflow = await readFile(resolve(root, ".github/workflows/staging-release.yml"), "utf8");
const regressionWorkflow = await readFile(resolve(root, ".github/workflows/staging-release-regression.yml"), "utf8");
const preMergeDeploymentContract = await readFile(
  resolve(root, ".github/deployment/pre-merge-deployment-gate-contract.md"),
  "utf8",
);
const translationCoverageWorkflow = await readFile(resolve(root, ".github/workflows/translation-coverage.yml"), "utf8");
const vercelBackendTokenSyncWorkflow = await readFile(resolve(root, ".github/workflows/vercel-backend-token-sync.yml"), "utf8");
const vercelProductionWorkflow = await readFile(resolve(root, ".github/workflows/vercel-production-release.yml"), "utf8");
const dualTargetSmoke = await readFile(resolve(root, "scripts/dual_target_web_smoke.mjs"), "utf8");
const vercelConfig = JSON.parse(await readFile(resolve(root, "web/vercel.json"), "utf8"));
const packageJson = JSON.parse(await readFile(resolve(root, "web/package.json"), "utf8"));
const workflowNames = await readdir(resolve(root, ".github/workflows"));

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

function requireOrderedText(text, fragments, message) {
  let cursor = -1;
  for (const fragment of fragments) {
    const index = text.indexOf(fragment, cursor + 1);
    assert.ok(index > cursor, `${message}: missing or out of order fragment ${JSON.stringify(fragment)}.`);
    cursor = index;
  }
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
requireText(containerWorkflow, "npm run test:translation-release-gate", "Release candidate must run translation release-gate regression.");
requireText(containerWorkflow, "npm run test:e2e:public-smoke", "Release candidate must run public reader language smoke coverage.");
requireText(containerWorkflow, "npm run audit:translations", "Release candidate must run the strict translation audit.");
requireText(containerWorkflow, "TRANSLATION_QUALITY_FAIL_ON_CRITICAL=true", "Release candidate audit must fail on critical translation quality issues.");
requireText(containerWorkflow, "TRANSLATION_QUALITY_FAIL_ON_MISSING=true", "Release candidate audit must fail on missing translation rows.");
requireText(containerWorkflow, "TRANSLATION_QUALITY_MIN_COVERAGE=100", "Release candidate audit must enforce complete fixture coverage.");
requirePinnedWorkflowUse(containerWorkflow, "actions/upload-artifact", "v6", "Release metadata must be retained as an artifact.");
requireText(containerWorkflow, "NUTSNEWS_DEPLOYMENT_TARGET=vps", "OCI provenance must keep the infra-approved VPS build target.");

requireOrderedText(
  preMergeDeploymentContract,
  [
    "VPS staging",
    "UI tests",
    "Vercel staging",
    "UI tests",
    "Vercel production",
    "UI tests",
    "VPS production",
    "UI tests",
  ],
  "Pre-merge deployment contract must preserve the required stage order",
);
for (const field of [
  "source_commit",
  "build_id",
  "image_digest",
  "deployment_id",
  "target_url",
  "runtime_env",
  "deployment_target",
  "workflow_run_id",
  "test_artifact_links",
]) {
  requireText(preMergeDeploymentContract, field, `Pre-merge deployment contract must name ${field}.`);
}
for (const fragment of [
  "Merge to `main` is a handoff after all deployment gates have passed.",
  "A merge to `main` must not trigger deployment work.",
  "All deployment stages complete before merge into `main`.",
  "Reusable UI test evidence",
  "Target-specific deploy evidence",
  "Pre-merge deployment gate",
]) {
  requireText(preMergeDeploymentContract, fragment, `Pre-merge deployment contract must define: ${fragment}`);
}

assert.equal(
  packageJson.scripts?.["test:translation-release-gate"],
  "node ../scripts/translation_release_gate_regression.mjs",
  "web/package.json must expose the translation release-gate regression script.",
);

requireText(translationCoverageWorkflow, "name: Translation Coverage Report", "Scheduled translation workflow must stay identifiable.");
requireText(translationCoverageWorkflow, "TRANSLATION_QUALITY_REPORT_PATH", "Scheduled translation workflow must keep writing a report artifact.");
requireText(translationCoverageWorkflow, 'TRANSLATION_QUALITY_FAIL_ON_CRITICAL: "false"', "Scheduled translation workflow must remain report-only for critical findings.");
requireText(translationCoverageWorkflow, 'TRANSLATION_QUALITY_FAIL_ON_MISSING: "false"', "Scheduled translation workflow must remain report-only for missing rows.");
requireText(translationCoverageWorkflow, 'TRANSLATION_QUALITY_MIN_COVERAGE: "0"', "Scheduled translation workflow must not enforce the release-gate coverage threshold.");
requireText(translationCoverageWorkflow, "Upload translation report", "Scheduled translation workflow must upload the operations report.");

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
requireText(releaseWorkflow, "Download immutable staging metadata with retries", "Staging handoff must retry transient artifact failures.");
requireText(releaseWorkflow, "ARTIFACT_DIR: ${{ runner.temp }}/nutsnews-staging-release", "Release metadata must be downloaded outside the workspace.");
requireText(releaseWorkflow, "SOURCE_WORKFLOW_RUN_ID: ${{ github.event.workflow_run.id }}", "Release metadata must come from the triggering run.");
requireText(releaseWorkflow, "archive_download_url", "Staging handoff must resolve the exact artifact archive URL.");
requireText(releaseWorkflow, "for attempt in 1 2 3 4 5", "Staging handoff must use bounded artifact retries.");
requireText(releaseWorkflow, "unzip -q \"$artifact_zip\" -d \"$ARTIFACT_DIR\"", "Staging handoff must unpack the immutable metadata artifact.");
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
requireText(regressionWorkflow, ".github/workflows/vercel-backend-token-sync.yml", "Regression workflow must watch the Vercel backend token sync workflow.");

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
requireText(vercelProductionWorkflow, "environment: Production", "Vercel production must use the protected app Production environment.");
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
requireText(vercelProductionWorkflow, '--build-env "NUTSNEWS_DATABASE_PROVIDER_MODE=$DATABASE_PROVIDER_MODE"', "Vercel production remote build must receive explicit database provider mode.");
requireText(vercelProductionWorkflow, '--build-env "NUTSNEWS_DEPLOYMENT_TARGET=vercel-production"', "Vercel production remote build must receive explicit target identity.");
requireText(vercelProductionWorkflow, '--build-env "NUTSNEWS_BACKEND_API_URL=$BACKEND_API_URL"', "Vercel production remote build must receive the backend API URL for backend provider releases.");
requireText(vercelProductionWorkflow, '--build-env "NUTSNEWS_BACKEND_API_TOKEN=$NUTSNEWS_BACKEND_API_TOKEN"', "Vercel production remote build must receive the backend API token for backend provider releases.");
requireText(vercelProductionWorkflow, '--build-env "NUTSNEWS_BACKEND_POSTGRES_PRIMARY_CONFIRMATION=$BACKEND_POSTGRES_PRIMARY_CONFIRMATION"', "Vercel production remote build must receive backend primary confirmation.");
requireText(vercelProductionWorkflow, '--env "NUTSNEWS_SOURCE_COMMIT=$SOURCE_COMMIT"', "Vercel production runtime must receive explicit source identity.");
requireText(vercelProductionWorkflow, '--env "NUTSNEWS_BUILD_ID=$BUILD_ID"', "Vercel production runtime must receive explicit build identity.");
requireText(vercelProductionWorkflow, '--env "NUTSNEWS_CONFIG_GENERATION=$VERCEL_CONFIG_GENERATION"', "Vercel production runtime must receive explicit config generation.");
requireText(vercelProductionWorkflow, '--env "NUTSNEWS_DATABASE_PROVIDER_MODE=$DATABASE_PROVIDER_MODE"', "Vercel production runtime must receive explicit database provider mode.");
requireText(vercelProductionWorkflow, '--env "NUTSNEWS_DEPLOYMENT_TARGET=vercel-production"', "Vercel production runtime must receive explicit target identity.");
requireText(vercelProductionWorkflow, '--env "NUTSNEWS_BACKEND_API_URL=$BACKEND_API_URL"', "Vercel production runtime must receive the backend API URL for backend provider releases.");
requireText(vercelProductionWorkflow, '--env "NUTSNEWS_BACKEND_API_TOKEN=$NUTSNEWS_BACKEND_API_TOKEN"', "Vercel production runtime must receive the backend API token for backend provider releases.");
requireText(vercelProductionWorkflow, '--env "NUTSNEWS_BACKEND_POSTGRES_PRIMARY_CONFIRMATION=$BACKEND_POSTGRES_PRIMARY_CONFIRMATION"', "Vercel production runtime must receive backend primary confirmation.");
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
requireText(vercelProductionWorkflow, "DATABASE_PROVIDER_MODE: ${{ github.event.client_payload.provider_switch.database_provider_mode }}", "Vercel production must consume the database provider mode release payload.");
requireText(vercelProductionWorkflow, "BACKEND_API_URL: ${{ github.event.client_payload.provider_switch.backend_api_url || '' }}", "Vercel production must consume the backend API URL release payload.");
requireText(vercelProductionWorkflow, "PROVIDER_SWITCH_CONFIRMATION: ${{ github.event.client_payload.provider_switch.provider_switch_confirmation || '' }}", "Vercel production must consume the provider switch confirmation release payload.");
requireText(vercelProductionWorkflow, "NUTSNEWS_BACKEND_API_TOKEN: ${{ secrets.NUTSNEWS_BACKEND_API_TOKEN }}", "Vercel production must consume the protected backend API token secret.");
requireText(vercelProductionWorkflow, "Provider switch database provider mode is required for Vercel production releases.", "Vercel production must fail closed when the provider mode payload is missing.");
requireText(vercelProductionWorkflow, "Backend PostgreSQL primary release requires provider switch confirmation.", "Vercel production must validate backend primary confirmation.");
requireText(vercelProductionWorkflow, "NUTSNEWS_BACKEND_API_TOKEN Production environment secret is required for backend PostgreSQL provider releases.", "Vercel production must fail closed when the backend API token is absent.");
requireText(vercelProductionWorkflow, "PRODUCTION_WRITES_PAUSED: ${{ github.event.client_payload.production_writes_paused || 'false' }}", "Vercel production must consume the production writer-pause release payload.");
requireText(vercelProductionWorkflow, "Production writes paused must be true or false.", "Vercel production must validate the production writer-pause value.");
requireText(vercelProductionWorkflow, '--build-env "NUTSNEWS_PRODUCTION_WRITES_PAUSED=$PRODUCTION_WRITES_PAUSED"', "Vercel production remote build must receive the production writer-pause value.");
requireText(vercelProductionWorkflow, '--env "NUTSNEWS_PRODUCTION_WRITES_PAUSED=$PRODUCTION_WRITES_PAUSED"', "Vercel production runtime must receive the production writer-pause value.");
requireText(vercelProductionWorkflow, '--expected-database-provider-mode "$DATABASE_PROVIDER_MODE"', "Vercel production smoke must assert the database provider mode.");
requireText(vercelProductionWorkflow, '--expected-production-writes-paused "$PRODUCTION_WRITES_PAUSED"', "Vercel production smoke must assert the production writer-pause value.");
requireText(vercelProductionWorkflow, "Retain sanitized Vercel release evidence", "Vercel production must retain staged URL, deployment ID, and test evidence.");
requireText(vercelProductionWorkflow, "https://www.nutsnews.com/healthz", "Vercel production must verify the public www alias.");
requireText(vercelProductionWorkflow, "https://nutsnews.com/healthz", "Vercel production must verify the apex alias.");
requireText(vercelProductionWorkflow, "deploymentTarget !== \"vercel-production\"", "Vercel production health must verify the production target.");

requireText(vercelBackendTokenSyncWorkflow, "workflow_dispatch:", "Backend token sync must require an explicit operator dispatch.");
requireText(
  vercelBackendTokenSyncWorkflow,
  "sync-backend-api-token-to-vercel-production",
  "Backend token sync must require a typed confirmation.",
);
requireText(vercelBackendTokenSyncWorkflow, "environment: Production", "Backend token sync must use the protected app Production environment.");
requireText(
  vercelBackendTokenSyncWorkflow,
  "NUTSNEWS_BACKEND_API_TOKEN: ${{ secrets.NUTSNEWS_BACKEND_API_TOKEN }}",
  "Backend token sync must consume the protected backend API token secret.",
);
requireText(vercelBackendTokenSyncWorkflow, 'url.searchParams.set("upsert", "true")', "Backend token sync must upsert rather than create duplicates.");
requireText(vercelBackendTokenSyncWorkflow, 'type: "encrypted"', "Backend token sync must write a readable encrypted Vercel variable.");
requireText(vercelBackendTokenSyncWorkflow, 'target: ["production"]', "Backend token sync must write only the Vercel Production target.");
requireText(
  vercelBackendTokenSyncWorkflow,
  "https://api.vercel.com/v1/projects/",
  "Backend token sync must verify decryptability through Vercel's per-variable detail endpoint.",
);
requireText(
  vercelBackendTokenSyncWorkflow,
  "retrieved value did not match the protected source secret",
  "Backend token sync must verify Vercel kept the exact protected source token without printing it.",
);
requireText(
  vercelBackendTokenSyncWorkflow,
  "response body omitted",
  "Backend token sync must not print Vercel response bodies from secret-bearing requests.",
);
assert.ok(
  !vercelBackendTokenSyncWorkflow.includes('type: "sensitive"'),
  "Backend token sync must not write a sensitive Vercel variable because protected VPS sync must retrieve the decrypted value.",
);
assert.doesNotMatch(
  vercelBackendTokenSyncWorkflow,
  /console\.log\([^)]*tokenValue|echo\s+["']?\$NUTSNEWS_BACKEND_API_TOKEN/,
  "Backend token sync must not print the backend API token value.",
);

assert.ok(!workflowNames.includes("production-release.yml"), "Direct production release workflow file must not exist.");
assert.ok(!workflowNames.includes("production-release-regression.yml"), "Old production release regression workflow file must not exist.");
assert.ok(workflowNames.includes("vercel-production-release.yml"), "Vercel production must be an explicit post-VPS workflow.");
assert.ok(workflowNames.includes("vercel-backend-token-sync.yml"), "Backend token sync must be an explicit protected workflow.");
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
requireText(
  dualTargetSmoke,
  "expectedProductionWritesPaused === true ? [503] : [400, 422]",
  "Post-production smoke must expect contact validation to be write-blocked during production writer pause.",
);
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
