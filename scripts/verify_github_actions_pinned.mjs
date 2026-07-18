#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const WORKFLOW_DIR = ".github/workflows";
const FULL_SHA_REF = /@[0-9a-f]{40}$/i;
const DOCKER_SHA_REF = /^docker:\/\/.+@sha256:[0-9a-f]{64}$/i;

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

const failures = [];

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
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("All external GitHub Actions uses refs are pinned to immutable SHAs.");
}
