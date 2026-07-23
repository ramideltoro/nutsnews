#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultContractPath = path.join(repoRoot, "api-contracts", "admin-backend-operations.json");
const allowedProviderModes = new Set(["backend_postgres_shadow", "backend_postgres_primary"]);
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 15000;
const DEFAULT_LIMIT = 1;
const MAX_SMOKE_LIMIT = 5;
const DEFAULT_TARGET_LANGUAGE_CODES = ["fr"];
const DEFAULT_COUNT_TABLES = ["articles"];

function option(name, argv = process.argv) {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }

  return value.trim();
}

function configuredValue(env, name) {
  return String(env[name] ?? "").trim();
}

function required(value, label) {
  if (!value) {
    throw new Error(`${label} is required`);
  }

  return value;
}

function boundedInteger(value, label, { defaultValue, minimum, maximum }) {
  if (value === undefined || value === "") {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${label} must be an integer greater than or equal to ${minimum}`);
  }

  return Math.min(parsed, maximum);
}

function smokeSince(now = new Date()) {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return since.toISOString();
}

function adminBackendOperationUrl(baseUrl, operation) {
  if (!/^[a-z0-9][a-z0-9-]{1,96}$/i.test(operation)) {
    throw new Error(`Invalid backend operation name: ${operation}`);
  }

  return new URL(`${baseUrl.replace(/\/+$/, "")}/${operation}`);
}

function readContractOperations(contractPath = defaultContractPath) {
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  if (!Array.isArray(contract.operations)) {
    throw new Error("Admin backend operation contract must define an operations array");
  }

  const operations = contract.operations.map((entry) => ({
    operation: entry.operation,
    minimalRowFields: entry.responseShape?.minimalRowFields ?? [],
    expectsSingleSnapshotRow: String(entry.responseShape?.rows ?? "").includes("single"),
  }));

  const invalidOperation = operations.find(
    (entry) => typeof entry.operation !== "string" || !entry.operation.startsWith("load-admin-"),
  );
  if (invalidOperation) {
    throw new Error(`Invalid admin backend operation contract entry: ${invalidOperation.operation}`);
  }

  return operations;
}

function safeOperationBody(operation, { providerMode, limit, since }) {
  const base = { providerMode };

  switch (operation) {
    case "load-admin-production-readiness":
      return {
        ...base,
        recentArticleLimit: limit,
        translationSampleLimit: limit,
        targetLanguageCodes: DEFAULT_TARGET_LANGUAGE_CODES,
        articleGrowthWindowsHours: [24, 24 * 7],
      };
    case "load-admin-article-reviews":
      return {
        ...base,
        maxOptionRows: limit,
        recentPublishedArticleLimit: limit,
        aiDecisionVersionReportLimit: limit,
        pageSize: limit,
        filters: {
          decision: "all",
          page: 0,
          sort: "newest",
        },
      };
    case "load-admin-article-engagement":
      return {
        ...base,
        sourceCategoryLimit: limit,
        articleLimit: limit,
      };
    case "load-admin-ai-usage":
      return {
        ...base,
        since,
        limit,
      };
    case "load-admin-local-ai":
      return {
        ...base,
        since,
        runLimit: limit,
        reviewLimit: limit,
      };
    case "load-admin-translation-quality":
      return {
        ...base,
        auditLimit: limit,
        summaryLookupLimit: limit,
        targetLanguageCodes: DEFAULT_TARGET_LANGUAGE_CODES,
      };
    case "load-admin-guardrails":
      return {
        ...base,
        since,
        limit,
        countTables: DEFAULT_COUNT_TABLES,
      };
    case "load-admin-worker-shards":
      return {
        ...base,
        limit,
        shardCount: 1,
        staleAfterMinutes: 180,
        slowRunMs: 15000,
        dailyWindowDays: 1,
      };
    case "load-admin-rss-feed-health":
      return {
        ...base,
        limit,
        staleAfterHours: 24,
      };
    case "load-admin-feed-management":
    case "load-admin-audit-log":
      return {
        ...base,
        limit,
      };
    case "load-admin-runtime-feature-flags":
      return {
        ...base,
        limit,
        offset: 0,
      };
    default:
      return {
        ...base,
        limit,
      };
  }
}

function assertMinimalResponseShape(operationContract, payload) {
  const { operation, minimalRowFields, expectsSingleSnapshotRow } = operationContract;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${operation} returned an invalid JSON response envelope`);
  }
  if (!Array.isArray(payload.rows)) {
    throw new Error(`${operation} returned an invalid response envelope: rows must be an array`);
  }
  if (Object.hasOwn(payload, "rowCount") && typeof payload.rowCount !== "number") {
    throw new Error(`${operation} returned an invalid response envelope: rowCount must be a number`);
  }
  if (Object.hasOwn(payload, "generatedAt") && typeof payload.generatedAt !== "string") {
    throw new Error(`${operation} returned an invalid response envelope: generatedAt must be a string`);
  }
  if (expectsSingleSnapshotRow && payload.rows.length !== 1) {
    throw new Error(
      `${operation} returned ${payload.rows.length} top-level rows; expected one dashboard snapshot row`,
    );
  }

  if (payload.rows.length > 0 && minimalRowFields.length > 0) {
    const firstRow = payload.rows[0];
    if (!firstRow || typeof firstRow !== "object" || Array.isArray(firstRow)) {
      throw new Error(`${operation} returned a non-object first row`);
    }

    const missingFields = minimalRowFields.filter((field) => !Object.hasOwn(firstRow, field));
    if (missingFields.length > 0) {
      throw new Error(`${operation} first row is missing required field(s): ${missingFields.join(", ")}`);
    }
  }

  return {
    rows: payload.rows.length,
    rowCount: typeof payload.rowCount === "number" ? payload.rowCount : null,
    emptyValidDataset: payload.rows.length === 0,
  };
}

