#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label} is missing required worker-uplift pipeline token: ${needle}`);
  }
}

const page = read("web/app/admin/(protected)/shards/page.tsx");
const lib = read("web/lib/adminShardHealth.ts");
const adminDatabase = read("web/lib/adminDatabase.ts");
const contract = read("api-contracts/admin-backend-operations.json");
const offlineE2e = read("scripts/web_offline_e2e_regression.mjs");
const routeTest = read("web/tests/routes/admin-worker-shards.test.ts");
const packageJson = JSON.parse(read("web/package.json"));

for (const token of [
  "WorkerUpliftPipelineSection",
  "RabbitMQ Pipeline Health",
  "activeOwnerLabel",
  "WorkerUpliftStatusPill",
  "sourcePathHref",
  "dashboardData.workerUpliftHealth",
  "Blocked Stages",
  "Queue Age",
  "DLQ",
  "Throughput",
  "P95",
  "Dashboard",
  "Runbook",
  "Partial telemetry",
  "Projection unavailable",
]) {
  assertIncludes(page, token, "admin shards page");
}

for (const token of [
  "WORKER_UPLIFT_STAGES",
  "WorkerUpliftHealthProjection",
  "workerUpliftHealth: WorkerUpliftHealthProjection",
  "normalizeWorkerUpliftHealth",
  "safeTelemetrySource",
  "safeSourcePath",
  "load-admin-worker-shards",
  "grafanaDependency",
  "partialErrors",
  "dashboardPath",
  "runbookPath",
]) {
  assertIncludes(lib, token, "adminShardHealth.ts");
}

assertIncludes(
  adminDatabase,
  '"load-admin-worker-uplift-health"',
  "adminDatabase.ts",
);

for (const token of [
  '"load-admin-worker-uplift-health"',
  '"workerUpliftHealth"',
]) {
  assertIncludes(contract, token, "admin backend operation contract");
}

for (const token of [
  "workerUpliftHealthProjection",
  "load-admin-worker-uplift-health",
  "SyntheticPartialTelemetry",
]) {
  assertIncludes(offlineE2e, token, "offline e2e regression");
}

for (const token of [
  "legacy-only backend worker shard responses",
  "without exposing broker or secret strings",
  "workerUpliftHealthProjection",
  "server-only-secret-token",
]) {
  assertIncludes(routeTest, token, "admin worker shards route test");
}

for (const forbidden of [
  /amqp:\/\//i,
  /rabbitmq-management/i,
  /private-broker/i,
  /broker\.internal/i,
  /RABBITMQ_URL/,
  /CLOUDAMQP_URL/,
  /RABBITMQ_PASSWORD/,
  /RABBITMQ_USERNAME/,
]) {
  if (forbidden.test(page) || forbidden.test(lib)) {
    throw new Error(`admin worker-uplift dashboard exposes forbidden broker token ${forbidden}`);
  }
}

if (
  packageJson.scripts?.["test:admin-worker-uplift-pipeline"] !==
  "node ../scripts/admin_worker_uplift_pipeline_regression.mjs"
) {
  throw new Error("web/package.json is missing test:admin-worker-uplift-pipeline");
}

console.log("Admin worker-uplift pipeline regression checks passed.");
