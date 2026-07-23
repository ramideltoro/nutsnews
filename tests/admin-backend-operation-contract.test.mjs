import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");
const contractPath = resolve(repoRoot, "api-contracts/admin-backend-operations.json");
const adminDatabasePath = resolve(repoRoot, "web/lib/adminDatabase.ts");
const webLibPath = resolve(repoRoot, "web/lib");

const allowedBackendProviderModes = [
  "backend_postgres_shadow",
  "backend_postgres_primary",
];

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
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

  assert.deepEqual([...duplicates], [], `${label} must be unique`);
}

function extractAdminReadOperations(source) {
  const match = source.match(
    /ADMIN_DATABASE_READ_OPERATIONS\s*=\s*\[([\s\S]*?)\]\s+as const/,
  );
  assert.ok(match, "ADMIN_DATABASE_READ_OPERATIONS tuple must be present");

  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(path));
      continue;
    }
    if (entry.isFile() && /\.(tsx?|mjs)$/.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
}

async function existingFile(path, label) {
  const fileStat = await stat(resolve(repoRoot, path));
  assert.equal(fileStat.isFile(), true, `${label} must be an existing file: ${path}`);
}

async function readAdminDatabaseCallOperations() {
  const callSites = new Map();
  const files = await collectSourceFiles(webLibPath);

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/readAdminDatabase\(\s*"([^"]+)"/g)) {
      const operation = match[1];
      if (!operation.startsWith("load-admin-")) {
        continue;
      }
      const locations = callSites.get(operation) ?? [];
      locations.push(relative(repoRoot, file));
      callSites.set(operation, locations);
    }
  }

  return callSites;
}

test("admin backend operation contract has safe read metadata for every entry", async () => {
  const contract = await readJson(contractPath);

  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.sourceOfTruth.repository, "ramideltoro/nutsnews");
  assert.equal(contract.backendConsumption.backendRepository, "ramideltoro/nutsnews-backend");
  assert.equal(contract.backendConsumption.routePattern, "/api/app/db/{operation}");
  assert.ok(
    contract.backendConsumption.notes.includes("Do not scrape TypeScript source"),
    "contract must document direct JSON consumption for backend compatibility checks",
  );
  assert.deepEqual(contract.defaults.allowedProviderModes, allowedBackendProviderModes);
  assert.equal(contract.defaults.method, "POST");
  assert.equal(contract.defaults.classification, "read");
  assert.equal(contract.defaults.safeRead, true);

  assert.ok(Array.isArray(contract.operations));
  assert.ok(contract.operations.length > 0);
  assertUnique(
    contract.operations.map((entry) => entry.operation),
    "contract operation names",
  );

  for (const entry of contract.operations) {
    assert.match(entry.operation, /^load-admin-[a-z0-9-]+$/);
    assert.equal(entry.method, "POST", `${entry.operation} must use POST`);
    assert.equal(entry.classification, "read", `${entry.operation} must be a read`);
    assert.equal(entry.safeRead, true, `${entry.operation} must be marked safe read`);
    assert.deepEqual(
      entry.allowedProviderModes,
      allowedBackendProviderModes,
      `${entry.operation} provider modes must be explicit`,
    );
    assert.equal(
      entry.backendPath,
      `/api/app/db/${entry.operation}`,
      `${entry.operation} backend path must be machine-derived`,
    );
    assert.match(entry.dashboardRoute, /^\/admin\/[a-z0-9-]+$/);
    assert.match(entry.dashboardFile, /^web\/app\/admin\/\(protected\)\/.+\/page\.tsx$/);
    assert.match(entry.loaderFile, /^web\/lib\/.+\.ts$/);
    assert.ok(entry.responseShape);
    assert.ok(Array.isArray(entry.responseShape.minimalRowFields));
    assert.ok(entry.responseShape.minimalRowFields.length > 0);

    await existingFile(entry.dashboardFile, `${entry.operation} dashboard file`);
    await existingFile(entry.loaderFile, `${entry.operation} loader file`);
  }
});

test("ADMIN_DATABASE_READ_OPERATIONS stays generated-equivalent to the JSON contract", async () => {
  const contract = await readJson(contractPath);
  const adminDatabaseSource = await readFile(adminDatabasePath, "utf8");

  const contractOperations = contract.operations.map((entry) => entry.operation);
  const typedOperations = extractAdminReadOperations(adminDatabaseSource);

  assert.deepEqual(
    typedOperations,
    contractOperations,
    "web/lib/adminDatabase.ts ADMIN_DATABASE_READ_OPERATIONS must match api-contracts/admin-backend-operations.json in order and content",
  );
});

test("every admin read call site has a canonical contract entry", async () => {
  const contract = await readJson(contractPath);
  const contractOperations = new Set(contract.operations.map((entry) => entry.operation));
  const callSites = await readAdminDatabaseCallOperations();
  const uncontractedOperations = [];

  for (const [operation, locations] of callSites) {
    if (!contractOperations.has(operation)) {
      uncontractedOperations.push({
        operation,
        locations,
      });
    }
  }

  assert.deepEqual(
    uncontractedOperations,
    [],
    "every readAdminDatabase load-admin call must have a JSON contract entry",
  );
});
