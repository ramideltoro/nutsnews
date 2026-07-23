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
    throw new Error(`${label} is missing required failover dashboard token: ${needle}`);
  }
}

const page = read("web/app/admin/(protected)/failover/page.tsx");
const lib = read("web/lib/adminFailover.ts");
const contract = read("web/lib/failoverStatusContract.ts");
const adminHome = read("web/app/admin/(protected)/page.tsx");
const protectedLayout = read("web/app/admin/(protected)/layout.tsx");
const packageJson = JSON.parse(read("web/package.json"));

for (const token of [
  'title: "Failover | NutsNews Admin"',
  'export const dynamic = "force-dynamic"',
  'export const runtime = "nodejs"',
  "getAdminFailoverDashboardData",
  "performAdminFailoverAction",
  "Active DNS Target",
  "Manual Failover Controls",
  "failoverManualAction",
  "Cloudflare DNS",
  "Apex and WWW Targets",
  "Observed Live Origin",
  "Latest VPS Health Check",
  "Recent Health Checks",
  "Recent DNS Changes",
  "Manual Lock",
  "Manual Action Audit",
  "Failure Streak",
  "Runbook and External Dashboards",
  "NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET=<shared controller status secret>",
  "NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET=<shared controller action secret>",
]) {
  assertIncludes(page, token, "admin failover page");
}

for (const token of [
  'import "server-only"',
  "createHmac",
  "X-NutsNews-Failover-Signature",
  "X-NutsNews-Failover-Timestamp",
  "NUTSNEWS_FAILOVER_CONTROLLER_STATUS_URL",
  "NUTSNEWS_FAILOVER_CONTROLLER_ACTION_URL",
  "NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET",
  "NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET",
  "NUTSNEWS_FAILOVER_RUNBOOK_URL",
  "NUTSNEWS_FAILOVER_CLOUDFLARE_DASHBOARD_URL",
  "cache: \"no-store\"",
  "HISTORY_UNAVAILABLE_MESSAGE",
  "DNS_HISTORY_UNAVAILABLE_MESSAGE",
  "AUDIT_UNAVAILABLE_MESSAGE",
  "signedActionHeaders",
  "sha256Hex",
  "Historical health-check and DNS-change rows",
  "healthHistoryAvailable",
  "controller_history",
  "sanitizeStatus",
  "sanitizeHealthHistory",
  "sanitizeAuditEvent",
  "liveOriginReadiness",
  "healthHistory",
  "formatFailoverTarget",
]) {
  assertIncludes(lib, token, "adminFailover.ts");
}

for (const token of [
  "FAILOVER_LIVE_ORIGIN_CLASSIFICATIONS",
  "FAILOVER_LIVE_ORIGIN_DNS_STATES",
  "FailoverLiveOriginReadiness",
  "FailoverHealthHistoryRow",
  "FAILOVER_STATUS_OPTIONAL_FIELDS",
  "FAILOVER_MANUAL_ACTIONS",
  "FAILOVER_MANUAL_ACTION_CONFIRMATIONS",
  "FAILOVER TO VERCEL",
  "FAILBACK TO VPS",
  "ENABLE MANUAL LOCK",
  "DISABLE MANUAL LOCK",
  "FailoverManualAuditEvent",
  "liveOriginReadiness",
  "healthHistory",
]) {
  assertIncludes(contract, token, "failoverStatusContract.ts");
}

assertIncludes(adminHome, 'href="/admin/failover"', "admin landing page");
assertIncludes(protectedLayout, "isAllowedAdminEmail(email)", "protected admin layout");

for (const forbidden of [
  "cloudflareApiToken",
  "dnsProviderToken",
  "originIp",
  "vpsOriginIp",
  "readinessRequestHeaders",
]) {
  if (page.includes(forbidden) || lib.includes(`.${forbidden}`)) {
    throw new Error(`failover dashboard must not render sensitive field ${forbidden}`);
  }
}

if (packageJson.scripts?.["test:admin-failover"] !== "node ../scripts/admin_failover_dashboard_regression.mjs") {
  throw new Error("web/package.json is missing test:admin-failover");
}

console.log("Admin failover dashboard regression checks passed.");
