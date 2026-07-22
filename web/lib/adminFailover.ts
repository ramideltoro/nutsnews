import "server-only";

import { createHmac } from "node:crypto";

import {
  FAILOVER_CHECK_INTERVAL_SECONDS,
  FAILOVER_CONTROLLER_STALE_AFTER_SECONDS,
  FAILOVER_DNS_ACTIONS,
  FAILOVER_DNS_TARGETS,
  FAILOVER_DNS_TARGET_CLASSIFICATIONS,
  FAILOVER_HEALTH_RESULTS,
  FAILOVER_LIVE_ORIGIN_CACHE_STATES,
  FAILOVER_LIVE_ORIGIN_CLASSIFICATIONS,
  FAILOVER_LIVE_ORIGIN_DNS_STATES,
  FAILOVER_LIVE_ORIGIN_ERROR_CODES,
  FAILOVER_OBSERVED_DEPLOYMENT_TARGETS,
  FAILOVER_STATUS_SCHEMA_VERSION,
  FAILOVER_STALE_REASONS,
  FAILOVER_VPS_STATUS_CODES,
  type FailoverDnsAction,
  type FailoverDnsTarget,
  type FailoverDnsTargetClassification,
  type FailoverHealthResult,
  type FailoverLiveOriginCacheState,
  type FailoverLiveOriginClassification,
  type FailoverLiveOriginDnsState,
  type FailoverLiveOriginErrorCode,
  type FailoverLiveOriginHostReadiness,
  type FailoverLiveOriginReadiness,
  type FailoverObservedDeploymentTarget,
  type FailoverStatus,
  type FailoverStaleReason,
  type FailoverVpsStatus,
} from "@/lib/failoverStatusContract";
import { formatAdminDateTime } from "@/lib/adminTime";

const DEFAULT_CONTROLLER_STATUS_URL = "https://nutsnews-controller.nutsnews.workers.dev/status?mode=dashboard";
const STATUS_SIGNATURE_HEADER = "X-NutsNews-Failover-Signature";
const STATUS_TIMESTAMP_HEADER = "X-NutsNews-Failover-Timestamp";
const STATUS_SIGNATURE_VERSION = "v1";
const STATUS_FETCH_TIMEOUT_MS = 5_000;
const HISTORY_UNAVAILABLE_MESSAGE =
  "Historical health-check and DNS-change rows are not exposed by the current controller status API. Showing the latest public-safe status snapshot instead.";

export type FailoverDashboardTone = "ok" | "watch" | "danger" | "neutral";

export type FailoverTimelineRow = {
  id: string;
  timestamp: string | null;
  title: string;
  detail: string;
  value: string;
  tone: FailoverDashboardTone;
  source: "status_snapshot" | "metrics_unavailable";
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
  historyAvailable: boolean;
  historyMessage: string;
  links: FailoverLink[];
};

type FailoverStatusConfig = {
  statusUrl: string;
  hmacSecret: string;
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

function readConfig(): FailoverStatusConfig {
  const statusUrl = appendDashboardMode(
    publicHttpsUrl(
      process.env.NUTSNEWS_FAILOVER_CONTROLLER_STATUS_URL,
      DEFAULT_CONTROLLER_STATUS_URL,
      { allowLocalHttp: true },
    ),
  );

  return {
    statusUrl,
    hmacSecret: clean(process.env.NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function oneOf<const T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return allowed.includes(value as T[number]) ? value as T[number] : fallback;
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
  };
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

function buildDnsRows(status: FailoverStatus | null): FailoverTimelineRow[] {
  if (!status) {
    return [];
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
    historyAvailable: false,
    historyMessage: HISTORY_UNAVAILABLE_MESSAGE,
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
      historyAvailable: false,
      historyMessage: HISTORY_UNAVAILABLE_MESSAGE,
      links: buildLinks(config),
    };
  } catch (error) {
    return emptyData(config, safeErrorMessage(error), nowMs);
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
