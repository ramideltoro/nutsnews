import "server-only";

import { createHash, createHmac, randomUUID } from "node:crypto";

import {
  FAILOVER_CHECK_INTERVAL_SECONDS,
  FAILOVER_CONTROLLER_STALE_AFTER_SECONDS,
  FAILOVER_DNS_ACTIONS,
  FAILOVER_DNS_HISTORY_ACTIONS,
  FAILOVER_DNS_HISTORY_RESULTS,
  FAILOVER_DNS_TARGETS,
  FAILOVER_DNS_TARGET_CLASSIFICATIONS,
  FAILOVER_HEALTH_RESULTS,
  FAILOVER_LIVE_ORIGIN_CACHE_STATES,
  FAILOVER_LIVE_ORIGIN_CLASSIFICATIONS,
  FAILOVER_LIVE_ORIGIN_DNS_STATES,
  FAILOVER_LIVE_ORIGIN_ERROR_CODES,
  FAILOVER_MANUAL_ACTIONS,
  FAILOVER_AUDIT_RESULTS,
  FAILOVER_OBSERVED_DEPLOYMENT_TARGETS,
  FAILOVER_STATUS_SCHEMA_VERSION,
  FAILOVER_STALE_REASONS,
  FAILOVER_VPS_STATUS_CODES,
  type FailoverAuditResult,
  type FailoverDnsAction,
  type FailoverDnsHistoryAction,
  type FailoverDnsHistoryResult,
  type FailoverDnsHistoryRow,
  type FailoverDnsTarget,
  type FailoverDnsTargetClassification,
  type FailoverHealthHistoryRow,
  type FailoverHealthResult,
  type FailoverLiveOriginCacheState,
  type FailoverLiveOriginClassification,
  type FailoverLiveOriginDnsState,
  type FailoverLiveOriginErrorCode,
  type FailoverLiveOriginHostReadiness,
  type FailoverLiveOriginReadiness,
  type FailoverManualAction,
  type FailoverManualAuditEvent,
  type FailoverObservedDeploymentTarget,
  type FailoverStatus,
  type FailoverStaleReason,
  type FailoverVpsStatus,
} from "@/lib/failoverStatusContract";
import { formatAdminDateTime } from "@/lib/adminTime";

const DEFAULT_CONTROLLER_STATUS_URL = "https://nutsnews-controller.nutsnews.workers.dev/status?mode=dashboard";
const DEFAULT_CONTROLLER_ACTION_PATH = "/actions";
const DEFAULT_CONTROLLER_AUDIT_PATH = "/actions/audit";
const STATUS_SIGNATURE_HEADER = "X-NutsNews-Failover-Signature";
const STATUS_TIMESTAMP_HEADER = "X-NutsNews-Failover-Timestamp";
const STATUS_SIGNATURE_VERSION = "v1";
const STATUS_FETCH_TIMEOUT_MS = 5_000;
const ACTION_FETCH_TIMEOUT_MS = 8_000;
const HISTORY_UNAVAILABLE_MESSAGE =
  "Historical health-check and DNS-change rows are not available from the current controller status API. Showing the latest public-safe status snapshot instead.";
const DNS_HISTORY_UNAVAILABLE_MESSAGE =
  "Recent health checks are loaded from controller history. DNS-change history is not exposed by the current controller status API, so DNS rows use the latest public-safe status snapshot.";
const HEALTH_HISTORY_UNAVAILABLE_MESSAGE =
  "Recent DNS changes are loaded from controller history. Health-check history is not available from the current controller status API, so health rows use the latest public-safe status snapshot.";
const AUDIT_UNAVAILABLE_MESSAGE =
  "Manual action audit rows are not available from the controller action API.";

export type FailoverDashboardTone = "ok" | "watch" | "danger" | "neutral";

export type FailoverTimelineRow = {
  id: string;
  timestamp: string | null;
  title: string;
  detail: string;
  value: string;
  tone: FailoverDashboardTone;
  source: "controller_history" | "status_snapshot" | "metrics_unavailable";
};

export type FailoverLink = {
  label: string;
  href: string;
  helper: string;
};

export type AdminFailoverDashboardData = {
  isConfigured: boolean;
  generatedAt: string;
  fetchedAt: string;
  statusUrl: string;
  status: FailoverStatus | null;
  errorMessage: string | null;
  overallTone: FailoverDashboardTone;
  overallLabel: string;
  statusAgeSeconds: number | null;
  statusAgeLabel: string;
  controllerReachable: boolean;
  recentHealthChecks: FailoverTimelineRow[];
  recentDnsChanges: FailoverTimelineRow[];
  healthHistoryAvailable: boolean;
  dnsHistoryAvailable: boolean;
  historyAvailable: boolean;
  historyMessage: string;
  actionsConfigured: boolean;
  actionUrl: string;
  auditEvents: FailoverManualAuditEvent[];
  auditAvailable: boolean;
  auditMessage: string;
  links: FailoverLink[];
};

