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
const deploymentHardening = await readFile(resolve(root, "scripts/deployment_hardening.mjs"), "utf8");
const deploymentHardeningTest = await readFile(resolve(root, "tests/deployment-hardening.test.mjs"), "utf8");
const prVpsStagingDeploy = await readFile(resolve(root, "scripts/pr_vps_staging_deploy.mjs"), "utf8");
const prVpsStagingDeployTest = await readFile(resolve(root, "tests/pr-vps-staging-deploy.test.mjs"), "utf8");
const prVpsStagingQualification = await readFile(resolve(root, "scripts/pr_vps_staging_qualification.mjs"), "utf8");
const prVpsStagingQualificationTest = await readFile(resolve(root, "tests/pr-vps-staging-qualification.test.mjs"), "utf8");
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

function workflowJob(text, name) {
  const marker = `  ${name}:\n`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `Workflow job not found: ${name}`);
  const rest = text.slice(start + marker.length);
  const next = rest.search(/\n  [A-Za-z0-9_-]+:\n/);
  return text.slice(start, next === -1 ? text.length : start + marker.length + next);
}

const prVpsStagingJob = workflowJob(containerWorkflow, "deploy-vps-staging");
const vpsStagingUiSmokeJob = workflowJob(containerWorkflow, "ui-smoke-vps-staging");
const vercelStagingDeployJob = workflowJob(containerWorkflow, "deploy-vercel-staging");
const vercelStagingUiSmokeJob = workflowJob(containerWorkflow, "ui-smoke-vercel-staging");
const vercelProductionDeployJob = workflowJob(containerWorkflow, "deploy-vercel-production");
const vercelProductionUiSmokeJob = workflowJob(containerWorkflow, "ui-smoke-vercel-production");
const vpsProductionDeployJob = workflowJob(containerWorkflow, "deploy-vps-production");
const vpsProductionUiSmokeJob = workflowJob(containerWorkflow, "ui-smoke-vps-production");
const preMergeDeploymentGateJob = workflowJob(containerWorkflow, "pre-merge-deployment-gate");

