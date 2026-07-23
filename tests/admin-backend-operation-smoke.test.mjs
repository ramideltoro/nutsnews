import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import {
  createAdminBackendSmokeMockServer,
  smokeAdminBackendOperations,
} from "../scripts/admin_backend_operation_smoke.mjs";

const operations = [
  {
    operation: "load-admin-production-readiness",
    minimalRowFields: [
      "articleCount",
      "publicFeedSnapshotCount",
      "recentArticles",
      "workerRun",
      "articlesLast24Hours",
      "articlesLast7Days",
      "translationSummaries",
      "translationExpectedCount",
    ],
    expectsSingleSnapshotRow: true,
  },
  {
    operation: "load-admin-ai-usage",
    minimalRowFields: ["usageRunRows"],
    expectsSingleSnapshotRow: true,
  },
  {
    operation: "load-admin-runtime-feature-flags",
    minimalRowFields: ["key", "enabled"],
    expectsSingleSnapshotRow: false,
  },
];

async function withMockServer(callback, options = {}) {
  const token = "server-only-smoke-token";
  const { server, requests } = createAdminBackendSmokeMockServer({
    token,
    operations,
    ...options,
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api/app/db`;

  try {
    return await callback({ baseUrl, token, requests });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("smokeAdminBackendOperations posts every contract operation with safe bounded read payloads", async () => {
  await withMockServer(async ({ baseUrl, token, requests }) => {
    const logs = [];
    const operationResults = [];
    const results = await smokeAdminBackendOperations({
      baseUrl,
      token,
      providerMode: "backend_postgres_primary",
      timeoutMs: 5000,
      limit: 1,
      since: "2026-07-01T00:00:00.000Z",
      operations,
      log: (message) => logs.push(message),
      onOperationResult: (result) => operationResults.push(result),
    });

    assert.deepEqual(results.map((result) => result.operation), operations.map((entry) => entry.operation));
    assert.deepEqual(operationResults.map((result) => `${result.operation}:${result.status}`), operations.map((entry) => `${entry.operation}:pass`));
    assert.deepEqual(requests.map((request) => request.operation), operations.map((entry) => entry.operation));
    assert(requests.every((request) => request.authorization === `Bearer ${token}`));
    assert(requests.every((request) => request.body.providerMode === "backend_postgres_primary"));
    assert.equal(requests[0].body.recentArticleLimit, 1);
    assert.equal(requests[0].body.translationSampleLimit, 1);
    assert.equal(requests[1].body.since, "2026-07-01T00:00:00.000Z");
    assert.equal(requests[1].body.limit, 1);
    assert.equal(requests[2].body.limit, 1);
    assert.equal(requests[2].body.offset, 0);
    assert(logs.some((message) => message.includes("load-admin-runtime-feature-flags")));
    assert(logs.some((message) => message.includes("empty-valid-dataset")));
  });
});

test("smokeAdminBackendOperations fails non-2xx responses with exact operation name and status only", async () => {
  await withMockServer(
    async ({ baseUrl, token }) => {
      const operationResults = [];
      await assert.rejects(
        () => smokeAdminBackendOperations({
          baseUrl,
          token,
          providerMode: "backend_postgres_primary",
          timeoutMs: 5000,
          operations,
          onOperationResult: (result) => operationResults.push(result),
        }),
        (error) => {
          assert.match(error.message, /load-admin-ai-usage \(\/api\/app\/db\/load-admin-ai-usage\) returned HTTP 503/);
          assert.doesNotMatch(error.message, /server-only-smoke-token/);
          assert.doesNotMatch(error.message, /secret response body/);
          return true;
        },
      );
      assert.deepEqual(operationResults.map((result) => `${result.operation}:${result.status}`), [
        "load-admin-production-readiness:pass",
        "load-admin-ai-usage:fail",
      ]);
    },
    { failOperation: "load-admin-ai-usage" },
  );
});
