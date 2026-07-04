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
  "CLOUDFLARE_USAGE_METRICS",
  "CLOUDFLARE_OPTIONAL_SERVICE_METRICS",
  "NUTSNEWS_VERCEL_USAGE_URL",
  "buildVercelUsageMetrics",
  "buildCloudflareUsageMetrics",
  "loadCloudflareGraphQlUsage",
  "fetchCloudflareGraphQl",
  "Vercel usage manual input",
  "Cloudflare GraphQL Analytics API",
  "sourceUrl",
  "sourceLabel",
  "inputNames",
  "sumQuotaEventTypes",
  "redis_kv_operation",
  "egress_gb",
  "pagespeed_api_call",
  "cloudflare_worker_request",
  "cloudflare_kv_read",
  "cloudflare_cdn_bandwidth_gb",
  "cloudflare_turnstile_validation",
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

const cloudflareMetricTokens = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_ZONE_ID",
  "CLOUDFLARE_WORKER_SCRIPT_NAMES",
  "CLOUDFLARE_WORKERS_REQUESTS_24H",
  "CLOUDFLARE_WORKERS_REQUESTS_DAILY_LIMIT",
  "CLOUDFLARE_WORKERS_REQUESTS_30D",
  "CLOUDFLARE_WORKERS_REQUESTS_30D_LIMIT",
  "CLOUDFLARE_WORKERS_CPU_P99_MS",
  "CLOUDFLARE_WORKERS_CPU_P99_MS_LIMIT",
  "CLOUDFLARE_WORKERS_SUBREQUESTS_30D",
  "CLOUDFLARE_WORKERS_SUBREQUESTS_30D_LIMIT",
  "CLOUDFLARE_KV_READS_24H",
  "CLOUDFLARE_KV_READS_DAILY_LIMIT",
  "CLOUDFLARE_KV_WRITES_24H",
  "CLOUDFLARE_KV_WRITES_DAILY_LIMIT",
  "CLOUDFLARE_KV_STORAGE_GB",
  "CLOUDFLARE_KV_STORAGE_GB_LIMIT",
  "CLOUDFLARE_CDN_BANDWIDTH_30D_GB",
  "CLOUDFLARE_CDN_BANDWIDTH_30D_GB_LIMIT",
  "CLOUDFLARE_CDN_REQUESTS_30D",
  "CLOUDFLARE_CDN_REQUESTS_30D_LIMIT",
  "CLOUDFLARE_CDN_UNCACHED_BANDWIDTH_30D_GB",
  "CLOUDFLARE_CDN_UNCACHED_BANDWIDTH_30D_GB_LIMIT",
  "CLOUDFLARE_TURNSTILE_VALIDATIONS_30D",
  "CLOUDFLARE_TURNSTILE_VALIDATIONS_30D_LIMIT",
  "CLOUDFLARE_ENABLE_R2_GUARDRAILS",
  "CLOUDFLARE_ENABLE_D1_GUARDRAILS",
  "CLOUDFLARE_ENABLE_QUEUES_GUARDRAILS",
  "CLOUDFLARE_ENABLE_DURABLE_OBJECTS_GUARDRAILS",
  "CLOUDFLARE_ENABLE_IMAGES_GUARDRAILS",
  "CLOUDFLARE_ENABLE_PAGES_GUARDRAILS",
  "10 ms CPU limit per invocation",
  "approved-original image cache",
  "free tier does not apply to Infrequent Access storage",
  "1,000,000 Class A operations/month",
  "10,000,000 Class B operations/month",
  "free internet egress",
  "5,000 unique transformations/month",
  "error 9422",
  "Cloudflare Images hosted storage/delivery is paid-only",
  "freeze new transform variants at 90%",
];

for (const token of cloudflareMetricTokens) {
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
  "Workers requests, last 24h",
  "Workers requests, last 30d",
  "Workers CPU p99",
  "Workers KV reads, last 24h",
  "Workers KV writes, last 24h",
  "Workers KV storage",
  "Cloudflare CDN bandwidth, last 30d",
  "Cloudflare CDN requests, last 30d",
  "Cloudflare uncached bandwidth, last 30d",
  "Turnstile validations, last 30d",
]) {
  assertIncludes(guardrails, token, "adminCostGuardrails.ts");
}

for (const token of [
  "metric.sourceUrl",
  "metric.sourceLabel",
  "metric.inputNames",
  'unit === "hours"',
  'unit === "GB-Hrs"',
  'unit === "ms"',
]) {
  assertIncludes(page, token, "guardrails page");
}

if (packageJson.scripts?.["test:admin-guardrails"] !== "node ../scripts/admin_guardrails_regression.mjs") {
  throw new Error("package.json is missing test:admin-guardrails script");
}

console.log("Admin guardrails regression checks passed.");