export type AdminFailoverActionInput = {
  actorEmail: string;
  action: string;
  confirmation: string;
  reason: string;
  expected: {
    activeDnsTarget: string;
    actualApexDnsTarget: string;
    actualWwwDnsTarget: string;
    statusGeneratedAt: string;
  };
};

export type AdminFailoverActionResult = {
  ok: boolean;
  message: string;
  error: string | null;
  expectedDnsTarget: FailoverDnsTarget | null;
  activeDnsTarget: FailoverDnsTarget | null;
  manualLock: boolean | null;
};

type FailoverStatusConfig = {
  statusUrl: string;
  actionUrl: string;
  auditUrl: string;
  hmacSecret: string;
  actionHmacSecret: string;
  runbookUrl: string;
  cloudflareDashboardUrl: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function publicHttpsUrl(value: unknown, fallback = "", { allowLocalHttp = false } = {}) {
  const raw = clean(value || fallback);

  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);

    const isLocalHttp =
      allowLocalHttp &&
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1");

    if ((url.protocol !== "https:" && !isLocalHttp) || url.username || url.password) {
      return fallback;
    }

    return url.toString();
  } catch {
    return fallback;
  }
}

function appendDashboardMode(value: string) {
  const url = new URL(value);

  url.search = "";
  url.searchParams.set("mode", "dashboard");

  return url.toString();
}

function actionUrlFromStatusUrl(statusUrl: string, path = DEFAULT_CONTROLLER_ACTION_PATH) {
  return new URL(path, statusUrl).toString();
}

function readConfig(): FailoverStatusConfig {
  const statusUrl = appendDashboardMode(
    publicHttpsUrl(
      process.env.NUTSNEWS_FAILOVER_CONTROLLER_STATUS_URL,
      DEFAULT_CONTROLLER_STATUS_URL,
      { allowLocalHttp: true },
    ),
  );
  const actionUrl = publicHttpsUrl(
    process.env.NUTSNEWS_FAILOVER_CONTROLLER_ACTION_URL,
    actionUrlFromStatusUrl(statusUrl),
    { allowLocalHttp: true },
  );

  return {
    statusUrl,
    actionUrl,
    auditUrl: actionUrlFromStatusUrl(actionUrl, DEFAULT_CONTROLLER_AUDIT_PATH),
    hmacSecret: clean(process.env.NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET),
    actionHmacSecret: clean(process.env.NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET),
    runbookUrl: publicHttpsUrl(process.env.NUTSNEWS_FAILOVER_RUNBOOK_URL),
    cloudflareDashboardUrl: publicHttpsUrl(process.env.NUTSNEWS_FAILOVER_CLOUDFLARE_DASHBOARD_URL),
  };
}

function signedHeaders(statusUrl: string, hmacSecret: string, now = Date.now()) {
  const url = new URL(statusUrl);
  const timestamp = String(Math.floor(now / 1000));
  const signedPath = `${url.pathname}${url.search}`;
  const payload = [
    STATUS_SIGNATURE_VERSION,
    "GET",
    signedPath,
    timestamp,
  ].join("\n");
  const signature = createHmac("sha256", hmacSecret).update(payload).digest("hex");

  return {
    Accept: "application/json",
    [STATUS_TIMESTAMP_HEADER]: timestamp,
    [STATUS_SIGNATURE_HEADER]: `${STATUS_SIGNATURE_VERSION}=${signature}`,
  };
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function signedActionHeaders(actionUrl: string, hmacSecret: string, method: string, bodyText = "", now = Date.now()) {
  const url = new URL(actionUrl);
  const timestamp = String(Math.floor(now / 1000));
  const signedPath = `${url.pathname}${url.search}`;
  const payload = [
    STATUS_SIGNATURE_VERSION,
    method.toUpperCase(),
    signedPath,
    timestamp,
    sha256Hex(bodyText),
  ].join("\n");
  const signature = createHmac("sha256", hmacSecret).update(payload).digest("hex");

  return {
    Accept: "application/json",
    [STATUS_TIMESTAMP_HEADER]: timestamp,
    [STATUS_SIGNATURE_HEADER]: `${STATUS_SIGNATURE_VERSION}=${signature}`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function oneOf<const T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return allowed.includes(value as T[number]) ? value as T[number] : fallback;
}

function optionalOneOf<const T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  return allowed.includes(value as T[number]) ? value as T[number] : null;
}

function optionalIsoDate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Date.parse(String(value));

  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function requiredIsoDate(value: unknown, fallbackMs: number) {
  return optionalIsoDate(value) ?? new Date(fallbackMs).toISOString();
}

function finiteInteger(value: unknown, fallback: number | null, minimum = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= minimum ? Math.floor(parsed) : fallback;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function identityText(value: unknown, fallback = "unknown") {
  const candidate = clean(value);

  return /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,127}$/.test(candidate) ? candidate : fallback;
}

function actorEmail(value: unknown) {
  const candidate = clean(value).toLowerCase();

  return /^[a-z0-9._%+-]{1,96}@[a-z0-9.-]{1,96}\.[a-z]{2,24}$/.test(candidate)
    ? candidate
    : "unknown-admin@example.invalid";
}

function safeDisplayText(value: unknown, fallback = "None", maxLength = 280) {
  const candidate = clean(value)
    .replace(/\s+/gu, " ")
    .slice(0, maxLength);

  return candidate || fallback;
}

function readinessCode(value: unknown, fallback = "unknown") {
  const candidate = clean(value);

  return /^[a-z][a-z0-9_]{1,63}$/.test(candidate) ? candidate : fallback;
}

function vpsStatus(value: unknown): FailoverVpsStatus {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599) {
    return value;
  }

  return oneOf(value, FAILOVER_VPS_STATUS_CODES, "network_error");
}

