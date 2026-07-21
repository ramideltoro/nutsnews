#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(resolve(root, "web/package.json"), "utf8"));
const deployedConfig = await readFile(resolve(root, "web/playwright.deployed.config.ts"), "utf8");
const deployedSpec = await readFile(resolve(root, "web/tests/deployed-ui-smoke.spec.ts"), "utf8");
const previewWorkflow = await readFile(resolve(root, ".github/workflows/vercel-preview-smoke.yml"), "utf8");
const immutablePreviewGuard = await readFile(resolve(root, "scripts/immutable_preview_smoke_guard.mjs"), "utf8");
const contract = await readFile(resolve(root, ".github/deployment/pre-merge-deployment-gate-contract.md"), "utf8");
const evidenceRunner = await readFile(resolve(root, "scripts/run_deployed_ui_smoke_with_evidence.mjs"), "utf8");

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

assert.equal(
  packageJson.scripts?.["test:e2e:deployed"],
  "playwright test --config=playwright.deployed.config.ts",
  "web/package.json must expose the target-agnostic deployed UI smoke command.",
);
assert.equal(
  packageJson.scripts?.["test:e2e:preview"],
  "playwright test --config=playwright.deployed.config.ts",
  "The legacy preview smoke command must delegate to the shared deployed UI smoke command.",
);
requireText(deployedConfig, "PLAYWRIGHT_BASE_URL is required", "Deployed smoke config must require PLAYWRIGHT_BASE_URL.");
requireText(deployedConfig, "testMatch: /deployed-ui-smoke\\.spec\\.ts/", "Deployed smoke config must select the shared spec.");
requireText(deployedConfig, "results.junit.xml", "Deployed smoke config must write JUnit evidence.");
assert.doesNotMatch(deployedConfig, /webServer:/, "Deployed smoke config must not start a local web server.");
requireText(deployedSpec, "Deployed UI smoke regression", "Shared deployed smoke spec must use target-neutral naming.");
assert.doesNotMatch(deployedSpec, /Vercel Preview smoke regression|preview deployment|staging search API/, "Shared deployed smoke spec must avoid Vercel-only or staging-only naming.");
requireText(
  previewWorkflow,
  "node ../scripts/run_deployed_ui_smoke_with_evidence.mjs",
  "Preview workflow must use the deployed UI smoke evidence runner.",
);
requireText(previewWorkflow, "steps.smoke.outputs.artifact_name", "Preview workflow must use the standardized UI smoke artifact name.");
requireText(evidenceRunner, '"test:e2e:deployed"', "Evidence runner must call the shared deployed UI smoke command.");
requireText(evidenceRunner, "sanitizeUploadedArtifacts", "Evidence runner must sanitize protected auth material before retention.");
requireText(evidenceRunner, "artifact_paths", "Evidence runner must write artifact paths for final-gate validation.");
requireText(evidenceRunner, "evidence.json", "Evidence runner must write JSON evidence.");
requireText(evidenceRunner, "NUTSNEWS_UI_SMOKE_TARGET_TYPE", "Evidence runner must require a target type.");
requireText(
  immutablePreviewGuard,
  "web/tests/deployed-ui-smoke.spec.ts",
  "Immutable preview guard must protect the renamed shared deployed smoke spec.",
);
requireText(
  immutablePreviewGuard,
  "web/playwright.deployed.config.ts",
  "Immutable preview guard must protect the deployed smoke Playwright config.",
);
for (const fragment of [
  "`npm run test:e2e:deployed`",
  "VPS staging, Vercel staging, Vercel production, and VPS production",
  "Target-specific expectations must be supplied through environment variables",
  "`target_url`, `target_type`, `source_commit`, `build_id`, `deployment_id`, `result`, and artifact paths",
  "The Vercel preview workflow remains separate for non-release previews",
]) {
  requireText(contract, fragment, `Pre-merge deployment contract must document deployed UI smoke behavior: ${fragment}`);
}

console.log("Deployed UI smoke regression passed.");
