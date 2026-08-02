#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = resolve(root, ".github/workflows");
const automaticReleaseWorkflow = await readFile(resolve(workflowDir, "automatic-production-release.yml"), "utf8");
const containerWorkflow = await readFile(resolve(workflowDir, "container-image.yml"), "utf8");
const databaseWorkflow = await readFile(resolve(workflowDir, "database-migration-gate.yml"), "utf8");
const vercelRecoveryWorkflow = await readFile(resolve(workflowDir, "vercel-production-release.yml"), "utf8");
const stagingEvidenceVerifier = await readFile(
  resolve(root, "scripts/staging_qualification_admin_backend_evidence.mjs"),
  "utf8",
);
const inventory = await readFile(resolve(root, ".github/deployment/workflow-check-inventory.md"), "utf8");
const recoveryRunbook = await readFile(resolve(root, ".github/deployment/environments-secrets-recovery.md"), "utf8");

const removedPrJobs = [
  "trusted-pr-deployment-eligibility",
  "pr-release-artifact",
  "deploy-vps-staging",
  "ui-smoke-vps-staging",
  "deploy-vercel-staging",
  "ui-smoke-vercel-staging",
  "deploy-vercel-production",
  "ui-smoke-vercel-production",
  "deploy-vps-production",
  "ui-smoke-vps-production",
  "pre-merge-deployment-gate",
  "release-candidate",
];

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

function workflowJob(text, name) {
  const marker = `  ${name}:\n`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `Workflow job not found: ${name}`);
  const rest = text.slice(start + marker.length);
  const next = rest.search(/\n  [A-Za-z0-9_-]+:\n/);
  return text.slice(start, next === -1 ? text.length : start + marker.length + next);
}

function triggerBlock(workflowText) {
  return workflowText.match(/(?:^|\n)on:[^\n]*\n([\s\S]*?)(?=\n[a-zA-Z_][A-Za-z0-9_-]*:|$)/)?.[1] ?? "";
}

function hasAutomaticPostMainDeploymentTrigger(workflowName, workflowText) {
  if (workflowName === "container-image.yml") return false;
  const triggers = triggerBlock(workflowText);
  const mutatesDeploymentTarget = /repos\/ramideltoro\/nutsnews-infra\/dispatches|vercel@latest deploy|run:\s+node scripts\/cloudflare_purge_cache\.mjs|CLOUDFLARE_PURGE_EVERYTHING|NUTSNEWS_INFRA_(?:STAGING|PRODUCTION)_TOKEN/.test(workflowText);
  if (!mutatesDeploymentTarget) return false;

  const workflowRunFromMain = /workflow_run:/.test(triggers) && /head_branch\s*==\s*'main'/.test(workflowText);
  const deploymentStatusTrigger = /deployment_status:/.test(triggers);
  const mainPushTrigger = /push:[\s\S]*?branches:\s*(?:\[(?:"main"|main)\]|\n\s*-\s*main\b)/.test(triggers);
  return workflowRunFromMain || deploymentStatusTrigger || mainPushTrigger;
}

assert.doesNotMatch(containerWorkflow, /^\s+pull_request:/m, "Container Image must not run for ordinary pull requests.");
requireText(containerWorkflow, "push:\n    branches: [main]", "Container Image must still run from main pushes.");
requireText(containerWorkflow, "workflow_dispatch:", "Container Image must support explicit operator dispatch.");
requireText(containerWorkflow, "cancel-in-progress: false", "Main image archive runs must not cancel each other implicitly.");
assert.doesNotMatch(containerWorkflow, /github\.event\.pull_request/, "Container Image must not depend on pull request event payloads.");
assert.doesNotMatch(containerWorkflow, /^\s+environment:\s+Production\b/m, "Container Image must not invoke the protected Production environment.");
assert.doesNotMatch(containerWorkflow, /^  migration-gate:/m, "Container Image must not own database migration validation.");

for (const job of removedPrJobs) {
  assert.doesNotMatch(containerWorkflow, new RegExp(`^  ${job}:`, "m"), `Container Image must not contain removed PR job ${job}.`);
}