function httpStatus(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : null;
}

function liveOriginError(value: unknown): FailoverLiveOriginErrorCode | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return oneOf(value, FAILOVER_LIVE_ORIGIN_ERROR_CODES, "network_error");
}

function sanitizeLiveOriginHost(
  value: unknown,
  hostname: string,
  fallbackCheckedAt: string,
): FailoverLiveOriginHostReadiness {
  const row = isRecord(value) ? value : {};

  return {
    checkedAt: requiredIsoDate(row.checkedAt, Date.parse(fallbackCheckedAt)),
    hostname,
    ok: booleanValue(row.ok),
    origin: oneOf(
      row.origin,
      FAILOVER_LIVE_ORIGIN_CLASSIFICATIONS,
      "unknown",
    ) as FailoverLiveOriginClassification,
    status: httpStatus(row.status),
    latencyMs: finiteInteger(row.latencyMs, null),
    deploymentTarget: identityText(row.deploymentTarget),
    sourceCommit: identityText(row.sourceCommit),
    buildId: identityText(row.buildId),
    readinessCode: readinessCode(row.readinessCode),
    runtimeEnv: identityText(row.runtimeEnv),
    sideEffectsMode: readinessCode(row.sideEffectsMode),
    databaseProviderMode: readinessCode(row.databaseProviderMode),
    productionWritesPaused: typeof row.productionWritesPaused === "boolean" ? row.productionWritesPaused : null,
    cacheState: oneOf(
      row.cacheState,
      FAILOVER_LIVE_ORIGIN_CACHE_STATES,
      "unknown",
    ) as FailoverLiveOriginCacheState,
    error: liveOriginError(row.error),
  };
}

function sanitizeLiveOriginReadiness(value: unknown, nowMs: number): FailoverLiveOriginReadiness {
  const row = isRecord(value) ? value : {};
  const checkedAt = requiredIsoDate(row.checkedAt, nowMs);

  return {
    checkedAt,
    dnsState: oneOf(
      row.dnsState,
      FAILOVER_LIVE_ORIGIN_DNS_STATES,
      "unknown",
    ) as FailoverLiveOriginDnsState,
    apex: sanitizeLiveOriginHost(row.apex, "nutsnews.com", checkedAt),
    www: sanitizeLiveOriginHost(row.www, "www.nutsnews.com", checkedAt),
  };
}

function healthHistorySource(value: unknown) {
  const candidate = clean(value).toLowerCase();

  return /^[a-z][a-z0-9_:-]{1,63}$/.test(candidate) ? candidate : "unknown";
}

function healthHistoryErrorCode(value: unknown, healthResult: FailoverHealthResult) {
  const fallback = healthResult === "reachable" || healthResult === "unknown" ? null : healthResult;

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const candidate = clean(value).toLowerCase();

  return /^[a-z][a-z0-9_]{1,63}$/.test(candidate) ? candidate : fallback;
}

function sanitizeHealthHistoryRow(value: unknown): FailoverHealthHistoryRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const checkedAt = optionalIsoDate(value.checkedAt);
  if (!checkedAt) {
    return null;
  }

  const healthResult = oneOf(value.healthResult, FAILOVER_HEALTH_RESULTS, "unknown") as FailoverHealthResult;

  return {
    checkedAt,
    source: healthHistorySource(value.source),
    healthResult,
    vpsReachable: typeof value.vpsReachable === "boolean"
      ? value.vpsReachable
      : healthResult === "reachable",
    vpsStatus: vpsStatus(value.vpsStatus),
    vpsLatencyMs: finiteInteger(value.vpsLatencyMs, null),
    observedDeploymentTarget: oneOf(
      value.observedDeploymentTarget,
      FAILOVER_OBSERVED_DEPLOYMENT_TARGETS,
      "unexpected",
    ) as FailoverObservedDeploymentTarget,
    consecutiveVpsFailures: finiteInteger(value.consecutiveVpsFailures, 0) ?? 0,
    activeDnsTarget: oneOf(
      value.activeDnsTarget,
      FAILOVER_DNS_TARGET_CLASSIFICATIONS,
      "unknown",
    ) as FailoverDnsTargetClassification,
    desiredDnsTarget: oneOf(
      value.desiredDnsTarget,
      FAILOVER_DNS_TARGET_CLASSIFICATIONS,
      "unknown",
    ) as FailoverDnsTargetClassification,
    errorCode: healthHistoryErrorCode(value.errorCode, healthResult),
  };
}

