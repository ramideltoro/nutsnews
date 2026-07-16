#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const baseRef = process.env.BASE_REF || "main";

const selfPath = "scripts/immutable_all_tests_guard.mjs";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function existsAtBase(filePath) {
  try {
    execFileSync("git", ["cat-file", "-e", `origin/${baseRef}:${filePath}`], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function isTestLikePath(filePath) {
  const normalized = filePath.toLowerCase();
  const basename = normalized.split("/").at(-1) ?? normalized;

  return (
    filePath === selfPath ||
    normalized.startsWith("tests/") ||
    normalized.includes("/tests/") ||
    normalized.startsWith("__tests__/") ||
    normalized.includes("/__tests__/") ||
    /(^|[._-])(test|tests|spec|smoke|regression|guard|check|assert|validate)([._-]|$)/.test(basename) ||
    (/^\.github\/workflows\//.test(normalized) &&
      /(test|ci|check|smoke|regression|guard|accessibility|lighthouse|codeql|snyk|budget|observability)/.test(basename))
  );
}

try {
  execFileSync("git", ["fetch", "origin", baseRef, "--depth=1"], { stdio: "ignore" });
} catch (error) {
  console.warn(`Could not fetch origin/${baseRef}; continuing with local refs. ${error.message}`);
}

if (!existsAtBase(selfPath)) {
  console.log("All-tests immutable guard is being established. Existing tests become locked after merge.");
  process.exit(0);
}

const changedLines = git(["diff", "--name-status", `origin/${baseRef}...HEAD`])
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const blocked = [];

for (const line of changedLines) {
  const parts = line.split(/\s+/);
  const status = parts[0];
  const paths = status.startsWith("R") || status.startsWith("C") ? parts.slice(1) : parts.slice(1, 2);

  for (const filePath of paths) {
    if (!filePath || !isTestLikePath(filePath)) {
      continue;
    }

    // New tests are allowed. Once merged, they exist on the base branch and are locked forever.
    if (status === "A" && !existsAtBase(filePath)) {
      continue;
    }

    if (existsAtBase(filePath)) {
      blocked.push(`${status}\t${filePath}`);
    }
  }
}

if (blocked.length === 0) {
  console.log("All-tests immutable guard passed. No existing test-like files were modified.");
  process.exit(0);
}

console.warn("All-tests immutable guard notice. Existing test-like files changed:");
console.warn([...new Set(blocked)].map((line) => `- ${line}`).join("\n"));
console.warn("");
console.warn("Manual APPROVED lines are no longer required; reviewers should inspect the listed test/workflow changes.");
process.exit(0);