const buildTest = workflowJob(containerWorkflow, "build-test");
requireText(buildTest, "name: Build and smoke-test production image", "Container Image must keep image build and smoke coverage.");
requireText(buildTest, "docker build", "Container Image must still build the web image.");
requireText(buildTest, "docker push \"$IMAGE_TAG\"", "Container Image must still verify the image through a registry round trip.");
requireText(buildTest, "node scripts/dual_target_web_smoke.mjs", "Container Image must still smoke the built image.");
requireText(buildTest, "getMigrationContract", "Container Image must derive its fixture migration head from the repository contract.");
requireText(buildTest, "readApplicationMigrationContract", "Container Image must derive its fixture schema marker from the application contract.");
requireText(buildTest, "FIXTURE_MIGRATION_HEAD", "Container Image must pass the derived migration head to its readiness fixture.");
requireText(buildTest, "FIXTURE_SCHEMA_VERSION", "Container Image must pass the derived schema marker to fixture containers.");
assert.doesNotMatch(
  buildTest,
  /migration_head\\?\"?:\\?\"?[0-9]{14}/,
  "Container Image must not hard-code a migration head in its readiness fixture.",
);
assert.doesNotMatch(
  buildTest,
  /NUTSNEWS_EXPECTED_SCHEMA_VERSION=[0-9]{14}/,
  "Container Image must not hard-code the application schema marker.",
);

const publish = workflowJob(containerWorkflow, "publish");
requireText(publish, "name: Publish immutable image", "Container Image must still publish immutable images.");
requireText(publish, "if: github.event_name == 'push' && github.ref == 'refs/heads/main'", "Image publishing must be main-push only.");
requireText(publish, "needs: [build-test]", "Image publishing must depend only on the image build and smoke job.");
requireText(publish, "packages: write", "Image publishing must retain package write permission.");
requireText(publish, "ghcr.io/ramideltoro/nutsnews:${{ github.sha }}", "Image publishing must tag with the full source commit.");
requireText(publish, "push: true", "Image publishing must push the immutable image.");
requireText(publish, "Write automatic production release metadata", "Image publishing must write exact-run automatic release metadata.");
requireText(publish, "name: nutsnews-automatic-production-release", "Image publishing must retain automatic release metadata.");
requireText(publish, "source_workflow_run_id: sourceWorkflowRunId", "Release metadata must bind to the Container Image run.");
requireText(publish, "image_digest: digest", "Release metadata must contain the immutable image digest.");
requireText(publish, "migration_head: migrationContract.head", "Release metadata must contain the repository migration head.");
requireText(publish, "schema_version: applicationContract.legacyVersion", "Release metadata must contain the application schema marker.");
requireText(publish, "supabase_project_ref: productionSupabaseProjectRef", "Release metadata must contain the production project ref.");
requireText(publish, "Deployment role: automatic production release candidate.", "Image summary must describe the automatic release handoff.");

requireText(
  automaticReleaseWorkflow,
  "name: Request Automatic NutsNews Production Release",
  "The automatic release workflow must have a stable reader-facing name.",
);
requireText(automaticReleaseWorkflow, "workflow_run:", "Automatic release must start only after a trusted workflow completes.");
requireText(
  automaticReleaseWorkflow,
  "workflows:\n      - Container Image",
  "Automatic release must trust only Container Image completion.",
);
requireText(
  automaticReleaseWorkflow,
  "github.event.workflow_run.conclusion == 'success'",
  "Automatic release must require successful image build completion.",
);
requireText(
  automaticReleaseWorkflow,
  "github.event.workflow_run.event == 'push'",
  "Automatic release must reject manual and pull-request Container Image runs.",
);
requireText(
  automaticReleaseWorkflow,
  "github.event.workflow_run.head_branch == 'main'",
  "Automatic release must require the main branch.",
);
requireText(
  automaticReleaseWorkflow,
  "github.event.workflow_run.head_repository.full_name == github.repository",
  "Automatic release must reject another repository's workflow run.",
);
requireText(automaticReleaseWorkflow, "actions: read", "Automatic release needs only read access to Actions artifacts.");
requireText(automaticReleaseWorkflow, "contents: read", "Automatic release must keep repository contents read-only.");
requireText(
  automaticReleaseWorkflow,
  "environment: automatic-release",
  "Automatic handoff must run only from the protected default-branch release environment.",
);
assert.doesNotMatch(
  automaticReleaseWorkflow,
  /^\s+environment:\s+(?:Production|production-vps)\b/m,
  "Automatic handoff must not attach a production environment before staging qualification.",
);
assert.doesNotMatch(
  automaticReleaseWorkflow,
  /^\s+workflow_dispatch:/m,
  "Automatic handoff must not expose a manual trigger that bypasses its exact-run checks.",
);
requireText(
  automaticReleaseWorkflow,
  "SOURCE_WORKFLOW_RUN_ID: ${{ github.event.workflow_run.id }}",
  "Automatic release metadata must come from the triggering Container Image run.",
);
requireText(
  automaticReleaseWorkflow,
  "SOURCE_COMMIT: ${{ github.event.workflow_run.head_sha }}",
  "Automatic release metadata must match the triggering main commit.",
);
requireText(
  automaticReleaseWorkflow,
  "Object.keys(release).sort().join",
  "Automatic release must reject unexpected metadata fields.",
);
requireText(
  automaticReleaseWorkflow,
  "NUTSNEWS_INFRA_STAGING_TOKEN",
  "Automatic release must use only the staging dispatch token for its cross-repository handoff.",
);
requireText(
  automaticReleaseWorkflow,
  'event_type: "nutsnews-staging-release"',
  "Automatic release must enter the existing staging qualification chain.",
);
requireText(
  automaticReleaseWorkflow,
  "The infra chain will deploy VPS staging, run qualification, apply VPS production, deploy Vercel production, and roll back VPS automatically if Vercel promotion fails.",
  "Automatic release summary must describe the complete protected release chain.",
);