function sanitizeHealthHistory(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => sanitizeHealthHistoryRow(row))
    .filter((row): row is FailoverHealthHistoryRow => row !== null)
    .slice(0, 20);
}

function historyCode(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const candidate = clean(value).toLowerCase();

  return /^[a-z][a-z0-9_]{1,63}$/.test(candidate) ? candidate : null;
}

function sanitizeDnsHistoryRow(value: unknown): FailoverDnsHistoryRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const changedAt = optionalIsoDate(value.changedAt);
  if (!changedAt) {
    return null;
  }

  return {
    changedAt,
    dnsAction: oneOf(value.dnsAction, FAILOVER_DNS_HISTORY_ACTIONS, "no_op") as FailoverDnsHistoryAction,
    previousTarget: oneOf(
      value.previousTarget,
      FAILOVER_DNS_TARGET_CLASSIFICATIONS,
      "unknown",
    ) as FailoverDnsTargetClassification,
    newTarget: oneOf(
      value.newTarget,
      FAILOVER_DNS_TARGET_CLASSIFICATIONS,
      "unknown",
    ) as FailoverDnsTargetClassification,
    activeDnsTarget: oneOf(
      value.activeDnsTarget,
      FAILOVER_DNS_TARGET_CLASSIFICATIONS,
      "unknown",
    ) as FailoverDnsTargetClassification,
    desiredDnsTarget: oneOf(
      value.desiredDnsTarget,
      FAILOVER_DNS_TARGET_CLASSIFICATIONS,
      "unknown",
    ) as FailoverDnsTargetClassification,
    actualApexDnsTarget: oneOf(
      value.actualApexDnsTarget,
      FAILOVER_DNS_TARGET_CLASSIFICATIONS,
      "unknown",
    ) as FailoverDnsTargetClassification,
    actualWwwDnsTarget: oneOf(
      value.actualWwwDnsTarget,
      FAILOVER_DNS_TARGET_CLASSIFICATIONS,
      "unknown",
    ) as FailoverDnsTargetClassification,
    result: oneOf(value.result, FAILOVER_DNS_HISTORY_RESULTS, "unknown") as FailoverDnsHistoryResult,
    skipReason: historyCode(value.skipReason),
    errorCode: historyCode(value.errorCode),
  };
}

function sanitizeDnsHistory(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => sanitizeDnsHistoryRow(row))
    .filter((row): row is FailoverDnsHistoryRow => row !== null)
    .slice(0, 20);
}

function sanitizeStatus(value: unknown, nowMs = Date.now()): FailoverStatus | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.schemaVersion !== FAILOVER_STATUS_SCHEMA_VERSION) {
    return null;
  }

  return {
    schemaVersion: FAILOVER_STATUS_SCHEMA_VERSION,
    generatedAt: requiredIsoDate(value.generatedAt, nowMs),
    controllerState: oneOf(value.controllerState, [
      "vps_primary_healthy",
      "vps_health_degraded",
      "failed_over_vercel",
      "failback_pending",
      "manual_lock",
      "dns_drift",
      "stale",
    ] as const, "stale"),
    activeDnsTarget: oneOf(value.activeDnsTarget, FAILOVER_DNS_TARGETS, "vps") as FailoverDnsTarget,
    desiredDnsTarget: oneOf(value.desiredDnsTarget, FAILOVER_DNS_TARGETS, "vps") as FailoverDnsTarget,
    actualApexDnsTarget: oneOf(
      value.actualApexDnsTarget,
      FAILOVER_DNS_TARGET_CLASSIFICATIONS,
      "unknown",
    ) as FailoverDnsTargetClassification,
    actualWwwDnsTarget: oneOf(
      value.actualWwwDnsTarget,
      FAILOVER_DNS_TARGET_CLASSIFICATIONS,
      "unknown",
    ) as FailoverDnsTargetClassification,
    observedDeploymentTarget: oneOf(
      value.observedDeploymentTarget,
      FAILOVER_OBSERVED_DEPLOYMENT_TARGETS,
      "unknown",
    ) as FailoverObservedDeploymentTarget,
    liveOriginReadiness: sanitizeLiveOriginReadiness(value.liveOriginReadiness, nowMs),
    lastHealthResult: oneOf(value.lastHealthResult, FAILOVER_HEALTH_RESULTS, "unknown") as FailoverHealthResult,
    lastVpsCheckAt: optionalIsoDate(value.lastVpsCheckAt),
    lastVpsReachable: booleanValue(value.lastVpsReachable),
    lastVpsStatus: vpsStatus(value.lastVpsStatus),
    lastVpsLatencyMs: finiteInteger(value.lastVpsLatencyMs, null),
    consecutiveVpsFailures: finiteInteger(value.consecutiveVpsFailures, 0) ?? 0,
    failureThreshold: finiteInteger(value.failureThreshold, 3) === 3 ? 3 : 3,
    checkIntervalSeconds: finiteInteger(value.checkIntervalSeconds, FAILOVER_CHECK_INTERVAL_SECONDS) === FAILOVER_CHECK_INTERVAL_SECONDS
      ? FAILOVER_CHECK_INTERVAL_SECONDS
      : FAILOVER_CHECK_INTERVAL_SECONDS,
    lastDnsChangeAt: optionalIsoDate(value.lastDnsChangeAt),
    lastDnsChangeReason: oneOf(value.lastDnsChangeReason, FAILOVER_DNS_ACTIONS, "none") as FailoverDnsAction,
    manualLock: booleanValue(value.manualLock),
    nextCheckDueAt: optionalIsoDate(value.nextCheckDueAt),
    stale: booleanValue(value.stale),
    staleReason: value.staleReason === null || value.staleReason === undefined || value.staleReason === ""
      ? null
      : oneOf(value.staleReason, FAILOVER_STALE_REASONS, "status_update_overdue") as FailoverStaleReason,
    controllerVersion: identityText(value.controllerVersion, "unknown"),
    healthHistory: sanitizeHealthHistory(value.healthHistory),
    dnsHistory: sanitizeDnsHistory(value.dnsHistory),
  };
}

