#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const containerWorkflow = await read(".github/workflows/container-image.yml");
const auditWorkflow = await read(".github/workflows/main-ruleset-audit.yml");
const candidateStart = containerWorkflow.indexOf("  release-candidate:");
const candidateEnd = containerWorkflow.indexOf("\n  publish:", candidateStart);
assert.ok(candidateStart >= 0 && candidateEnd > candidateStart, "Release candidate job must be bounded by the publish job.");
const candidateJob = containerWorkflow.slice(candidateStart, candidateEnd);

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

function requirePattern(text, pattern, message) {
  assert.match(text, pattern, message);
}

requireText(containerWorkflow, "name: Container Image", "Container workflow name must stay stable for production promotion.");
requirePattern(
  containerWorkflow,
  /pull_request:\n\s+branches: \[main\]/,
  "Container Image must run for every pull request to main.",
);
assert.doesNotMatch(
  containerWorkflow,
  /pull_request:\n(?:.|\n)*?paths:/,
  "Container Image must not path-filter Release candidate away from a pull request.",
);
requireText(containerWorkflow, "name: Release candidate", "The required status check must be named exactly Release candidate.");
requireText(containerWorkflow, "needs: [build-test, migration-gate]", "Release candidate must depend on image and migration gates.");
requirePattern(candidateJob, /permissions:\n\s+contents: read/, "Release candidate must use only read-only repository contents access.");
requireText(
  containerWorkflow,
  "if: always() && github.event_name == 'pull_request'",
  "Release candidate must run and report failure when its prerequisite is not successful.",
);
requireText(
  candidateJob,
  "BUILD_TEST_RESULT: ${{ needs.build-test.result }}",
  "Release candidate must read its prerequisite result from this pull request run.",
);
requireText(
  candidateJob,
  "MIGRATION_GATE_RESULT: ${{ needs.migration-gate.result }}",
  "Release candidate must read the migration-gate result from this pull request run.",
);
requireText(
  candidateJob,
  'if [[ "$BUILD_TEST_RESULT" != "success" ]]',
  "Release candidate must fail when its image prerequisite is failed, cancelled, skipped, or missing.",
);
requireText(
  candidateJob,
  'if [[ "$MIGRATION_GATE_RESULT" != "success" ]]',
  "Release candidate must fail when migration validation is failed, cancelled, skipped, or missing.",
);
requireText(
  candidateJob,
  "ref: ${{ github.event.pull_request.head.sha }}",
  "Release candidate must validate the current pull request head rather than a stale checkout.",
);
requireText(
  candidateJob,
  "node scripts/production_release_workflow_regression.mjs",
  "Release candidate must verify release workflow changes in the same PR boundary.",
);
requireText(
  candidateJob,
  "node scripts/release_candidate_guard.mjs",
  "Release candidate must validate its own workflow contract.",
);
requireText(
  candidateJob,
  "node scripts/main_ruleset_audit_regression.mjs",
  "Release candidate must validate the main-ruleset audit contract.",
);
requireText(
  candidateJob,
  "node scripts/workflow_check_inventory_regression.mjs",
  "Release candidate must validate the workflow check inventory contract.",
);
requireText(
  candidateJob,
  "node scripts/trusted_pr_deployment_eligibility_regression.mjs",
  "Release candidate must validate the trusted PR deployment eligibility contract.",
);
requireText(
  candidateJob,
  "node scripts/pr_release_artifact_regression.mjs",
  "Release candidate must validate the immutable PR release artifact contract.",
);
requireText(
  candidateJob,
  "node scripts/deployed_ui_smoke_regression.mjs",
  "Release candidate must validate the target-agnostic deployed UI smoke contract.",
);
requireText(
  candidateJob,
  "node scripts/pre_merge_deployment_workflow_order_regression.mjs",
  "Release candidate must validate pre-merge deployment stage order and post-main trigger guardrails.",
);
requireText(
  candidateJob,
  "node scripts/environments_secrets_recovery_doc_regression.mjs",
  "Release candidate must validate the deployment environments, secrets, and recovery runbook.",
);
requireText(
  candidateJob,
  "node --test tests/protected-target-headers.test.mjs",
  "Release candidate must validate protected-target UI smoke headers.",
);
requireText(
  candidateJob,
  "node --test tests/deployed-ui-smoke-evidence.test.mjs",
  "Release candidate must validate deployed UI smoke evidence shape.",
);
requireText(
  candidateJob,
  "node --test tests/deployment-hardening.test.mjs",
  "Release candidate must validate deploy wait, retry, concurrency, and idempotency helpers.",
);
requireText(
  candidateJob,
  "node --test tests/pre-merge-deployment-gate.test.mjs",
  "Release candidate must validate the final pre-merge deployment gate evidence contract.",
);
requireText(
  candidateJob,
  "node --test tests/pr-vps-staging-deploy.test.mjs",
  "Release candidate must validate PR VPS staging deployment evidence and idempotency.",
);
requireText(
  candidateJob,
  "node --test tests/pr-vercel-staging-deploy.test.mjs",
  "Release candidate must validate PR Vercel staging deployment evidence and production-alias guards.",
);
requireText(
  candidateJob,
  "node --test tests/pr-vercel-production-deploy.test.mjs",
  "Release candidate must validate PR Vercel production deployment evidence and alias verification.",
);
requireText(
  candidateJob,
  "node --test tests/pr-vps-production-deploy.test.mjs",
  "Release candidate must validate PR VPS production deployment evidence and idempotency.",
);
requireText(
  candidateJob,
  "npm run test:translation-release-gate",
  "Release candidate must prove the translation audit fails missing, critical, and below-threshold fixtures.",
);
requireText(
  candidateJob,
  "npm run test:e2e:public-smoke",
  "Release candidate must include public reader language smoke coverage.",
);
requireText(
  candidateJob,
  "npx playwright install --with-deps chromium",
  "Release candidate must install Chromium before running public reader language smoke coverage.",
);
requireText(
  candidateJob,
  "npm run audit:translations",
  "Release candidate must run the strict translation audit.",
);
requireText(
  candidateJob,
  "TRANSLATION_QUALITY_FAIL_ON_CRITICAL=true",
  "Release candidate translation audit must fail on critical quality issues.",
);
requireText(
  candidateJob,
  "TRANSLATION_QUALITY_FAIL_ON_MISSING=true",
  "Release candidate translation audit must fail on missing translation rows.",
);
requireText(
  candidateJob,
  "TRANSLATION_QUALITY_MIN_COVERAGE=100",
  "Release candidate translation audit must require full fixture coverage.",
);
requireText(candidateJob, "./actionlint -color", "Release candidate must lint workflow changes.");
assert.doesNotMatch(candidateJob, /pull_request_target:|workflow_run:/, "Release candidate must not use privileged PR triggers.");
assert.doesNotMatch(candidateJob, /pull-requests:|contents:\s*write/, "Release candidate must not request unnecessary token permissions.");
assert.doesNotMatch(candidateJob, /secrets\./, "Release candidate must not read repository secrets.");

requireText(auditWorkflow, "name: Main ruleset audit", "Ruleset audit workflow must remain identifiable.");
requireText(auditWorkflow, "schedule:", "Ruleset audit must detect remote settings drift without a PR change.");
requireText(auditWorkflow, "workflow_dispatch:", "Ruleset audit must support an operator-triggered read-only check.");
assert.doesNotMatch(auditWorkflow, /pull_request:|pull_request_target:|workflow_run:/, "Ruleset audit must not expose its administration-read token to PR code.");
requireText(auditWorkflow, "NUTSNEWS_RULESET_AUDIT_TOKEN", "Ruleset audit must use its dedicated least-privilege credential.");
requireText(auditWorkflow, "Administration: read", "Ruleset audit must document its exact fine-grained permission.");
requireText(auditWorkflow, "node scripts/main_ruleset_audit.mjs", "Ruleset audit must run the live settings validator.");

console.log("Release candidate workflow guard passed.");
