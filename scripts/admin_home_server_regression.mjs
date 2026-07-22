#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function assertIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label} is missing required home-server dashboard token: ${needle}`);
  }
}

const lib = read("web/lib/adminHomeServer.ts");
const page = read("web/app/admin/(protected)/home-server/page.tsx");
const adminHome = read("web/app/admin/(protected)/page.tsx");
const packageJson = JSON.parse(read("web/package.json"));

for (const required of [
  'const DEFAULT_HOME_SERVER_STATS_URL = "https://ai.nutsnews.com/stats";',
  "process.env.HOME_SERVER_STATS_URL?.trim()",
  "process.env.HOME_SERVER_STATS_API_KEY",
  "process.env.LOCAL_AI_API_KEY",
  '"x-nutsnews-ai-key": statsApiKey',
  'cache: "no-store"',
  "status === 401 || status === 403",
  "Home server stats endpoint rejected HOME_SERVER_STATS_API_KEY",
  "status === 404",
  "Set HOME_SERVER_STATS_URL to ${DEFAULT_HOME_SERVER_STATS_URL}",
  "/api/stats, /healthz, and /readyz are not stats endpoints",
  "status === 503",
  "Home server stats request timed out after",
  "protected VPS runtime sync",
]) {
  assertIncludes(lib, required, "adminHomeServer.ts");
}

for (const forbidden of [
  'String((payload as { error?: unknown }).error)',
  "Unable to load home server stats from the local AI service.",
]) {
  if (lib.includes(forbidden)) {
    throw new Error(`adminHomeServer.ts must not expose the old generic error path: ${forbidden}`);
  }
}

for (const required of [
  'title: "Home Server | NutsNews Admin"',
  'export const dynamic = "force-dynamic"',
  'export const runtime = "nodejs"',
  "Home Server Dashboard",
  "CPU, Memory, and Disk",
  "Critical Services",
  "Local AI Runtime",
  "Installed Models",
  "HOME_SERVER_STATS_URL=https://ai.nutsnews.com/stats",
  "HOME_SERVER_STATS_API_KEY=<same value as LOCAL_AI_API_KEY on the home server>",
  "Stats Not Available",
]) {
  assertIncludes(page, required, "home-server page");
}

assertIncludes(adminHome, 'href="/admin/home-server"', "admin landing page");

if (packageJson.scripts?.["test:admin-home-server"] !== "node ../scripts/admin_home_server_regression.mjs") {
  throw new Error("web/package.json is missing test:admin-home-server");
}

console.log("Admin home-server dashboard regression checks passed.");