function sanitizeAuditEvent(value: unknown, nowMs = Date.now()): FailoverManualAuditEvent | null {
  if (!isRecord(value)) {
    return null;
  }

  const action = optionalOneOf(value.action, FAILOVER_MANUAL_ACTIONS);
  const result = optionalOneOf(value.result, FAILOVER_AUDIT_RESULTS);

  if (!action || !result) {
    return null;
  }

  return {
    id: identityText(value.id),
    createdAt: requiredIsoDate(value.createdAt, nowMs),
    actor: actorEmail(value.actor),
    action: action as FailoverManualAction,
    previousTarget: oneOf(
      value.previousTarget,
      FAILOVER_DNS_TARGET_CLASSIFICATIONS,
      "unknown",
    ) as FailoverDnsTargetClassification,
    newTarget: oneOf(
      value.newTarget,
      FAILOVER_DNS_TARGET_CLASSIFICATIONS,
      "unknown",
    ) as FailoverDnsTargetClassification,
    reason: safeDisplayText(value.reason, "No reason provided."),
    result: result as FailoverAuditResult,
    message: safeDisplayText(value.message, "No action detail."),
    manualLock: booleanValue(value.manualLock),
    idempotencyKey: identityText(value.idempotencyKey),
  };
}

function sanitizeAuditEvents(value: unknown, nowMs = Date.now()) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((event) => sanitizeAuditEvent(event, nowMs))
    .filter((event): event is FailoverManualAuditEvent => event !== null)
    .slice(0, 30);
}

function ageSeconds(value: string | null, nowMs: number) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.round((nowMs - parsed) / 1000));
}

function formatAge(seconds: number | null) {
  if (seconds === null) {
    return "Unknown age";
  }

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round((minutes / 60) * 10) / 10;

  return `${hours}h ago`;
}

function targetLabel(value: string) {
  if (value === "vps") {
    return "VPS";
  }

  if (value === "vercel") {
    return "Vercel";
  }

  if (value === "unmanaged") {
    return "Unmanaged";
  }

  if (value === "unreachable") {
    return "Unreachable";
  }

  return "Unknown";
}

function statusTone(status: FailoverStatus | null, statusAge: number | null): FailoverDashboardTone {
  if (!status) {
    return "danger";
  }

  if (status.stale || status.controllerState === "stale") {
    return "danger";
  }

  if (typeof statusAge === "number" && statusAge > FAILOVER_CONTROLLER_STALE_AFTER_SECONDS) {
    return "danger";
  }

  if (
    status.controllerState === "dns_drift" ||
    status.liveOriginReadiness.dnsState === "mismatch" ||
    status.liveOriginReadiness.dnsState === "unreachable"
  ) {
    return "danger";
  }

  if (
    status.manualLock ||
    status.activeDnsTarget === "vercel" ||
    status.desiredDnsTarget !== status.activeDnsTarget ||
    status.lastHealthResult !== "reachable"
  ) {
    return "watch";
  }

  return "ok";
}

function overallLabel(
  status: FailoverStatus | null,
  tone: FailoverDashboardTone,
  statusAge: number | null,
) {
  if (!status) {
    return "Status unavailable";
  }

  if (tone === "danger") {
    return status.stale || (typeof statusAge === "number" && statusAge > FAILOVER_CONTROLLER_STALE_AFTER_SECONDS)
      ? "Stale controller data"
      : "Drift or failover risk";
  }

  if (tone === "watch") {
    if (status.activeDnsTarget === "vercel") {
      return "Serving from Vercel";
    }

    if (status.manualLock) {
      return "Manual lock enabled";
    }

    return "Needs operator review";
  }

  return "VPS primary healthy";
}

