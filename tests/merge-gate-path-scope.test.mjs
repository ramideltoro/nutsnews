import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = resolve(root, ".github/workflows/merge-gate.yml");

async function loadScopePattern() {
  const workflow = await readFile(workflowPath, "utf8");
  const match = workflow.match(/grep -Eq '([^']+)' "\$changed_files"/);

  assert.ok(match, "Merge Gate must use one explicit grep -E changed-file scope pattern.");
  return match[1];
}

function matchesScope(pattern, paths) {
  const result = spawnSync("grep", ["-Eq", pattern], {
    encoding: "utf8",
    input: `${paths.join("\n")}\n`,
  });

  assert.ifError(result.error);
  assert.ok(
    result.status === 0 || result.status === 1,
    `grep scope evaluation failed with status ${result.status}: ${result.stderr}`,
  );
  return result.status === 0;
}

test("Merge Gate runs for nested web, script, test, and owned workflow changes", async () => {
  const pattern = await loadScopePattern();

  for (const path of [
    "web/app/page.tsx",
    "web/package.json",
    "scripts/security_regression.mjs",
    "tests/runtime-public-config.test.mjs",
    ".github/workflows/merge-gate.yml",
    ".github/workflows/web-ci.yml",
    ".github/workflows/container-image.yml",
    ".github/workflows/vercel-production-release.yml",
  ]) {
    assert.equal(matchesScope(pattern, [path]), true, `${path} must run the full Merge Gate.`);
  }
});

test("Merge Gate skips files outside its owned path scope", async () => {
  const pattern = await loadScopePattern();

  for (const path of [
    "README.md",
    "docs/operations.md",
    "website/app/page.tsx",
    "script/security_regression.mjs",
    "test/runtime-public-config.test.mjs",
    ".github/workflows/lighthouse-ci.yml",
    ".github/workflows/merge-gate.yaml",
  ]) {
    assert.equal(matchesScope(pattern, [path]), false, `${path} must not run the full Merge Gate.`);
  }
});

test("Merge Gate runs when any changed file is in scope", async () => {
  const pattern = await loadScopePattern();

  assert.equal(
    matchesScope(pattern, ["README.md", "web/lib/runtimePublicConfig.ts", "docs/operations.md"]),
    true,
  );
});
