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

function assertNotIncludes(content, needle, label) {
  if (content.includes(needle)) {
    throw new Error(`${label} must not include forbidden text: ${needle}`);
  }
}

const page = read("web/app/admin/(protected)/readiness/page.tsx");
const lib = read("web/lib/adminProductionReadiness.ts");
const packageJson = JSON.parse(read("web/package.json"));

for (const required of [
  'import "server-only"',
  "process.env.ACTIONS_READ_TOKEN",
  "https://api.github.com/repos/",
  "actions/runs?branch=${GITHUB_ACTIONS_BRANCH}&per_page=50",
  'const GITHUB_ACTIONS_BRANCH = "main"',
  "application/vnd.github+json",
  "Authorization: `Bearer ${token}`",
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
  "head_branch",
  "head_sha",
  "branch: run.head_branch ?? GITHUB_ACTIONS_BRANCH",
  "commitSha: run.head_sha ?? \"unknown\"",
  "ACTIONS_READ_TOKEN is not configured",
  "Live GitHub Actions status is unavailable because the GitHub API request failed before a response was returned.",
  "rate-limited",
]) {
  assertIncludes(lib, required, "adminProductionReadiness.ts GitHub Actions integration");
}

for (const forbidden of ["GITHUB_READONLY_TOKEN", "GITHUB_ACTIONS_READ_TOKEN"]) {
  assertNotIncludes(lib, forbidden, "adminProductionReadiness.ts GitHub Actions integration");
}

for (const required of [
  "Workflow",
  "workflow.githubStatus",
  "workflow.conclusion",
  "workflow.branch",
  "workflow.commitSha",
]) {
  assertIncludes(page, required, "readiness page GitHub Actions workflow rendering");
}

if (
  packageJson.scripts?.["test:admin-readiness-actions-token"] !==
  "node ../scripts/admin_readiness_actions_token_contract.mjs"
) {
  throw new Error("web/package.json is missing test:admin-readiness-actions-token script");
}

console.log("Admin readiness GitHub Actions token contract checks passed.");
