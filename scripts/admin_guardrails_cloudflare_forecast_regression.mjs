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
    throw new Error(`${label} is missing required token: ${needle}`);
  }
}

function assertNotIncludes(content, needle, label) {
  if (content.includes(needle)) {
    throw new Error(`${label} must not include stale token: ${needle}`);
  }
}

const guardrails = read("web/lib/adminCostGuardrails.ts");
const page = read("web/app/admin/(protected)/guardrails/page.tsx");
const packageJson = JSON.parse(read("web/package.json"));

for (const token of [
  'type ForecastStatus = "safe" | "approaching_limit" | "projected_to_breach" | "insufficient_trend_data"',
  "forecastDailyUsage: number | null",
  "forecastUsagePercent: number | null",
  "forecastStatus: ForecastStatus",
  "forecastReason: string",
  "function buildForecast",
  "function getCloudflareMetricTrend",
  "forecastSourceValue: trend.forecastSourceValue",
  "forecastSourceDays: trend.forecastSourceDays",
  "forecastInsufficientReason: trend.forecastInsufficientReason",
  "usage.workersRequests24h !== null",
  "metric.windowDays && value !== null",
  "workerScriptNames.length > 0 ? workerScriptNames : [null]",
  "const workerScriptFilter = workerScriptNames.length > 0 ?",
  "appendCloudflareUsageError",
  "Workers Analytics unavailable",
  "Zone HTTP Analytics unavailable",
  "mitigationForForecast",
  "riskLevelFromForecastStatus",
]) {
  assertIncludes(guardrails, token, "adminCostGuardrails.ts");
}

assertNotIncludes(
  guardrails,
  "Set CLOUDFLARE_WORKER_SCRIPT_NAMES to enable live Workers usage",
  "adminCostGuardrails.ts",
);

for (const token of [
  "forecastStatusLabel",
  "ForecastPill",
  "Approaching limit",
  "Projected to breach",
  "Insufficient trend data",
  "metric.forecastReason",
]) {
  assertIncludes(page, token, "guardrails page");
}

if (
  packageJson.scripts?.["test:admin-guardrails-cloudflare-forecast"] !==
  "node ../scripts/admin_guardrails_cloudflare_forecast_regression.mjs"
) {
  throw new Error("package.json is missing test:admin-guardrails-cloudflare-forecast script");
}

console.log("Admin guardrails Cloudflare forecast regression checks passed.");