requireText(inventory, "`container-image.yml` | default-branch/manual", "Inventory must classify Container Image outside PR-required checks.");
requireText(inventory, "`automatic-production-release.yml` | automatic release", "Inventory must classify the dedicated automatic release workflow.");
requireText(inventory, "Ordinary PRs do not enter this workflow", "Inventory must document the removed PR container path.");
requireText(inventory, "`database-migration-gate.yml` | PR-required", "Inventory must classify Database Migration Gate as the database PR check.");
requireText(
  recoveryRunbook,
  "Every successful same-repository merge to `main` now enters the automatic production release chain",
  "Deployment docs must document the automatic main release behavior.",
);
requireText(databaseWorkflow, "name: Database Migration Gate", "Database workflow must have a stable check name.");
requireText(databaseWorkflow, "pull_request:", "Database workflow must still run for migration PRs.");
requireText(databaseWorkflow, "paths:", "Database workflow must be path-filtered.");
requireText(databaseWorkflow, "supabase/**", "Database workflow must run for Supabase migration changes.");
requireText(databaseWorkflow, "supabase db reset --local", "Database workflow must reset a disposable database.");
requireText(databaseWorkflow, "node scripts/verify_migration_schema.mjs --negative-drift", "Database workflow must verify migration drift.");
requireText(databaseWorkflow, "node scripts/verify_migration_lock.mjs", "Database workflow must verify advisory-lock serialization.");
requireText(databaseWorkflow, "node scripts/staging_fixtures.mjs exercise --local", "Database workflow must validate staging fixtures.");
requireText(databaseWorkflow, "node scripts/supabase_rls_regression.mjs", "Database workflow must validate RLS policies.");
requireText(databaseWorkflow, "tests/staging-migration-request.test.mjs", "Database workflow must run staging migration request tests.");
requireText(databaseWorkflow, "tests/production-migration-request.test.mjs", "Database workflow must run production migration request tests.");

