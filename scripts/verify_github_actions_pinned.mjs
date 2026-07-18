#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const WORKFLOW_DIR = ".github/workflows";
const FULL_SHA_REF = /@[0-9a-f]{40}$/i;
const DOCKER_SHA_REF = /^docker:\/\/.+@sha256:[0-9a-f]{64}$/i;
const VERIFY_COMMITS = process.argv.includes("--verify-commits");

function workflowUsesValue(line) {
  const match = line.match(/^\s*uses:\s*(['"]?)([^\s#'"]+)\1(?:\s+#.*)?\s*$/);
  return match?.[2];
}

function isLocalAction(value) {
  return value.startsWith("./") || value.startsWith("../");
}

function isPinnedExternalAction(value) {
  if (value.startsWith("docker://")) {
    return DOCKER_SHA_REF.test(value);
  }

  return FULL_SHA_REF.test(value);
}

function externalGitHubRef(value) {
  if (value.startsWith("docker://")) {
    return null;
  }

  const [target, ref] = value.split("@");
  const parts = target.split("/");
  if (parts.length < 2 || !/^[0-9a-f]{40}$/i.test(ref)) {
    return null;
  }

  return {
    repo: `${parts[0]}/${parts[1]}`,
    sha: ref.toLowerCase(),
  };
}

const failures = [];
const commitRefs = new Map();

for (const file of (await readdir(WORKFLOW_DIR)).filter((name) => /\.ya?ml$/.test(name)).sort()) {
  const path = join(WORKFLOW_DIR, file);
  const text = await readFile(path, "utf8");
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const value = workflowUsesValue(line);
    if (!value || isLocalAction(value) || isPinnedExternalAction(value)) {
      return;
    }

    failures.push(`${path}:${index + 1}: external uses ref is not pinned to a full commit SHA: ${value}`);
  });

  if (VERIFY_COMMITS) {
    lines.forEach((line, index) => {
      const value = workflowUsesValue(line);
      if (!value || isLocalAction(value) || !isPinnedExternalAction(value)) {
        return;
      }

      const ref = externalGitHubRef(value);
      if (!ref) {
        return;
      }

      const key = `${ref.repo}@${ref.sha}`;
      const sites = commitRefs.get(key) ?? [];
      sites.push(`${path}:${index + 1}`);
      commitRefs.set(key, sites);
    });
  }
}

if (VERIFY_COMMITS && failures.length === 0) {
  for (const [key, sites] of commitRefs) {
    const [repo, sha] = key.split("@");
    const result = spawnSync(
      "gh",
      ["api", `repos/${repo}/commits/${sha}`, "--jq", ".sha"],
      { encoding: "utf8" },
    );

    if (result.status !== 0 || result.stdout.trim().toLowerCase() !== sha) {
      failures.push(
        [
          `${sites[0]}: pinned SHA is not a commit in ${repo}: ${sha}`,
          ...sites.slice(1).map((site) => `${site}: same invalid ${repo} SHA`),
        ].join("\n"),
      );
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  const suffix = VERIFY_COMMITS ? " and resolve to commits in their source repositories" : "";
  console.log(`All external GitHub Actions uses refs are pinned to immutable SHAs${suffix}.`);
}
