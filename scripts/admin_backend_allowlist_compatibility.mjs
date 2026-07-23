#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractRelativePath = "api-contracts/admin-backend-operations.json";
const backendDbApiRelativePath = path.join(
  "ansible",
  "roles",
  "backend_baseline",
  "files",
  "nutsnews_worker_db_api.py",
);

const pythonExtractor = String.raw`
import ast
import json
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as source_file:
    tree = ast.parse(source_file.read(), filename=path)

for node in tree.body:
    if not isinstance(node, ast.Assign):
        continue
    if not any(isinstance(target, ast.Name) and target.id == "APP_READ_OPERATIONS" for target in node.targets):
        continue
    if not isinstance(node.value, ast.Set):
        raise SystemExit("APP_READ_OPERATIONS must be a literal set")

    operations = []
    for element in node.value.elts:
        if not isinstance(element, ast.Constant) or not isinstance(element.value, str):
            raise SystemExit("APP_READ_OPERATIONS must contain only string literals")
        operations.append(element.value)

    print(json.dumps({"operations": operations}))
    break
else:
    raise SystemExit("APP_READ_OPERATIONS assignment not found")
`;

function existsAsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function existsAsDirectory(directoryPath) {
  try {
    return fs.statSync(directoryPath).isDirectory();
  } catch {
    return false;
  }
}

function resolveUserPath(value, base = process.cwd()) {
  return path.isAbsolute(value) ? value : path.resolve(base, value);
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function assertUnique(values, label) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  if (duplicates.size > 0) {
    throw new Error(`${label} must be unique: ${sorted(duplicates).join(", ")}`);
  }
}

export function readContractOperations(contractPath = path.join(repoRoot, contractRelativePath)) {
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

  if (contract.schemaVersion !== 1) {
    throw new Error(`${contractRelativePath} must use schemaVersion 1`);
  }
  if (!Array.isArray(contract.operations)) {
    throw new Error(`${contractRelativePath} must define an operations array`);
  }

  const operations = contract.operations.map((entry) => entry.operation);
  for (const operation of operations) {
    if (typeof operation !== "string" || !operation.startsWith("load-admin-")) {
      throw new Error(`Invalid admin backend operation in ${contractRelativePath}: ${operation}`);
    }
  }
  assertUnique(operations, "Admin backend contract operations");

  return operations;
}