assert.doesNotMatch(containerWorkflow, /^\s+paths:\s*$/m, "Container Image must run for every main merge, not a path subset.");
requireText(containerWorkflow, "cancel-in-progress: ${{ github.event_name == 'pull_request' }}", "Container Image must cancel stale PR attempts without skipping merged releases.");
requireText(containerWorkflow, "format('container-image-pr-{0}', github.event.pull_request.number)", "Container Image PR concurrency must be scoped to the PR number.");
assert.ok(!containerWorkflow.includes("name: nutsnews-staging-release"), "Container Image must not publish post-main staging release metadata.");
requireText(containerWorkflow, "Deployment role: archive only", "Main image publish summary must state it is not a deployment trigger.");
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
  "bounded exponential backoff",
  "nutsnews-premerge-deploy-pr-<pr_number>",
  "pr-<pr_number>-<source_commit>-<target_type>",
  "deploy-vps-staging",
  "ui-smoke-vps-staging",
  "deploy-vercel-staging",
  "ui-smoke-vercel-staging",
  "deploy-vercel-production",
  "ui-smoke-vercel-production",
  "deploy-vps-production",
  "ui-smoke-vps-production",
  "pre-merge-deployment-gate",
  "nutsnews-staging-release",
  "runtime env `staging`, deployment target `vps-staging`",
  "infra staging qualification",
  "deployment target `vercel-staging`",
  "deployment target `vercel-production`",
  "deployment target `production-vps`",
  "NUTSNEWS_PRODUCTION_SAFE_SURFACES=true",
  "nutsnews-production-vps-release",
  "node ../scripts/run_deployed_ui_smoke_with_evidence.mjs",
  "node scripts/pr_vps_staging_qualification.mjs",
  "nutsnews-ui-smoke-vps-staging",
  "nutsnews-ui-smoke-production-vps",
  "pre_merge_deployment_workflow_order_regression.mjs",
  "stage order, target URLs, deployment IDs, result, and GitHub artifact links",
  "Pre-merge deployment gate",
]) {
  requireText(preMergeDeploymentContract, fragment, `Pre-merge deployment contract must define: ${fragment}`);
}
requireText(containerWorkflow, "node --test tests/deployment-hardening.test.mjs", "Release candidate must run deployment hardening helper tests.");
for (const fragment of [
  "withBoundedExponentialBackoff",
  "fetchJsonWithRetry",
  "pollGitHubWorkflowRun",
  "pollInfraGitHubDeployment",
  "pollVercelDeployment",
  "preMergeDeploymentConcurrencyGroup",
  "deploymentStageIdempotencyKey",
  "safeDeploymentDebugSummary",
]) {
  requireText(deploymentHardening, fragment, `Deployment hardening helper must export ${fragment}.`);
  requireText(deploymentHardeningTest, fragment, `Deployment hardening regression must cover ${fragment}.`);
}
requireText(prVpsStagingJob, "name: Deploy PR candidate to VPS staging", "PR pipeline must include the VPS staging deploy stage.");
requireText(prVpsStagingJob, "needs: [pr-release-artifact, trusted-pr-deployment-eligibility]", "VPS staging deploy must consume the immutable PR artifact after eligibility.");
requireText(prVpsStagingJob, "timeout-minutes: 30", "VPS staging deploy must have an explicit timeout.");
requireText(prVpsStagingJob, "group: nutsnews-premerge-deploy-pr-${{ github.event.pull_request.number }}", "VPS staging deploy must serialize by PR number.");
requireText(prVpsStagingJob, "cancel-in-progress: true", "VPS staging deploy reruns must supersede older active attempts.");
requireText(prVpsStagingJob, "PR_RELEASE_METADATA_JSON: ${{ needs.pr-release-artifact.outputs.metadata_json }}", "VPS staging deploy must consume PR artifact metadata.");
requireText(prVpsStagingJob, "NUTSNEWS_INFRA_STAGING_TOKEN", "VPS staging deploy must use the staging infra dispatch token.");
requireText(prVpsStagingJob, "node scripts/pr_vps_staging_deploy.mjs", "VPS staging deploy must use the tested deploy helper.");
requireText(prVpsStagingJob, "Upload VPS staging deploy evidence", "VPS staging deploy must retain deploy evidence.");
requireText(containerWorkflow, "node --test tests/pr-vps-staging-deploy.test.mjs", "Release candidate must run PR VPS staging deployment tests.");
requireText(containerWorkflow, "node --test tests/pr-vps-staging-qualification.test.mjs", "Release candidate must run delegated PR VPS staging qualification tests.");
for (const fragment of [
  "parsePrReleaseMetadata",
  "buildVpsStagingCandidate",
  "computeVpsStagingDeploymentId",
  "pollInfraGitHubDeployment",
  "verifyVpsStagingRuntime",
  "verifiedVpsStagingRuntimeIdentity",
  "deploymentStageIdempotencyKey",
  "buildVpsStagingEvidence",
]) {
  requireText(prVpsStagingDeploy, fragment, `PR VPS staging deploy helper must implement ${fragment}.`);
  requireText(prVpsStagingDeployTest, fragment, `PR VPS staging deploy regression must cover ${fragment}.`);
}
requireText(vpsStagingUiSmokeJob, "name: UI smoke VPS staging", "PR pipeline must include the VPS staging UI smoke stage.");
requireText(vpsStagingUiSmokeJob, "needs: [deploy-vps-staging, pr-release-artifact, trusted-pr-deployment-eligibility]", "VPS staging UI smoke must run after the VPS staging deploy.");
requireText(vpsStagingUiSmokeJob, "timeout-minutes: 20", "VPS staging UI smoke must have an explicit timeout.");
requireText(vpsStagingUiSmokeJob, "group: nutsnews-premerge-deploy-pr-${{ github.event.pull_request.number }}", "VPS staging UI smoke must serialize by PR number.");
requireText(vpsStagingUiSmokeJob, "Wait for infra staging qualification and write UI smoke evidence", "VPS staging UI smoke must wait for the protected infra qualification.");
requireText(vpsStagingUiSmokeJob, "run: node scripts/pr_vps_staging_qualification.mjs", "VPS staging UI smoke must use the delegated qualification evidence helper.");
requireText(vpsStagingUiSmokeJob, "NUTSNEWS_INFRA_STAGING_TOKEN", "VPS staging UI smoke must read infra qualification evidence through the staging token.");
requireText(vpsStagingUiSmokeJob, "NUTSNEWS_VPS_STAGING_INFRA_RUN_ID: ${{ needs.deploy-vps-staging.outputs.infra_run_id }}", "VPS staging UI smoke must bind qualification evidence to the VPS staging infra run.");
requireText(vpsStagingUiSmokeJob, "NUTSNEWS_UI_SMOKE_TARGET_TYPE: vps-staging", "VPS staging UI smoke evidence must use the vps-staging target type.");
requireText(vpsStagingUiSmokeJob, "NUTSNEWS_UI_SMOKE_SOURCE_COMMIT: ${{ needs.pr-release-artifact.outputs.source_commit }}", "VPS staging UI smoke must bind source commit evidence to the PR artifact.");
requireText(vpsStagingUiSmokeJob, "NUTSNEWS_UI_SMOKE_BUILD_ID: ${{ needs.pr-release-artifact.outputs.build_id }}", "VPS staging UI smoke must bind build evidence to the PR artifact.");
requireText(vpsStagingUiSmokeJob, "NUTSNEWS_UI_SMOKE_DEPLOYMENT_ID: ${{ needs.deploy-vps-staging.outputs.deployment_id }}", "VPS staging UI smoke must bind evidence to the VPS staging deployment ID.");
requireText(vpsStagingUiSmokeJob, "web/test-results/deployed-ui-smoke", "VPS staging UI smoke must upload standardized evidence output.");
for (const fragment of [
  "findInfraStagingQualification",
  "writeDelegatedVpsStagingSmokeEvidence",
  "staging-qualification-${deploymentId}-",
  "writeUiSmokeEvidence",
]) {
  requireText(prVpsStagingQualification, fragment, `Delegated VPS staging qualification helper must implement ${fragment}.`);
}
for (const fragment of ["findInfraStagingQualification", "concluded failure", "staging-qualification-${deploymentId}-"]) {
  requireText(prVpsStagingQualificationTest, fragment, `Delegated VPS staging qualification regression must cover ${fragment}.`);
}
requireText(vercelStagingDeployJob, "name: Deploy PR candidate to Vercel staging", "PR pipeline must include the Vercel staging deploy stage.");
requireText(vercelStagingDeployJob, "needs: [ui-smoke-vps-staging, deploy-vps-staging, pr-release-artifact, trusted-pr-deployment-eligibility]", "Vercel staging deploy must wait for VPS staging UI smoke.");
requireText(vercelStagingDeployJob, "timeout-minutes: 30", "Vercel staging deploy must have an explicit timeout.");
requireText(vercelStagingDeployJob, "ref: ${{ needs.pr-release-artifact.outputs.source_commit }}", "Vercel staging deploy must checkout the exact PR artifact source commit.");
requireText(vercelStagingDeployJob, "vercel@latest deploy", "Vercel staging deploy must use the Vercel CLI deploy path.");
requireText(vercelStagingDeployJob, "--target \"$VERCEL_STAGING_TARGET\"", "Vercel staging deploy must target the configured staging environment.");
requireText(vercelStagingDeployJob, "NUTSNEWS_DEPLOYMENT_TARGET=vercel-staging", "Vercel staging deploy must stamp the staging runtime target.");
requireText(vercelStagingDeployJob, "node scripts/pr_vercel_staging_deploy.mjs", "Vercel staging deploy must use the tested validation and evidence helper.");
requireText(vercelStagingDeployJob, "Upload Vercel staging deploy evidence", "Vercel staging deploy must retain deploy evidence.");
requireText(containerWorkflow, "node --test tests/pr-vercel-staging-deploy.test.mjs", "Release candidate must run PR Vercel staging deployment tests.");
requireText(vercelStagingUiSmokeJob, "name: UI smoke Vercel staging", "PR pipeline must include the Vercel staging UI smoke stage.");
requireText(vercelStagingUiSmokeJob, "needs: [deploy-vercel-staging, ui-smoke-vps-staging, pr-release-artifact, trusted-pr-deployment-eligibility]", "Vercel staging UI smoke must run after the Vercel staging deploy.");
requireText(vercelStagingUiSmokeJob, "timeout-minutes: 20", "Vercel staging UI smoke must have an explicit timeout.");
requireText(vercelStagingUiSmokeJob, "Verify Vercel staging identity before browser tests", "Vercel staging UI smoke must preflight runtime identity.");
requireText(vercelStagingUiSmokeJob, "verifyVercelStagingRuntime", "Vercel staging UI smoke must verify source, build, and target identity before browser tests.");
requireText(vercelStagingUiSmokeJob, "PLAYWRIGHT_BASE_URL: ${{ needs.deploy-vercel-staging.outputs.target_url }}", "Vercel staging UI smoke must target the deploy job URL.");
requireText(vercelStagingUiSmokeJob, "NUTSNEWS_UI_SMOKE_TARGET_TYPE: vercel-staging", "Vercel staging UI smoke evidence must use the vercel-staging target type.");
requireText(vercelStagingUiSmokeJob, "VERCEL_AUTOMATION_BYPASS_SECRET", "Vercel staging UI smoke must support deployment protection bypass.");
requireText(vercelStagingUiSmokeJob, "run: node ../scripts/run_deployed_ui_smoke_with_evidence.mjs", "Vercel staging UI smoke must use the standardized evidence runner.");
requireText(vercelStagingUiSmokeJob, "web/test-results/deployed-ui-smoke", "Vercel staging UI smoke must upload standardized evidence output.");
requireText(vercelProductionDeployJob, "name: Deploy PR candidate to Vercel production", "PR pipeline must include the Vercel production deploy stage.");
requireText(vercelProductionDeployJob, "needs: [ui-smoke-vercel-staging, deploy-vercel-staging, pr-release-artifact, trusted-pr-deployment-eligibility]", "Vercel production deploy must wait for Vercel staging UI smoke.");
requireText(vercelProductionDeployJob, "environment: Production", "Vercel production deploy must use the protected Production environment.");
requireText(vercelProductionDeployJob, "timeout-minutes: 35", "Vercel production deploy must have an explicit timeout.");
requireText(vercelProductionDeployJob, "ref: ${{ needs.pr-release-artifact.outputs.source_commit }}", "Vercel production deploy must checkout the exact PR artifact source commit.");
requireText(vercelProductionDeployJob, "vercel@latest deploy", "Vercel production deploy must use the Vercel CLI deploy path.");
requireText(vercelProductionDeployJob, "--prod", "Vercel production deploy must create a production deployment.");
requireText(vercelProductionDeployJob, "--skip-domain", "Vercel production deploy must stage before promotion.");
requireText(vercelProductionDeployJob, "vercel@latest promote \"$VERCEL_DEPLOYMENT_ID\"", "Vercel production deploy must promote the validated deployment.");
requireText(vercelProductionDeployJob, "NUTSNEWS_DEPLOYMENT_TARGET=vercel-production", "Vercel production deploy must stamp the production runtime target.");
requireText(vercelProductionDeployJob, "node scripts/pr_vercel_production_deploy.mjs", "Vercel production deploy must use the tested validation and evidence helper.");
requireText(vercelProductionDeployJob, "Upload Vercel production deploy evidence", "Vercel production deploy must retain deploy evidence.");
requireText(containerWorkflow, "node --test tests/pr-vercel-production-deploy.test.mjs", "Release candidate must run PR Vercel production deployment tests.");
requireText(vercelProductionUiSmokeJob, "name: UI smoke Vercel production", "PR pipeline must include the Vercel production UI smoke stage.");
requireText(vercelProductionUiSmokeJob, "needs: [deploy-vercel-production, ui-smoke-vercel-staging, pr-release-artifact, trusted-pr-deployment-eligibility]", "Vercel production UI smoke must run after the Vercel production deploy.");
requireText(vercelProductionUiSmokeJob, "environment: Production", "Vercel production UI smoke must use the protected Production environment.");
requireText(vercelProductionUiSmokeJob, "timeout-minutes: 20", "Vercel production UI smoke must have an explicit timeout.");
requireText(vercelProductionUiSmokeJob, "Verify Vercel production identity before browser tests", "Vercel production UI smoke must preflight runtime identity.");
requireText(vercelProductionUiSmokeJob, "verifyVercelProductionRuntime", "Vercel production UI smoke must verify source, build, and target identity before browser tests.");
requireText(vercelProductionUiSmokeJob, "PLAYWRIGHT_BASE_URL: ${{ needs.deploy-vercel-production.outputs.target_url }}", "Vercel production UI smoke must target the production deploy URL.");
requireText(vercelProductionUiSmokeJob, "NUTSNEWS_UI_SMOKE_TARGET_TYPE: vercel-production", "Vercel production UI smoke evidence must use the vercel-production target type.");
requireText(vercelProductionUiSmokeJob, 'NUTSNEWS_PRODUCTION_SAFE_SURFACES: "true"', "Vercel production UI smoke must use the safe production smoke profile.");
requireText(vercelProductionUiSmokeJob, "run: node ../scripts/run_deployed_ui_smoke_with_evidence.mjs", "Vercel production UI smoke must use the standardized evidence runner.");
requireText(vercelProductionUiSmokeJob, "web/test-results/deployed-ui-smoke", "Vercel production UI smoke must upload standardized evidence output.");
requireText(vpsProductionDeployJob, "name: Deploy PR candidate to VPS production", "PR pipeline must include the VPS production deploy stage.");
requireText(vpsProductionDeployJob, "needs: [ui-smoke-vercel-production, deploy-vercel-production, pr-release-artifact, trusted-pr-deployment-eligibility]", "VPS production deploy must wait for Vercel production UI smoke.");
requireText(vpsProductionDeployJob, "environment: Production", "VPS production deploy must use the protected Production environment.");
requireText(vpsProductionDeployJob, "timeout-minutes: 35", "VPS production deploy must have an explicit timeout.");
requireText(vpsProductionDeployJob, "NUTSNEWS_INFRA_PRODUCTION_TOKEN", "VPS production deploy must use the production infra token.");
requireText(vpsProductionDeployJob, "node scripts/pr_vps_production_deploy.mjs", "VPS production deploy must use the tested validation and evidence helper.");
requireText(vpsProductionDeployJob, "Upload VPS production deploy evidence", "VPS production deploy must retain deploy evidence.");
requireText(containerWorkflow, "node --test tests/pr-vps-production-deploy.test.mjs", "Release candidate must run PR VPS production deployment tests.");
requireText(vpsProductionUiSmokeJob, "name: UI smoke VPS production", "PR pipeline must include the VPS production UI smoke stage.");
requireText(vpsProductionUiSmokeJob, "needs: [deploy-vps-production, ui-smoke-vercel-production, pr-release-artifact, trusted-pr-deployment-eligibility]", "VPS production UI smoke must run after the VPS production deploy.");
requireText(vpsProductionUiSmokeJob, "environment: Production", "VPS production UI smoke must use the protected Production environment.");
requireText(vpsProductionUiSmokeJob, "timeout-minutes: 20", "VPS production UI smoke must have an explicit timeout.");
requireText(vpsProductionUiSmokeJob, "Verify VPS production identity before browser tests", "VPS production UI smoke must preflight runtime identity.");
requireText(vpsProductionUiSmokeJob, "verifyVpsProductionRuntime", "VPS production UI smoke must verify source, build, image, and target identity before browser tests.");
requireText(vpsProductionUiSmokeJob, "PLAYWRIGHT_BASE_URL: ${{ needs.deploy-vps-production.outputs.target_url }}", "VPS production UI smoke must target the VPS production deploy URL.");
requireText(vpsProductionUiSmokeJob, "NUTSNEWS_UI_SMOKE_TARGET_TYPE: production-vps", "VPS production UI smoke evidence must use the production-vps target type.");
requireText(vpsProductionUiSmokeJob, "NUTSNEWS_UI_SMOKE_DEPLOYMENT_ID: ${{ needs.deploy-vps-production.outputs.deployment_id }}", "VPS production UI smoke must bind evidence to the VPS production deployment ID.");
requireText(vpsProductionUiSmokeJob, 'NUTSNEWS_PRODUCTION_SAFE_SURFACES: "true"', "VPS production UI smoke must use the safe production smoke profile.");
requireText(vpsProductionUiSmokeJob, "CF_ACCESS_CLIENT_ID", "VPS production UI smoke must support protected VPS auth headers.");
requireText(vpsProductionUiSmokeJob, "run: node ../scripts/run_deployed_ui_smoke_with_evidence.mjs", "VPS production UI smoke must use the standardized evidence runner.");
requireText(vpsProductionUiSmokeJob, "web/test-results/deployed-ui-smoke", "VPS production UI smoke must upload standardized evidence output.");
requireText(preMergeDeploymentGateJob, "name: Pre-merge deployment gate", "PR pipeline must expose the final pre-merge deployment gate check.");
requireText(preMergeDeploymentGateJob, "if: always() && github.event_name == 'pull_request'", "Final pre-merge gate must run even when upstream deployment stages fail.");
requireText(preMergeDeploymentGateJob, "needs: [trusted-pr-deployment-eligibility, pr-release-artifact, deploy-vps-staging, ui-smoke-vps-staging, deploy-vercel-staging, ui-smoke-vercel-staging, deploy-vercel-production, ui-smoke-vercel-production, deploy-vps-production, ui-smoke-vps-production]", "Final pre-merge gate must depend on all deploy and UI smoke stages.");
requireText(preMergeDeploymentGateJob, "actions: read", "Final pre-merge gate must be able to read retained workflow artifacts.");
requireText(preMergeDeploymentGateJob, "Summarize intentionally ineligible PR", "Final pre-merge gate must pass intentionally ineligible PRs without deployment evidence.");
requireText(preMergeDeploymentGateJob, "PRE_MERGE_DEPLOYMENT_GATE_STAGES_JSON", "Final pre-merge gate must receive ordered stage result and artifact inputs.");
requireText(preMergeDeploymentGateJob, "node scripts/pre_merge_deployment_gate.mjs", "Final pre-merge gate must use the tested evidence validator.");
requireText(preMergeDeploymentGateJob, "Upload pre-merge deployment gate evidence", "Final pre-merge gate must retain its aggregate evidence.");
requireText(containerWorkflow, "node --test tests/pre-merge-deployment-gate.test.mjs", "Release candidate must run final pre-merge deployment gate tests.");

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

