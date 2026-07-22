import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

const contractPath = resolve(import.meta.dirname, "../web/lib/failoverStatusContract.ts");
const contractSource = await readFile(contractPath, "utf8");

function assertIncludes(value, message) {
  assert.match(contractSource, new RegExp(String.raw`\b${value}\b`), message);
}

test("failover status contract keeps the required issue #404 fields", () => {
  for (const field of [
    "activeDnsTarget",
    "desiredDnsTarget",
    "actualApexDnsTarget",
    "actualWwwDnsTarget",
    "observedDeploymentTarget",
    "lastVpsCheckAt",
    "lastVpsReachable",
    "lastVpsStatus",
    "lastVpsLatencyMs",
    "consecutiveVpsFailures",
    "failureThreshold",
    "checkIntervalSeconds",
    "lastDnsChangeAt",
    "lastDnsChangeReason",
    "manualLock",
    "nextCheckDueAt",
    "controllerVersion",
  ]) {
    assertIncludes(field, `${field} must remain part of the status contract`);
  }

  assertIncludes("nutsnews.failover.status.v1", "status schema version must be explicit");
  assertIncludes("FailoverStatus", "TypeScript status type must exist");
  assertIncludes("failoverStatusJsonSchema", "versioned JSON schema must exist");
});

test("failover status contract fixes the rollout thresholds and controller stale window", () => {
  assertIncludes("FAILOVER_CHECK_INTERVAL_SECONDS = 15", "health checks must stay on the 15-second contract");
  assertIncludes("FAILOVER_FAILURE_THRESHOLD = 3", "failover must require 3 consecutive VPS failures");
  assertIncludes("FAILOVER_CONTROLLER_STALE_AFTER_SECONDS = 60", "stale status threshold must stay at 60 seconds");
});

test("failover status contract defines the DNS target, health result, and DNS action enums", () => {
  for (const value of ["vps", "vercel", "unknown", "unmanaged"]) {
    assertIncludes(value, `DNS target classification must include ${value}`);
  }

  for (const value of [
    "reachable",
    "http_status_unreachable",
    "network_error",
    "timeout",
    "deployment_target_mismatch",
    "invalid_readiness_response",
  ]) {
    assertIncludes(value, `health result enum must include ${value}`);
  }

  for (const value of [
    "dns_readback",
    "failover_to_vercel",
    "failback_to_vps",
    "manual_failover_to_vercel",
    "manual_failback_to_vps",
    "reconcile_dns_to_vps",
    "reconcile_dns_to_vercel",
  ]) {
    assertIncludes(value, `DNS action enum must include ${value}`);
  }
});

test("failover status contract documents state coverage, unreachable health, and safe field exposure", () => {
  for (const state of [
    "healthyVpsPrimary",
    "failedOverVercel",
    "failbackPending",
    "manualLock",
    "staleController",
  ]) {
    assertIncludes(state, `${state} example must exist`);
  }

  for (const condition of [
    "readiness fetch returns a network, DNS, TLS, connection, or timeout error",
    "readiness fetch returns an HTTP status outside 200-299",
    "readiness response reports a deployment target other than production-vps",
  ]) {
    assert.ok(contractSource.includes(condition), `VPS unreachable condition is missing: ${condition}`);
  }

  assertIncludes("FAILOVER_PUBLIC_SAFE_STATUS_FIELDS", "public-safe field list must exist");
  assertIncludes("FAILOVER_INTERNAL_ONLY_FIELD_NAMES", "internal-only field denylist must exist");
  for (const internalName of [
    "cloudflareApiToken",
    "originIp",
    "vpsOriginIp",
    "dnsProviderToken",
    "readinessRequestHeaders",
  ]) {
    assertIncludes(internalName, `${internalName} must be documented as internal-only`);
  }
});