requireText(
  vercelRecoveryWorkflow,
  "name: Deploy Vercel Production Release",
  "Vercel production must be named as the protected release stage.",
);
requireText(
  vercelRecoveryWorkflow,
  "This workflow accepts only repository_dispatch requests from the protected infra release/recovery chain.",
  "Vercel production must document its protected infra dispatch boundary.",
);
requireText(
  vercelRecoveryWorkflow,
  "NUTSNEWS_VERCEL_SECONDARY_PRODUCTION_URLS",
  "Vercel production release must expose secondary Vercel target configuration.",
);
requireText(
  vercelRecoveryWorkflow,
  "RELEASE_KIND: ${{ github.event.client_payload.release_kind || 'release' }}",
  "Vercel production release must default omitted release_kind payloads to release.",
);
requireText(
  vercelRecoveryWorkflow,
  "NUTSNEWS_VERIFY_VERCEL_FAILOVER_ALIASES",
  "Vercel production release must require an explicit flag before checking failover aliases.",
);
requireText(
  vercelRecoveryWorkflow,
  "NUTSNEWS_VERCEL_FAILOVER_PRODUCTION_ALIASES",
  "Vercel production release must name controlled failover aliases separately from secondary targets.",
);
for (const identityFlag of [
  '--build-env "NUTSNEWS_EXPECTED_BUILD_ID=$BUILD_ID"',
  '--build-env "NUTSNEWS_EXPECTED_SOURCE_COMMIT=$SOURCE_COMMIT"',
  '--build-env "NUTSNEWS_CONFIG_GENERATION=$VERCEL_CONFIG_GENERATION"',
  '--build-env "NUTSNEWS_DATABASE_PROVIDER_MODE=$DATABASE_PROVIDER_MODE"',
  '--build-env "NUTSNEWS_DEPLOYMENT_TARGET=vercel-production"',
  '--env "NUTSNEWS_EXPECTED_BUILD_ID=$BUILD_ID"',
  '--env "NUTSNEWS_EXPECTED_SOURCE_COMMIT=$SOURCE_COMMIT"',
  '--env "NUTSNEWS_CONFIG_GENERATION=$VERCEL_CONFIG_GENERATION"',
  '--env "NUTSNEWS_DATABASE_PROVIDER_MODE=$DATABASE_PROVIDER_MODE"',
  '--env "NUTSNEWS_DEPLOYMENT_TARGET=vercel-production"',
]) {
  requireText(
    vercelRecoveryWorkflow,
    identityFlag,
    `Vercel production release must preserve the exact staged identity flag: ${identityFlag}`,
  );
}
for (const smokeFlag of [
  '--expected-source-commit "$SOURCE_COMMIT"',
  '--expected-build-id "$BUILD_ID"',
  "--expected-deployment-target vercel-production",
  '--expected-database-provider-mode "$DATABASE_PROVIDER_MODE"',
  '--expected-config-generation "$VERCEL_CONFIG_GENERATION"',
]) {
  requireText(
    vercelRecoveryWorkflow,
    smokeFlag,
    `Vercel production smoke must bind its expected identity: ${smokeFlag}`,
  );
}
requireText(
  vercelRecoveryWorkflow,
  "staging_qualification_admin_backend_evidence.mjs",
  "Vercel production release must verify staging admin backend operation evidence before staging Vercel.",
);
requireText(
  vercelRecoveryWorkflow,
  '`${process.env.RUNNER_TEMP}/staging_qualification_admin_backend_evidence.mjs`',
  "Vercel production release must export the reviewed staging evidence verifier outside the exact app checkout.",
);
requireText(
  vercelRecoveryWorkflow,
  '"scripts/dual_target_web_smoke_contract.mjs",',
  "Vercel production release must export the readiness-body contract beside the reviewed smoke helper.",
);
requireText(
  vercelRecoveryWorkflow,
  '`${process.env.RUNNER_TEMP}/dual_target_web_smoke_contract.mjs`',
  "Vercel production release must place the readiness-body contract beside the exported smoke helper.",
);
requireText(
  vercelRecoveryWorkflow,
  'node --check "$RUNNER_TEMP/dual_target_web_smoke_contract.mjs"',
  "Vercel production release must syntax-check the exported readiness-body contract.",
);
requireText(
  vercelRecoveryWorkflow,
  'node "$RUNNER_TEMP/staging_qualification_admin_backend_evidence.mjs"',
  "Vercel production release must execute the reviewed staging evidence verifier.",
);
requireText(
  vercelRecoveryWorkflow,
  "NUTSNEWS_ADMIN_BACKEND_OPERATION_CONTRACT: ${{ github.workspace }}/api-contracts/admin-backend-operations.json",
  "Vercel production release must bind the reviewed verifier to the exact app contract checkout.",
);
assert.doesNotMatch(
  vercelRecoveryWorkflow,
  /node scripts\/staging_qualification_admin_backend_evidence\.mjs/,
  "Vercel production release must not execute the staging evidence verifier from the exact app checkout.",
);
requireText(
  vercelRecoveryWorkflow,
  "NUTSNEWS_INFRA_STAGING_TOKEN is required to verify staging qualification admin backend evidence",
  "Vercel production release must require the infra staging token for release evidence verification.",
);
requireText(
  stagingEvidenceVerifier,
  'accept = "application/vnd.github+json"',
  "Staging qualification artifact downloads must use GitHub's supported API media type.",
);
assert.doesNotMatch(
  stagingEvidenceVerifier,
  /application\/zip/,
  "Staging qualification artifact downloads must not request the unsupported application/zip media type.",
);
for (const required of [
  'execFileSync(\n      "gh"',
  "GH_TOKEN: token",
  'GH_PROMPT_DISABLED: "true"',
  'stdio: ["ignore", "pipe", "ignore"]',
  "maxBuffer: 16 * 1024 * 1024",
]) {
  requireText(
    stagingEvidenceVerifier,
    required,
    `Staging qualification artifact downloads must enforce the isolated gh API boundary: ${required}`,
  );
}
requireText(
  stagingEvidenceVerifier,
  'const evidenceEntry = "qualification-evidence/app/staging-qualification.json";',
  "Staging qualification verification must select the qualified app report rather than a same-named wrapper.",
);
requireText(
  stagingEvidenceVerifier,
  "entries.includes(evidenceEntry)",
  "Staging qualification verification must fail closed when the canonical app report is absent.",
);
requireText(
  stagingEvidenceVerifier,
  "process.env.NUTSNEWS_ADMIN_BACKEND_OPERATION_CONTRACT || defaultContractPath",
  "Staging qualification verification must accept the workflow-bound app contract path.",
);
requireText(
  vercelRecoveryWorkflow,
  "vps_staging_admin_backend_smoke_result",
  "Vercel production release evidence must record the staging admin backend smoke result.",
);
requireText(
  vercelRecoveryWorkflow,
  "Run Vercel production admin backend operation smoke",
  "Vercel production release must run admin backend smoke before promotion when backend primary is active.",
);
requireText(
  vercelRecoveryWorkflow,
  "npm run smoke:admin-backend-operations",
  "Vercel production release must use the canonical admin backend operation smoke command.",
);
requireText(
  vercelRecoveryWorkflow,
  "vercel_admin_backend_smoke_result",
  "Vercel production release evidence must record the Vercel admin backend smoke result.",
);
assert(
  vercelRecoveryWorkflow.indexOf("Run staged Vercel qualification smoke")
    < vercelRecoveryWorkflow.indexOf("Run Vercel production admin backend operation smoke")
    && vercelRecoveryWorkflow.indexOf("Run Vercel production admin backend operation smoke")
      < vercelRecoveryWorkflow.indexOf("Promote staged Vercel deployment after qualification"),
  "Vercel admin backend smoke must run after staged smoke and before promotion.",
);
requireText(
  recoveryRunbook,
  "passing admin backend operation smoke results",
  "Recovery docs must require staging admin backend smoke evidence for Vercel production release payloads.",
);
assert.doesNotMatch(
  vercelRecoveryWorkflow,
  /"https:\/\/www\.nutsnews\.com\/healthz"|"https:\/\/nutsnews\.com\/healthz"/,
  "Vercel production release must not hard-code apex/www health checks as normal validation targets.",
);

const workflowNames = (await readdir(workflowDir)).filter((name) => name.endsWith(".yml")).sort();
const automaticPostMainDeploymentTriggers = [];
const customMainMergeWorkflows = [];
for (const workflowName of workflowNames) {
  const workflowText = await readFile(resolve(workflowDir, workflowName), "utf8");
  if (/git\s+push[^\n]*(?:origin\s+)?main\b|gh\s+pr\s+merge|pulls\/\$\{[^}]+}\/merge|enable-pull-request-automerge|automerge-action/i.test(workflowText)) {
    customMainMergeWorkflows.push(workflowName);
  }
  if (hasAutomaticPostMainDeploymentTrigger(workflowName, workflowText)) {
    automaticPostMainDeploymentTriggers.push(workflowName);
  }
}

assert.deepEqual(customMainMergeWorkflows, [], "Merge handoff must use maintainer merge or GitHub native auto-merge, not a custom workflow that pushes or merges to main.");
assert.deepEqual(
  automaticPostMainDeploymentTriggers,
  ["automatic-production-release.yml"],
  "Exactly one reviewed workflow must own automatic deployment after a successful main build.",
);

console.log("Production release workflow regression passed.");
