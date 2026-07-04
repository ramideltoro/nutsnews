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
    throw new Error(`${label} is missing required guardrails token: ${needle}`);
  }
}

const guardrails = read("web/lib/adminCostGuardrails.ts");
const page = read("web/app/admin/(protected)/guardrails/page.tsx");
const packageJson = JSON.parse(read("web/package.json"));

for (const token of [
  "VERCEL_USAGE_METRICS",
  "NUTSNEWS_VERCEL_USAGE_URL",
  "buildVercelUsageMetrics",
  "Vercel usage manual input",
  "sourceUrl",
  "sourceLabel",
  "inputNames",
  "sumQuotaEventTypes",
  "redis_kv_operation",
  "egress_gb",
  "pagespeed_api_call",
]) {
  assertIncludes(guardrails, token, "adminCostGuardrails.ts");
}

for (const token of [
  "NUTSNEWS_REDIS_KV_30D_OPS",
  "NUTSNEWS_REDIS_KV_30D_OP_LIMIT",
  "NUTSNEWS_EGRESS_30D_GB",
  "NUTSNEWS_EGRESS_30D_GB_LIMIT",
  "NUTSNEWS_PAGESPEED_30D_CALLS",
  "NUTSNEWS_PAGESPEED_30D_CALL_LIMIT",
]) {
  assertIncludes(guardrails, token, "adminCostGuardrails.ts");
}

const vercelMetricTokens = [
  "NUTSNEWS_VERCEL_FLUID_ACTIVE_CPU_HOURS",
  "NUTSNEWS_VERCEL_ISR_WRITES",
  "NUTSNEWS_VERCEL_IMAGE_TRANSFORMATIONS",
  "NUTSNEWS_VERCEL_FAST_ORIGIN_TRANSFER_GB",
  "NUTSNEWS_VERCEL_IMAGE_CACHE_WRITES",
  "NUTSNEWS_VERCEL_EDGE_REQUESTS",
  "NUTSNEWS_VERCEL_FUNCTION_INVOCATIONS",
  "NUTSNEWS_VERCEL_ISR_READS",
  "NUTSNEWS_VERCEL_FLUID_PROVISIONED_MEMORY_GB_HOURS",
  "NUTSNEWS_VERCEL_FAST_DATA_TRANSFER_GB",
];

for (const token of vercelMetricTokens) {
  assertIncludes(guardrails, token, "adminCostGuardrails.ts");
}

for (const token of [
  "Fluid Active CPU",
  "ISR Writes",
  "Image Optimization Transformations",
  "Fast Origin Transfer",
  "Image Optimization Cache Writes",
  "Edge Requests",
  "Function Invocations",
  "ISR Reads",
  "Fluid Provisioned Memory",
  "Fast Data Transfer",
]) {
  assertIncludes(guardrails, token, "adminCostGuardrails.ts");
}

for (const token of [
  "metric.sourceUrl",
  "metric.sourceLabel",
  "metric.inputNames",
  'unit === "hours"',
  'unit === "GB-Hrs"',
]) {
  assertIncludes(page, token, "guardrails page");
}

if (packageJson.scripts?.["test:admin-guardrails"] !== "node ../scripts/admin_guardrails_regression.mjs") {
  throw new Error("package.json is missing test:admin-guardrails script");
}

console.log("Admin guardrails regression checks passed.");
