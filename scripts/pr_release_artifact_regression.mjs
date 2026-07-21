#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const containerWorkflow = await readFile(resolve(root, ".github/workflows/container-image.yml"), "utf8");
const contract = await readFile(resolve(root, ".github/deployment/pre-merge-deployment-gate-contract.md"), "utf8");

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

const buildTestJob = workflowJob(containerWorkflow, "build-test");
const artifactJob = workflowJob(containerWorkflow, "pr-release-artifact");

requireText(
  buildTestJob,
  "repository: ${{ github.event.pull_request.head.repo.full_name || github.repository }}",
  "Build-test must check out the PR head repository when validating pull requests.",
);
requireText(
  buildTestJob,
  "ref: ${{ github.event.pull_request.head.sha || github.sha }}",
  "Build-test must build the exact PR head SHA.",
);
requireText(
  buildTestJob,
  "SOURCE_COMMIT: ${{ github.event.pull_request.head.sha || github.sha }}",
  "Build-test source identity must use the PR head SHA.",
);

requireText(artifactJob, "name: Publish immutable PR release artifact", "PR release artifact job name must stay stable.");
requireText(
  artifactJob,
  "needs: [build-test, migration-gate, trusted-pr-deployment-eligibility]",
  "PR release artifact must depend on image, migration, and eligibility gates.",
);
requireText(
  artifactJob,
  "needs.trusted-pr-deployment-eligibility.outputs.eligible == 'true'",
  "PR release artifact must run only for eligible trusted PRs.",
);
requireText(artifactJob, "packages: write", "PR release artifact job must have scoped package write permission.");
requireText(artifactJob, "pull-requests: read", "PR release artifact job must re-read the current PR head.");
requireText(
  artifactJob,
  "Revalidate current PR head before publishing",
  "PR release artifact must re-check the live PR head before publishing.",
);
requireText(
  artifactJob,
  "currentHeadSha !== trustedHeadSha",
  "PR release artifact must fail closed when the PR head changed after eligibility.",
);
requireText(
  artifactJob,
  "ref: ${{ steps.revalidate.outputs.source_commit }}",
  "PR release artifact must check out the revalidated source commit.",
);
requireText(artifactJob, "docker/build-push-action", "PR release artifact must publish through Docker Buildx.");
requireText(artifactJob, "push: true", "PR release artifact must push the immutable image.");
requireText(
  artifactJob,
  "tags: ghcr.io/ramideltoro/nutsnews:${{ steps.revalidate.outputs.source_commit }}",
  "PR release artifact must use a full-SHA image tag.",
);
assert.doesNotMatch(
  artifactJob,
  /ghcr\.io\/ramideltoro\/nutsnews:latest|image_tag:\s*latest|tags:\s*.*latest/i,
  "PR release artifact must not use a mutable latest image tag.",
);
requireText(artifactJob, "metadata_json", "PR release artifact metadata must be emitted as a workflow output.");
requireText(artifactJob, "actions/upload-artifact", "PR release artifact metadata must be retained as an artifact.");
requireText(artifactJob, "retention-days: 7", "PR release artifact retention must be explicit.");
requireText(artifactJob, "artifact_kind: \"pr-release-candidate\"", "PR release artifact metadata must identify its kind.");
requireText(artifactJob, "image_digest: digest", "PR release artifact metadata must include the immutable image digest.");
requireText(artifactJob, "image: `${imageRepository}@${digest}`", "PR release artifact metadata must include the digest-qualified image.");

for (const fragment of [
  "PR Release Artifact",
  "Downstream deployment jobs must consume `needs.pr-release-artifact.outputs.metadata_json`",
  "The PR metadata artifact is retained for 7 days.",
  "PR images are tagged only with the full source commit SHA",
]) {
  requireText(contract, fragment, `Pre-merge deployment contract must document PR release artifacts: ${fragment}`);
}

console.log("PR release artifact regression passed.");
