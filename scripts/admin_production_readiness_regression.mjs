import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function read(path) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function assertIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label} is missing required text: ${needle}`);
  }
}

const page = read("web/app/admin/(protected)/readiness/page.tsx");
const lib = read("web/lib/adminProductionReadiness.ts");
const adminHome = read("web/app/admin/(protected)/page.tsx");
const packageJson = JSON.parse(read("web/package.json"));

for (const required of [
  "Public API health",
  "Latest Worker/controller success",
  "DB growth signal",
  "Translation coverage",
  "Image coverage",
  "Backup freshness",
  "CI status",
]) {
  assertIncludes(lib, required, "adminProductionReadiness.ts");
}

for (const required of [
  'import "server-only"',
  "GITHUB_READONLY_TOKEN",
  "GITHUB_ACTIONS_READ_TOKEN",
  "https://api.github.com/repos/",
  "actions/runs?branch=${GITHUB_ACTIONS_BRANCH}&per_page=50",
  'const GITHUB_ACTIONS_BRANCH = "main"',
  "application/vnd.github+json",
  "X-GitHub-Api-Version",
  "2022-11-28",
  "GITHUB_ACTIONS_REVALIDATE_SECONDS",
  ".github/workflows/web-ci.yml",
  ".github/workflows/public-reader-smoke.yml",
  ".github/workflows/vercel-preview-smoke.yml",
  ".github/workflows/lighthouse-ci.yml",
  ".github/workflows/accessibility-ci.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/gitleaks.yml",
  ".github/workflows/osv-scanner.yml",
  ".github/workflows/dependency-review.yml",
  ".github/workflows/openssf-scorecard.yml",
  ".github/workflows/snyk.yml",
  "workflow_runs",
  "conclusion === \"success\"",
  "rate-limited",
]) {
  assertIncludes(lib, required, "adminProductionReadiness.ts GitHub Actions integration");
}

for (const required of [
  "Production Readiness",
  "green",
  "yellow",
  "red",
  "Next step",
  "Workflow",
  "workflow.githubStatus",
  "workflow.conclusion",
  "formatAdminDateTime",
]) {
  assertIncludes(page, required, "readiness page");
}

assertIncludes(adminHome, 'href="/admin/readiness"', "admin landing page");

if (
  packageJson.scripts?.["test:admin-production-readiness"] !==
  "node ../scripts/admin_production_readiness_regression.mjs"
) {
  throw new Error("web/package.json is missing test:admin-production-readiness script");
}

console.log("Admin production readiness regression checks passed.");
