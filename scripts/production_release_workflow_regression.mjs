import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const containerWorkflow = await readFile(resolve(root, ".github/workflows/container-image.yml"), "utf8");
const releaseWorkflow = await readFile(resolve(root, ".github/workflows/production-release.yml"), "utf8");

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

assert.doesNotMatch(containerWorkflow, /^\s+paths:\s*$/m, "Container Image must run for every main merge, not a path subset.");
requireText(containerWorkflow, "cancel-in-progress: false", "Container Image must not skip a merged release.");
requireText(containerWorkflow, "name: nutsnews-production-release", "Container Image must publish release metadata.");
requireText(containerWorkflow, "image_digest", "Release metadata must include the immutable image digest.");
requireText(containerWorkflow, "image_tag: sourceCommit", "Release metadata must use the full commit tag.");
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

console.log("Production release workflow regression checks passed.");