requireText(releaseWorkflow, "name: Manual VPS Staging Recovery Dispatch", "Staging workflow must be clearly named as manual recovery.");
requireText(releaseWorkflow, "workflow_dispatch:", "Staging recovery must require explicit operator dispatch.");
assert.ok(!releaseWorkflow.includes("workflow_run:"), "Staging recovery must not run after Container Image completes on main.");
assert.ok(!releaseWorkflow.includes("github.event.workflow_run"), "Staging recovery must not read post-main workflow_run payloads.");
requireText(releaseWorkflow, "request-vps-staging-recovery", "Staging recovery must require typed confirmation.");
requireText(releaseWorkflow, "NUTSNEWS_INFRA_STAGING_TOKEN", "Manual staging recovery must use the staging-only token.");
requireText(releaseWorkflow, "nutsnews-staging-release", "Manual staging recovery dispatch must request staging only.");
requireText(releaseWorkflow, "https://api.github.com/repos/ramideltoro/nutsnews-infra/dispatches", "Manual staging recovery must target only nutsnews-infra.");
requireText(releaseWorkflow, 'event_type: "nutsnews-staging-release"', "Manual staging recovery must use the staging dispatch event.");
requireText(releaseWorkflow, "source_commit", "Manual staging recovery candidate must include source commit.");
requireText(releaseWorkflow, "source_workflow_run_id: buildId.split", "Manual staging recovery candidate must derive the source workflow run from the build ID.");
requireText(releaseWorkflow, "image_digest", "Manual staging recovery candidate must include the immutable image digest.");
requireText(releaseWorkflow, "migration_head", "Manual staging recovery candidate must include migration head.");
requireText(releaseWorkflow, "supabase_project_ref", "Manual staging recovery candidate must include production Supabase project ref.");
requireText(releaseWorkflow, "operator recovery path only", "Staging recovery summary must say it is not the normal release path.");
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
requireText(vercelProductionWorkflow, "Dispatch-only Vercel Production Recovery", "Vercel production workflow name must describe dispatch-only recovery.");
requireText(vercelProductionWorkflow, "not triggered by pushes to main", "Vercel production summary must document that main merges do not trigger it.");
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
assert.ok(workflowNames.includes("vercel-production-release.yml"), "Vercel production must be an explicit dispatch-only recovery workflow.");
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