function buildHealthRows(status: FailoverStatus | null): FailoverTimelineRow[] {
  if (!status) {
    return [];
  }

  const history = status.healthHistory ?? [];
  if (history.length > 0) {
    return history.map((row, index) => {
      const statusValue = typeof row.vpsStatus === "number" ? String(row.vpsStatus) : row.vpsStatus ?? "n/a";
      const latency = typeof row.vpsLatencyMs === "number" ? `${row.vpsLatencyMs}ms` : "no latency";
      const errorCode = row.errorCode ? `; error ${row.errorCode}` : "";

      return {
        id: `health-history-${row.checkedAt}-${index}`,
        timestamp: row.checkedAt,
        title: "VPS readiness check",
        detail: `${row.healthResult}; HTTP ${statusValue}; ${latency}; ${row.consecutiveVpsFailures}/${status.failureThreshold} consecutive failures; source ${row.source}${errorCode}.`,
        value: row.vpsReachable ? "Reachable" : "Unreachable",
        tone: row.vpsReachable ? "ok" : "danger",
        source: "controller_history",
      };
    });
  }

  const statusValue = typeof status.lastVpsStatus === "number" ? String(status.lastVpsStatus) : status.lastVpsStatus ?? "n/a";
  const latency = typeof status.lastVpsLatencyMs === "number" ? `${status.lastVpsLatencyMs}ms` : "no latency";

  return [
    {
      id: "latest-vps-check",
      timestamp: status.lastVpsCheckAt,
      title: "Latest VPS readiness check",
      detail: `${status.lastHealthResult}; HTTP ${statusValue}; ${latency}; ${status.consecutiveVpsFailures}/${status.failureThreshold} consecutive failures.`,
      value: status.lastVpsReachable ? "Reachable" : "Unreachable",
      tone: status.lastVpsReachable ? "ok" : "danger",
      source: "status_snapshot",
    },
  ];
}

function buildHistoryMessage(healthHistoryAvailable: boolean, dnsHistoryAvailable: boolean) {
  if (healthHistoryAvailable && !dnsHistoryAvailable) {
    return DNS_HISTORY_UNAVAILABLE_MESSAGE;
  }

  if (!healthHistoryAvailable && dnsHistoryAvailable) {
    return HEALTH_HISTORY_UNAVAILABLE_MESSAGE;
  }

  if (!healthHistoryAvailable && !dnsHistoryAvailable) {
    return HISTORY_UNAVAILABLE_MESSAGE;
  }

  return "";
}

function dnsActionLabel(value: FailoverDnsHistoryAction) {
  switch (value) {
    case "no_op":
      return "No DNS change";
    case "dns_readback":
      return "DNS readback";
    case "failover_to_vercel":
      return "Failover decision";
    case "failback_to_vps":
      return "Failback decision";
    case "manual_failover_to_vercel":
      return "Manual failover";
    case "manual_failback_to_vps":
      return "Manual failback";
    case "manual_lock_enabled":
      return "Manual lock enabled";
    case "manual_lock_disabled":
      return "Manual lock disabled";
    case "manual_lock_skip":
      return "Manual lock skip";
    case "dns_api_error":
      return "DNS API error";
    case "drift_detected":
      return "DNS drift detected";
    case "reconcile_dns_to_vps":
      return "Reconcile DNS to VPS";
    case "reconcile_dns_to_vercel":
      return "Reconcile DNS to Vercel";
    default:
      return "DNS decision";
  }
}

function dnsHistoryTone(row: FailoverDnsHistoryRow): FailoverDashboardTone {
  if (row.result === "failed" || row.result === "refused" || row.dnsAction === "dns_api_error" || row.dnsAction === "drift_detected") {
    return "danger";
  }

  if (row.result === "skipped" || row.activeDnsTarget === "vercel" || row.newTarget === "vercel") {
    return "watch";
  }

  return row.dnsAction === "no_op" ? "neutral" : "ok";
}

function dnsHistoryValue(row: FailoverDnsHistoryRow) {
  if (row.result === "failed") {
    return "Failed";
  }

  if (row.result === "refused") {
    return "Refused";
  }

  if (row.result === "skipped") {
    return "Skipped";
  }

  if (row.result === "duplicate") {
    return "Duplicate";
  }

  return targetLabel(row.newTarget);
}

function codeLabel(value: string | null) {
  return value ? value.replaceAll("_", " ") : "";
}