async function postOperation({
  baseUrl,
  token,
  timeoutMs,
  fetchImpl,
  operationContract,
  body,
}) {
  const { operation } = operationContract;
  let response;

  try {
    response = await fetchImpl(adminBackendOperationUrl(baseUrl, operation), {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-nutsnews-db-client": "admin-backend-smoke",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.name || "request_failed" : "request_failed";
    throw new Error(`${operation} request failed before receiving an HTTP response: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`${operation} returned HTTP ${response.status}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${operation} returned HTTP ${response.status} but the body was not valid JSON`);
  }

  return assertMinimalResponseShape(operationContract, payload);
}

export async function smokeAdminBackendOperations({
  baseUrl,
  token,
  providerMode = "backend_postgres_primary",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  limit = DEFAULT_LIMIT,
  since = smokeSince(),
  operations = readContractOperations(),
  fetchImpl = fetch,
  log = () => {},
  onOperationResult = () => {},
}) {
  required(baseUrl, "NUTSNEWS_BACKEND_API_URL or --backend-api-url");
  required(token, "NUTSNEWS_BACKEND_API_TOKEN or --backend-api-token");
  if (!allowedProviderModes.has(providerMode)) {
    throw new Error("Provider mode must be backend_postgres_shadow or backend_postgres_primary");
  }

  const results = [];
  for (const operationContract of operations) {
    const body = safeOperationBody(operationContract.operation, {
      providerMode,
      limit,
      since,
    });
    let result;
    try {
      result = await postOperation({
        baseUrl,
        token,
        timeoutMs,
        fetchImpl,
        operationContract,
        body,
      });
    } catch (error) {
      onOperationResult({
        operation: operationContract.operation,
        status: "fail",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    const emptySuffix = result.emptyValidDataset ? " empty-valid-dataset" : "";
    log(
      `ok ${operationContract.operation} status=200 rows=${result.rows} rowCount=${result.rowCount ?? "n/a"}${emptySuffix}`,
    );
    onOperationResult({
      operation: operationContract.operation,
      status: "pass",
      ...result,
    });
    results.push({
      operation: operationContract.operation,
      ...result,
    });
  }

  return results;
}

function cliConfig({ env = process.env, argv = process.argv } = {}) {
  const contractPath = option("--contract", argv);
  const providerMode =
    option("--provider-mode", argv) ||
    configuredValue(env, "NUTSNEWS_ADMIN_BACKEND_SMOKE_PROVIDER_MODE") ||
    configuredValue(env, "NUTSNEWS_DATABASE_PROVIDER_MODE") ||
    "backend_postgres_primary";

  return {
    baseUrl: required(
      option("--backend-api-url", argv) || configuredValue(env, "NUTSNEWS_BACKEND_API_URL"),
      "NUTSNEWS_BACKEND_API_URL or --backend-api-url",
    ),
    token: required(
      option("--backend-api-token", argv) || configuredValue(env, "NUTSNEWS_BACKEND_API_TOKEN"),
      "NUTSNEWS_BACKEND_API_TOKEN or --backend-api-token",
    ),
    providerMode,
    timeoutMs: boundedInteger(
      option("--timeout-ms", argv) || configuredValue(env, "NUTSNEWS_BACKEND_API_TIMEOUT_MS"),
      "timeout",
      {
        defaultValue: DEFAULT_TIMEOUT_MS,
        minimum: 1,
        maximum: MAX_TIMEOUT_MS,
      },
    ),
    limit: boundedInteger(
      option("--limit", argv) || configuredValue(env, "NUTSNEWS_ADMIN_BACKEND_SMOKE_LIMIT"),
      "limit",
      {
        defaultValue: DEFAULT_LIMIT,
        minimum: 1,
        maximum: MAX_SMOKE_LIMIT,
      },
    ),
    since: option("--since", argv) || configuredValue(env, "NUTSNEWS_ADMIN_BACKEND_SMOKE_SINCE") || smokeSince(),
    operations: readContractOperations(
      contractPath
        ? path.resolve(process.cwd(), contractPath)
        : defaultContractPath,
    ),
  };
}

async function main() {
  const config = cliConfig();

  console.log("Starting admin backend operation smoke.");
  console.log(`Target backend API URL: ${config.baseUrl.replace(/\/+$/, "")}`);
  console.log(`Provider mode: ${config.providerMode}`);
  console.log(`Operations: ${config.operations.length}`);

  const results = await smokeAdminBackendOperations({
    ...config,
    log: (message) => console.log(message),
  });

  console.log(`Admin backend operation smoke passed for ${results.length} operation(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export function createAdminBackendSmokeMockServer({ token, operations, failOperation }) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method !== "POST" || !url.pathname.startsWith("/api/app/db/")) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not found" }));
      return;
    }

    const operation = decodeURIComponent(url.pathname.slice("/api/app/db/".length));
    let rawBody = "";
    for await (const chunk of request) {
      rawBody += chunk;
    }
    const body = rawBody ? JSON.parse(rawBody) : {};
    requests.push({
      operation,
      authorization: request.headers.authorization,
      body,
    });

    if (request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "token rejected" }));
      return;
    }
    if (operation === failOperation) {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "secret response body should not be logged" }));
      return;
    }

    const operationContract = operations.find((entry) => entry.operation === operation);
    if (!operationContract) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "unknown operation" }));
      return;
    }

    const row = Object.fromEntries(
      operationContract.minimalRowFields.map((field) => [field, field === "enabled" ? true : []]),
    );
    const payload = operation === "load-admin-runtime-feature-flags"
      ? { rows: [], rowCount: 0, generatedAt: "2026-07-23T00:00:00.000Z" }
      : { rows: [row], rowCount: 1, generatedAt: "2026-07-23T00:00:00.000Z" };

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(payload));
  });

  return { server, requests };
}
