import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  compareAdminBackendAllowlist,
  extractBackendAppReadOperations,
  formatCompatibilityFailure,
  resolveBackendDbApiPath,
} from "../scripts/admin_backend_allowlist_compatibility.mjs";

async function withTempDirectory(callback) {
  const directory = await mkdtemp(join(tmpdir(), "admin-backend-allowlist-"));

  try {
    return await callback(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("extractBackendAppReadOperations parses the backend APP_READ_OPERATIONS literal set", async () => {
  await withTempDirectory(async (directory) => {
    const backendApiPath = join(directory, "nutsnews_worker_db_api.py");
    await writeFile(
      backendApiPath,
      [
        "APP_READ_OPERATIONS = {",
        '    "app-provider-smoke",',
        '    "load-admin-production-readiness",',
        '    "load-admin-runtime-feature-flags",',
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    assert.deepEqual(extractBackendAppReadOperations(backendApiPath), [
      "app-provider-smoke",
      "load-admin-production-readiness",
      "load-admin-runtime-feature-flags",
    ]);
  });
});

test("compareAdminBackendAllowlist reports exact missing web contract operations", () => {
  const comparison = compareAdminBackendAllowlist(
    [
      "load-admin-production-readiness",
      "load-admin-article-reviews",
      "load-admin-runtime-feature-flags",
    ],
    [
      "app-provider-smoke",
      "load-admin-production-readiness",
      "load-admin-legacy-granular-read",
    ],
  );

  assert.deepEqual(comparison.missingOperations, [
    "load-admin-article-reviews",
    "load-admin-runtime-feature-flags",
  ]);
  assert.deepEqual(comparison.extraBackendAdminOperations, [
    "load-admin-legacy-granular-read",
  ]);
});

test("formatCompatibilityFailure includes missing operation names and backend source context", () => {
  const message = formatCompatibilityFailure(
    {
      missingOperations: ["load-admin-production-readiness"],
      contractOperationCount: 1,
      backendOperationCount: 0,
    },
    {
      backendDbApiPath: "/tmp/nutsnews_worker_db_api.py",
      headSha: "abc123",
      branch: "main",
    },
  );

  assert.match(message, /load-admin-production-readiness/);
  assert.match(message, /Backend API source: \/tmp\/nutsnews_worker_db_api\.py/);
  assert.match(message, /Backend git HEAD: abc123/);
});

test("resolveBackendDbApiPath finds the backend allowlist source from a backend repo root", async () => {
  await withTempDirectory(async (directory) => {
    const backendRepoPath = join(directory, "nutsnews-backend");
    const backendApiDirectory = join(
      backendRepoPath,
      "ansible",
      "roles",
      "backend_baseline",
      "files",
    );
    const backendApiPath = join(backendApiDirectory, "nutsnews_worker_db_api.py");

    await mkdir(backendApiDirectory, { recursive: true });
    await writeFile(backendApiPath, "APP_READ_OPERATIONS = set()\n", "utf8");

    assert.equal(resolveBackendDbApiPath({ backendRepoPath }), backendApiPath);
  });
});