function buildDnsRows(status: FailoverStatus | null): FailoverTimelineRow[] {
  if (!status) {
    return [];
  }

  const history = status.dnsHistory ?? [];
  if (history.length > 0) {
    return history.map((row, index) => {
      const skipReason = row.skipReason ? `; skipped because ${codeLabel(row.skipReason)}` : "";
      const errorCode = row.errorCode ? `; error ${codeLabel(row.errorCode)}` : "";

      return {
        id: `dns-history-${row.changedAt}-${index}`,
        timestamp: row.changedAt,
        title: dnsActionLabel(row.dnsAction),
        detail: `${targetLabel(row.previousTarget)} to ${targetLabel(row.newTarget)}; active ${targetLabel(row.activeDnsTarget)}; desired ${targetLabel(row.desiredDnsTarget)}; apex ${targetLabel(row.actualApexDnsTarget)}; www ${targetLabel(row.actualWwwDnsTarget)}${skipReason}${errorCode}.`,
        value: dnsHistoryValue(row),
        tone: dnsHistoryTone(row),
        source: "controller_history",
      };
    });
  }

  if (!status.lastDnsChangeAt || status.lastDnsChangeReason === "none") {
    return [
      {
        id: "no-recent-dns-change",
        timestamp: status.generatedAt,
        title: "No DNS target change recorded",
        detail: `Apex is ${targetLabel(status.actualApexDnsTarget)} and www is ${targetLabel(status.actualWwwDnsTarget)}.`,
        value: "No change",
        tone: "neutral",
        source: "status_snapshot",
      },
    ];
  }

  return [
    {
      id: "latest-dns-change",
      timestamp: status.lastDnsChangeAt,
      title: "Latest DNS target change",
      detail: `Reason ${status.lastDnsChangeReason}; active target ${targetLabel(status.activeDnsTarget)}; desired target ${targetLabel(status.desiredDnsTarget)}.`,
      value: targetLabel(status.activeDnsTarget),
      tone: status.activeDnsTarget === "vps" ? "ok" : "watch",
      source: "status_snapshot",
    },
  ];
}

function buildLinks(config: FailoverStatusConfig): FailoverLink[] {
  const links: FailoverLink[] = [];

  if (config.runbookUrl) {
    links.push({
      label: "Failover runbook",
      href: config.runbookUrl,
      helper: "Operator notes for failover visibility and alert response.",
    });
  }

  if (config.cloudflareDashboardUrl) {
    links.push({
      label: "Cloudflare DNS",
      href: config.cloudflareDashboardUrl,
      helper: "Cloudflare dashboard deep link configured by the server.",
    });
  }

  return links;
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "Failover controller status request timed out.";
  }

  return "Failover controller status is not reachable from the admin server.";
}

function safeActionErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "Failover controller action request timed out.";
  }

  return "Failover controller action endpoint is not reachable from the admin server.";
}