export function resolveBackendDbApiPath({
  backendDbApiPath = process.env.NUTSNEWS_BACKEND_DB_API_PATH,
  backendRepoPath = process.env.NUTSNEWS_BACKEND_REPO_PATH,
  root = repoRoot,
} = {}) {
  if (backendDbApiPath) {
    const resolved = resolveUserPath(backendDbApiPath);
    if (!existsAsFile(resolved)) {
      throw new Error(`NUTSNEWS_BACKEND_DB_API_PATH does not point to a file: ${resolved}`);
    }
    return resolved;
  }

  const candidateRoots = [
    backendRepoPath ? resolveUserPath(backendRepoPath) : null,
    path.join(root, "backend", "nutsnews-backend"),
  ].filter(Boolean);

  const candidates = [];
  for (const candidateRoot of candidateRoots) {
    if (!existsAsDirectory(candidateRoot)) {
      candidates.push(path.join(candidateRoot, backendDbApiRelativePath));
      continue;
    }

    const candidate = path.join(candidateRoot, backendDbApiRelativePath);
    candidates.push(candidate);
    if (existsAsFile(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    [
      "Backend app DB API source not found.",
      "Set NUTSNEWS_BACKEND_REPO_PATH to a nutsnews-backend checkout or",
      "NUTSNEWS_BACKEND_DB_API_PATH to the backend nutsnews_worker_db_api.py file.",
      "Checked:",
      ...candidates.map((candidate) => `  - ${candidate}`),
    ].join("\n"),
  );
}

export function extractBackendAppReadOperations(backendDbApiPath) {
  const python = process.env.PYTHON ?? "python3";
  const result = spawnSync(python, ["-c", pythonExtractor, backendDbApiPath], {
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(`Failed to run ${python}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      [
        `Failed to parse APP_READ_OPERATIONS from ${backendDbApiPath}`,
        result.stderr.trim(),
        result.stdout.trim(),
      ].filter(Boolean).join("\n"),
    );
  }

  const payload = JSON.parse(result.stdout);
  if (!Array.isArray(payload.operations)) {
    throw new Error(`Python parser returned an invalid APP_READ_OPERATIONS payload for ${backendDbApiPath}`);
  }

  assertUnique(payload.operations, "Backend APP_READ_OPERATIONS");
  return payload.operations;
}

export function compareAdminBackendAllowlist(contractOperations, backendOperations) {
  assertUnique(contractOperations, "Admin backend contract operations");
  assertUnique(backendOperations, "Backend APP_READ_OPERATIONS");

  const backendOperationSet = new Set(backendOperations);
  const contractOperationSet = new Set(contractOperations);
  const missingOperations = contractOperations.filter((operation) => !backendOperationSet.has(operation));
  const extraBackendAdminOperations = backendOperations.filter(
    (operation) => operation.startsWith("load-admin-") && !contractOperationSet.has(operation),
  );

  return {
    missingOperations,
    extraBackendAdminOperations: sorted(extraBackendAdminOperations),
    contractOperationCount: contractOperations.length,
    backendOperationCount: backendOperations.length,
  };
}

function readGitValue(directory, args) {
  const result = spawnSync("git", ["-C", directory, ...args], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim() || null;
}

function backendMetadata(backendDbApiPath) {
  const gitRoot = readGitValue(path.dirname(backendDbApiPath), ["rev-parse", "--show-toplevel"]);

  if (!gitRoot) {
    return {
      backendDbApiPath,
      gitRoot: null,
      headSha: null,
      branch: null,
    };
  }

  return {
    backendDbApiPath,
    gitRoot,
    headSha: readGitValue(gitRoot, ["rev-parse", "HEAD"]),
    branch: readGitValue(gitRoot, ["branch", "--show-current"]),
  };
}

export function formatCompatibilityFailure(comparison, metadata) {
  const lines = [
    "Admin backend allowlist compatibility check failed.",
    "",
    `Required contract operations: ${comparison.contractOperationCount}`,
    `Backend APP_READ_OPERATIONS entries: ${comparison.backendOperationCount}`,
    `Backend API source: ${metadata.backendDbApiPath}`,
  ];

  if (metadata.headSha) {
    lines.push(`Backend git HEAD: ${metadata.headSha}`);
  }
  if (metadata.branch) {
    lines.push(`Backend branch: ${metadata.branch}`);
  }
  if (process.env.NUTSNEWS_BACKEND_COMPAT_REF) {
    lines.push(`Configured backend compatibility ref: ${process.env.NUTSNEWS_BACKEND_COMPAT_REF}`);
  }

  lines.push("", "Missing backend allowlist operation(s):");
  for (const operation of comparison.missingOperations) {
    lines.push(`  - ${operation}`);
  }

  return lines.join("\n");
}

async function main() {
  const contractOperations = readContractOperations();
  const backendDbApiPath = resolveBackendDbApiPath();
  const backendOperations = extractBackendAppReadOperations(backendDbApiPath);
  const comparison = compareAdminBackendAllowlist(contractOperations, backendOperations);
  const metadata = backendMetadata(backendDbApiPath);

  if (comparison.missingOperations.length > 0) {
    console.error(formatCompatibilityFailure(comparison, metadata));
    process.exitCode = 1;
    return;
  }

  console.log("Admin backend allowlist compatibility check passed.");
  console.log(`Required contract operations: ${comparison.contractOperationCount}`);
  console.log(`Backend APP_READ_OPERATIONS entries: ${comparison.backendOperationCount}`);
  console.log(`Backend API source: ${metadata.backendDbApiPath}`);
  if (metadata.headSha) {
    console.log(`Backend git HEAD: ${metadata.headSha}`);
  }
  if (metadata.branch) {
    console.log(`Backend branch: ${metadata.branch}`);
  }
  if (process.env.NUTSNEWS_BACKEND_COMPAT_REF) {
    console.log(`Configured backend compatibility ref: ${process.env.NUTSNEWS_BACKEND_COMPAT_REF}`);
  }
  if (comparison.extraBackendAdminOperations.length > 0) {
    console.log("Additional backend admin read operations not required by the web contract:");
    for (const operation of comparison.extraBackendAdminOperations) {
      console.log(`  - ${operation}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