async function fetchAuditEvents(config: FailoverStatusConfig, nowMs = Date.now()) {
  if (!config.actionHmacSecret) {
    return {
      auditEvents: [],
      auditAvailable: false,
      auditMessage: "Missing NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET for manual action audit history.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STATUS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(config.auditUrl, {
      method: "GET",
      headers: signedActionHeaders(config.auditUrl, config.actionHmacSecret, "GET", "", nowMs),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        auditEvents: [],
        auditAvailable: false,
        auditMessage: `Failover action audit returned HTTP ${response.status}.`,
      };
    }

    const payload = await response.json();
    const events = sanitizeAuditEvents(isRecord(payload) ? payload.auditEvents : [], nowMs);

    return {
      auditEvents: events,
      auditAvailable: true,
      auditMessage: events.length > 0 ? "Manual action audit loaded." : "No manual failover actions are recorded yet.",
    };
  } catch {
    return {
      auditEvents: [],
      auditAvailable: false,
      auditMessage: AUDIT_UNAVAILABLE_MESSAGE,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeActionResult(value: unknown, fallbackMessage: string): AdminFailoverActionResult {
  const row = isRecord(value) ? value : {};

  return {
    ok: booleanValue(row.ok),
    message: safeDisplayText(row.message, fallbackMessage),
    error: row.error === null || row.error === undefined || row.error === ""
      ? null
      : readinessCode(row.error, "manual_action_failed"),
    expectedDnsTarget: optionalOneOf(row.expectedDnsTarget, FAILOVER_DNS_TARGETS) as FailoverDnsTarget | null,
    activeDnsTarget: optionalOneOf(row.activeDnsTarget, FAILOVER_DNS_TARGETS) as FailoverDnsTarget | null,
    manualLock: typeof row.manualLock === "boolean" ? row.manualLock : null,
  };
}

function emptyData(config: FailoverStatusConfig, message: string, nowMs = Date.now()): AdminFailoverDashboardData {
  const now = new Date(nowMs).toISOString();

  return {
    isConfigured: Boolean(config.hmacSecret),
    generatedAt: now,
    fetchedAt: now,
    statusUrl: config.statusUrl,
    status: null,
    errorMessage: message,
    overallTone: "danger",
    overallLabel: "Status unavailable",
    statusAgeSeconds: null,
    statusAgeLabel: "Unknown age",
    controllerReachable: false,
    recentHealthChecks: [],
    recentDnsChanges: [],
    healthHistoryAvailable: false,
    dnsHistoryAvailable: false,
    historyAvailable: false,
    historyMessage: HISTORY_UNAVAILABLE_MESSAGE,
    actionsConfigured: Boolean(config.actionHmacSecret),
    actionUrl: config.actionUrl,
    auditEvents: [],
    auditAvailable: false,
    auditMessage: config.actionHmacSecret ? AUDIT_UNAVAILABLE_MESSAGE : "Missing NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET for manual controls.",
    links: buildLinks(config),
  };
}

export async function getAdminFailoverDashboardData(): Promise<AdminFailoverDashboardData> {
  const config = readConfig();
  const nowMs = Date.now();

  if (!config.hmacSecret) {
    return emptyData(
      config,
      "Missing NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET for the admin failover dashboard.",
      nowMs,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STATUS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(config.statusUrl, {
      method: "GET",
      headers: signedHeaders(config.statusUrl, config.hmacSecret, nowMs),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return emptyData(
        config,
        `Failover controller status returned HTTP ${response.status}.`,
        nowMs,
      );
    }

    const payload = await response.json();
    const status = sanitizeStatus(payload, nowMs);

    if (!status) {
      return emptyData(config, "Failover controller returned an unsupported status payload.", nowMs);
    }

    const statusAge = ageSeconds(status.generatedAt, nowMs);
    const tone = statusTone(status, statusAge);
    const audit = await fetchAuditEvents(config, nowMs);
    const healthHistoryAvailable = (status.healthHistory ?? []).length > 0;
    const dnsHistoryAvailable = (status.dnsHistory ?? []).length > 0;

    return {
      isConfigured: true,
      generatedAt: new Date(nowMs).toISOString(),
      fetchedAt: new Date(nowMs).toISOString(),
      statusUrl: config.statusUrl,
      status,
      errorMessage: null,
      overallTone: tone,
      overallLabel: overallLabel(status, tone, statusAge),
      statusAgeSeconds: statusAge,
      statusAgeLabel: formatAge(statusAge),
      controllerReachable: true,
      recentHealthChecks: buildHealthRows(status),
      recentDnsChanges: buildDnsRows(status),
      healthHistoryAvailable,
      dnsHistoryAvailable,
      historyAvailable: healthHistoryAvailable && dnsHistoryAvailable,
      historyMessage: buildHistoryMessage(healthHistoryAvailable, dnsHistoryAvailable),
      actionsConfigured: Boolean(config.actionHmacSecret),
      actionUrl: config.actionUrl,
      auditEvents: audit.auditEvents,
      auditAvailable: audit.auditAvailable,
      auditMessage: audit.auditMessage,
      links: buildLinks(config),
    };
  } catch (error) {
    return emptyData(config, safeErrorMessage(error), nowMs);
  } finally {
    clearTimeout(timeout);
  }
}

export async function performAdminFailoverAction(input: AdminFailoverActionInput): Promise<AdminFailoverActionResult> {
  const config = readConfig();
  const nowMs = Date.now();

  if (!config.actionHmacSecret) {
    return {
      ok: false,
      message: "Missing NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET for manual failover controls.",
      error: "action_auth_not_configured",
      expectedDnsTarget: null,
      activeDnsTarget: null,
      manualLock: null,
    };
  }

  const action = optionalOneOf(input.action, FAILOVER_MANUAL_ACTIONS);
  if (!action) {
    return {
      ok: false,
      message: "Unsupported manual failover action.",
      error: "unsupported_manual_action",
      expectedDnsTarget: null,
      activeDnsTarget: null,
      manualLock: null,
    };
  }

  const bodyText = JSON.stringify({
    action,
    actor: actorEmail(input.actorEmail),
    confirmation: clean(input.confirmation),
    reason: safeDisplayText(input.reason, "", 240),
    idempotencyKey: `web-admin-${Date.now()}-${randomUUID()}`,
    expected: {
      activeDnsTarget: oneOf(input.expected.activeDnsTarget, FAILOVER_DNS_TARGET_CLASSIFICATIONS, "unknown"),
      actualApexDnsTarget: oneOf(input.expected.actualApexDnsTarget, FAILOVER_DNS_TARGET_CLASSIFICATIONS, "unknown"),
      actualWwwDnsTarget: oneOf(input.expected.actualWwwDnsTarget, FAILOVER_DNS_TARGET_CLASSIFICATIONS, "unknown"),
      statusGeneratedAt: clean(input.expected.statusGeneratedAt).slice(0, 64),
    },
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ACTION_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(config.actionUrl, {
      method: "POST",
      headers: {
        ...signedActionHeaders(config.actionUrl, config.actionHmacSecret, "POST", bodyText, nowMs),
        "Content-Type": "application/json",
      },
      body: bodyText,
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    const result = sanitizeActionResult(
      payload,
      response.ok ? "Manual failover action completed." : `Failover controller action returned HTTP ${response.status}.`,
    );

    return {
      ...result,
      ok: response.ok && result.ok,
      message: result.message,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeActionErrorMessage(error),
      error: "manual_action_unreachable",
      expectedDnsTarget: null,
      activeDnsTarget: null,
      manualLock: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function formatFailoverTimestamp(value: string | null, fallback = "Unknown") {
  return formatAdminDateTime(value, fallback);
}

export function formatFailoverTarget(value: string) {
  return targetLabel(value);
}
