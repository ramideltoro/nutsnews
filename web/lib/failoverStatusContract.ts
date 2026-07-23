export const FAILOVER_STATUS_SCHEMA_VERSION = "nutsnews.failover.status.v1" as const;
export const FAILOVER_CONTROLLER_VERSION_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,127}$" as const;

export const FAILOVER_DNS_TARGETS = ["vps", "vercel"] as const;
export const FAILOVER_DNS_TARGET_CLASSIFICATIONS = [
  "vps",
  "vercel",
  "unknown",
  "unmanaged",
] as const;
export const FAILOVER_OBSERVED_DEPLOYMENT_TARGETS = [
  "production-vps",
  "vercel-production",
  "unknown",
  "unexpected",
] as const;
export const FAILOVER_LIVE_ORIGIN_CLASSIFICATIONS = [
  "vps",
  "vercel",
  "unknown",
  "unreachable",
] as const;
export const FAILOVER_LIVE_ORIGIN_DNS_STATES = [
  "unknown",
  "in_sync",
  "propagating",
  "mismatch",
  "partial",
  "unreachable",
] as const;
export const FAILOVER_LIVE_ORIGIN_CACHE_STATES = [
  "unknown",
  "fresh",
  "stale",
] as const;
export const FAILOVER_LIVE_ORIGIN_ERROR_CODES = [
  "timeout",
  "network_error",
  "http_status_unreachable",
] as const;
export const FAILOVER_HEALTH_RESULTS = [
  "unknown",
  "reachable",
  "http_status_unreachable",
  "network_error",
  "timeout",
  "deployment_target_mismatch",
  "invalid_readiness_response",
] as const;
export const FAILOVER_VPS_STATUS_CODES = [
  "dns_error",
  "tls_error",
  "connection_refused",
  "connection_reset",
  "network_error",
  "timeout",
  "deployment_target_mismatch",
  "invalid_readiness_response",
] as const;
export const FAILOVER_DNS_ACTIONS = [
  "none",
  "dns_readback",
  "failover_to_vercel",
  "failback_to_vps",
  "manual_failover_to_vercel",
  "manual_failback_to_vps",
  "manual_lock_enabled",
  "manual_lock_disabled",
  "reconcile_dns_to_vps",
  "reconcile_dns_to_vercel",
] as const;
export const FAILOVER_DNS_HISTORY_ACTIONS = [
  "no_op",
  "dns_readback",
  "failover_to_vercel",
  "failback_to_vps",
  "manual_failover_to_vercel",
  "manual_failback_to_vps",
  "manual_lock_enabled",
  "manual_lock_disabled",
  "manual_lock_skip",
  "dns_api_error",
  "drift_detected",
  "reconcile_dns_to_vps",
  "reconcile_dns_to_vercel",
] as const;
export const FAILOVER_DNS_HISTORY_RESULTS = [
  "success",
  "failed",
  "skipped",
  "refused",
  "duplicate",
  "unknown",
] as const;
export const FAILOVER_CONTROLLER_STATES = [
  "vps_primary_healthy",
  "vps_health_degraded",
  "failed_over_vercel",
  "failback_pending",
  "manual_lock",
  "dns_drift",
  "stale",
] as const;
export const FAILOVER_STALE_REASONS = [
  "status_update_overdue",
  "next_check_due_missed",
  "clock_skew_detected",
] as const;
export const FAILOVER_MANUAL_ACTION_SCHEMA_VERSION = "nutsnews.failover.manual_action.v1" as const;
export const FAILOVER_MANUAL_ACTIONS = [
  "enable_manual_lock",
  "disable_manual_lock",
  "force_dns_to_vercel",
  "force_dns_to_vps",
] as const;
export const FAILOVER_MANUAL_ACTION_CONFIRMATIONS = {
  enable_manual_lock: "ENABLE MANUAL LOCK",
  disable_manual_lock: "DISABLE MANUAL LOCK",
  force_dns_to_vercel: "FAILOVER TO VERCEL",
  force_dns_to_vps: "FAILBACK TO VPS",
} as const satisfies Record<(typeof FAILOVER_MANUAL_ACTIONS)[number], string>;
export const FAILOVER_AUDIT_RESULTS = [
  "success",
  "failed",
  "refused",
  "duplicate",
] as const;

export const FAILOVER_CHECK_INTERVAL_SECONDS = 15 as const;
export const FAILOVER_FAILURE_THRESHOLD = 3 as const;
export const FAILOVER_CONTROLLER_STALE_AFTER_SECONDS = 60 as const;

export type FailoverDnsTarget = (typeof FAILOVER_DNS_TARGETS)[number];
export type FailoverDnsTargetClassification = (typeof FAILOVER_DNS_TARGET_CLASSIFICATIONS)[number];
export type FailoverObservedDeploymentTarget = (typeof FAILOVER_OBSERVED_DEPLOYMENT_TARGETS)[number];
export type FailoverLiveOriginClassification = (typeof FAILOVER_LIVE_ORIGIN_CLASSIFICATIONS)[number];
export type FailoverLiveOriginDnsState = (typeof FAILOVER_LIVE_ORIGIN_DNS_STATES)[number];
export type FailoverLiveOriginCacheState = (typeof FAILOVER_LIVE_ORIGIN_CACHE_STATES)[number];
export type FailoverLiveOriginErrorCode = (typeof FAILOVER_LIVE_ORIGIN_ERROR_CODES)[number];
export type FailoverHealthResult = (typeof FAILOVER_HEALTH_RESULTS)[number];
export type FailoverVpsStatusCode = (typeof FAILOVER_VPS_STATUS_CODES)[number];
export type FailoverDnsAction = (typeof FAILOVER_DNS_ACTIONS)[number];
export type FailoverDnsHistoryAction = (typeof FAILOVER_DNS_HISTORY_ACTIONS)[number];
export type FailoverDnsHistoryResult = (typeof FAILOVER_DNS_HISTORY_RESULTS)[number];
export type FailoverControllerState = (typeof FAILOVER_CONTROLLER_STATES)[number];
export type FailoverStaleReason = (typeof FAILOVER_STALE_REASONS)[number];
export type FailoverManualAction = (typeof FAILOVER_MANUAL_ACTIONS)[number];
export type FailoverAuditResult = (typeof FAILOVER_AUDIT_RESULTS)[number];
export type FailoverIsoDateTime = string;
export type FailoverVpsStatus = number | FailoverVpsStatusCode | null;
export type FailoverLiveOriginHostReadiness = {
  checkedAt: FailoverIsoDateTime;
  hostname: string;
  ok: boolean;
  origin: FailoverLiveOriginClassification;
  status: number | null;
  latencyMs: number | null;
  deploymentTarget: string;
  sourceCommit: string;
  buildId: string;
  readinessCode: string;
  runtimeEnv: string;
  sideEffectsMode: string;
  databaseProviderMode: string;
  productionWritesPaused: boolean | null;
  cacheState: FailoverLiveOriginCacheState;
  error: FailoverLiveOriginErrorCode | null;
};
export type FailoverLiveOriginReadiness = {
  checkedAt: FailoverIsoDateTime;
  dnsState: FailoverLiveOriginDnsState;
  apex: FailoverLiveOriginHostReadiness;
  www: FailoverLiveOriginHostReadiness;
};
export type FailoverHealthHistoryRow = {
  checkedAt: FailoverIsoDateTime;
  source: string;
  healthResult: FailoverHealthResult;
  vpsReachable: boolean;
  vpsStatus: FailoverVpsStatus;
  vpsLatencyMs: number | null;
  observedDeploymentTarget: FailoverObservedDeploymentTarget;
  consecutiveVpsFailures: number;
  activeDnsTarget: FailoverDnsTargetClassification;
  desiredDnsTarget: FailoverDnsTargetClassification;
  errorCode: string | null;
};
export type FailoverDnsHistoryRow = {
  changedAt: FailoverIsoDateTime;
  dnsAction: FailoverDnsHistoryAction;
  previousTarget: FailoverDnsTargetClassification;
  newTarget: FailoverDnsTargetClassification;
  activeDnsTarget: FailoverDnsTargetClassification;
  desiredDnsTarget: FailoverDnsTargetClassification;
  actualApexDnsTarget: FailoverDnsTargetClassification;
  actualWwwDnsTarget: FailoverDnsTargetClassification;
  result: FailoverDnsHistoryResult;
  skipReason: string | null;
  errorCode: string | null;
};

export type FailoverStatus = {
  schemaVersion: typeof FAILOVER_STATUS_SCHEMA_VERSION;
  generatedAt: FailoverIsoDateTime;
  controllerState: FailoverControllerState;
  activeDnsTarget: FailoverDnsTarget;
  desiredDnsTarget: FailoverDnsTarget;
  actualApexDnsTarget: FailoverDnsTargetClassification;
  actualWwwDnsTarget: FailoverDnsTargetClassification;
  observedDeploymentTarget: FailoverObservedDeploymentTarget;
  liveOriginReadiness: FailoverLiveOriginReadiness;
  lastHealthResult: FailoverHealthResult;
  lastVpsCheckAt: FailoverIsoDateTime | null;
  lastVpsReachable: boolean;
  lastVpsStatus: FailoverVpsStatus;
  lastVpsLatencyMs: number | null;
  consecutiveVpsFailures: number;
  failureThreshold: typeof FAILOVER_FAILURE_THRESHOLD;
  checkIntervalSeconds: typeof FAILOVER_CHECK_INTERVAL_SECONDS;
  lastDnsChangeAt: FailoverIsoDateTime | null;
  lastDnsChangeReason: FailoverDnsAction;
  manualLock: boolean;
  nextCheckDueAt: FailoverIsoDateTime | null;
  stale: boolean;
  staleReason: FailoverStaleReason | null;
  controllerVersion: string;
  healthHistory?: FailoverHealthHistoryRow[];
  dnsHistory?: FailoverDnsHistoryRow[];
};

export type FailoverManualAuditEvent = {
  id: string;
  createdAt: FailoverIsoDateTime;
  actor: string;
  action: FailoverManualAction;
  previousTarget: FailoverDnsTargetClassification;
  newTarget: FailoverDnsTargetClassification;
  reason: string;
  result: FailoverAuditResult;
  message: string;
  manualLock: boolean;
  idempotencyKey: string;
};

export const FAILOVER_STATUS_REQUIRED_FIELDS = [
  "schemaVersion",
  "generatedAt",
  "controllerState",
  "activeDnsTarget",
  "desiredDnsTarget",
  "actualApexDnsTarget",
  "actualWwwDnsTarget",
  "observedDeploymentTarget",
  "liveOriginReadiness",
  "lastHealthResult",
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
  "stale",
  "staleReason",
  "controllerVersion",
] as const satisfies readonly (keyof FailoverStatus)[];

export const FAILOVER_STATUS_OPTIONAL_FIELDS = [
  "healthHistory",
  "dnsHistory",
] as const satisfies readonly (keyof FailoverStatus)[];

const nullableDateTimeSchema = {
  oneOf: [{ type: "string", format: "date-time" }, { type: "null" }],
} as const;

const liveOriginHostReadinessSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "checkedAt",
    "hostname",
    "ok",
    "origin",
    "status",
    "latencyMs",
    "deploymentTarget",
    "sourceCommit",
    "buildId",
    "readinessCode",
    "runtimeEnv",
    "sideEffectsMode",
    "databaseProviderMode",
    "productionWritesPaused",
    "cacheState",
    "error",
  ],
  properties: {
    checkedAt: { type: "string", format: "date-time" },
    hostname: { type: "string" },
    ok: { type: "boolean" },
    origin: { enum: FAILOVER_LIVE_ORIGIN_CLASSIFICATIONS },
    status: {
      oneOf: [{ type: "integer", minimum: 100, maximum: 599 }, { type: "null" }],
    },
    latencyMs: {
      oneOf: [{ type: "integer", minimum: 0 }, { type: "null" }],
    },
    deploymentTarget: { type: "string" },
    sourceCommit: { type: "string" },
    buildId: { type: "string" },
    readinessCode: { type: "string" },
    runtimeEnv: { type: "string" },
    sideEffectsMode: { type: "string" },
    databaseProviderMode: { type: "string" },
    productionWritesPaused: {
      oneOf: [{ type: "boolean" }, { type: "null" }],
    },
    cacheState: { enum: FAILOVER_LIVE_ORIGIN_CACHE_STATES },
    error: {
      oneOf: [{ enum: FAILOVER_LIVE_ORIGIN_ERROR_CODES }, { type: "null" }],
    },
  },
} as const;

const healthHistoryRowSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "checkedAt",
    "source",
    "healthResult",
    "vpsReachable",
    "vpsStatus",
    "vpsLatencyMs",
    "observedDeploymentTarget",
    "consecutiveVpsFailures",
    "activeDnsTarget",
    "desiredDnsTarget",
    "errorCode",
  ],
  properties: {
    checkedAt: { type: "string", format: "date-time" },
    source: { type: "string" },
    healthResult: { enum: FAILOVER_HEALTH_RESULTS },
    vpsReachable: { type: "boolean" },
    vpsStatus: {
      oneOf: [
        { type: "integer", minimum: 100, maximum: 599 },
        { enum: FAILOVER_VPS_STATUS_CODES },
        { type: "null" },
      ],
    },
    vpsLatencyMs: {
      oneOf: [{ type: "integer", minimum: 0 }, { type: "null" }],
    },
    observedDeploymentTarget: { enum: FAILOVER_OBSERVED_DEPLOYMENT_TARGETS },
    consecutiveVpsFailures: { type: "integer", minimum: 0 },
    activeDnsTarget: { enum: FAILOVER_DNS_TARGET_CLASSIFICATIONS },
    desiredDnsTarget: { enum: FAILOVER_DNS_TARGET_CLASSIFICATIONS },
    errorCode: {
      oneOf: [{ type: "string" }, { type: "null" }],
    },
  },
} as const;

const dnsHistoryRowSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "changedAt",
    "dnsAction",
    "previousTarget",
    "newTarget",
    "activeDnsTarget",
    "desiredDnsTarget",
    "actualApexDnsTarget",
    "actualWwwDnsTarget",
    "result",
    "skipReason",
    "errorCode",
  ],
  properties: {
    changedAt: { type: "string", format: "date-time" },
    dnsAction: { enum: FAILOVER_DNS_HISTORY_ACTIONS },
    previousTarget: { enum: FAILOVER_DNS_TARGET_CLASSIFICATIONS },
    newTarget: { enum: FAILOVER_DNS_TARGET_CLASSIFICATIONS },
    activeDnsTarget: { enum: FAILOVER_DNS_TARGET_CLASSIFICATIONS },
    desiredDnsTarget: { enum: FAILOVER_DNS_TARGET_CLASSIFICATIONS },
    actualApexDnsTarget: { enum: FAILOVER_DNS_TARGET_CLASSIFICATIONS },
    actualWwwDnsTarget: { enum: FAILOVER_DNS_TARGET_CLASSIFICATIONS },
    result: { enum: FAILOVER_DNS_HISTORY_RESULTS },
    skipReason: {
      oneOf: [{ type: "string" }, { type: "null" }],
    },
    errorCode: {
      oneOf: [{ type: "string" }, { type: "null" }],
    },
  },
} as const;

export const failoverStatusJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://nutsnews.com/schemas/failover-status.v1.json",
  title: "NutsNews failover controller status contract v1",
  type: "object",
  additionalProperties: false,
  required: FAILOVER_STATUS_REQUIRED_FIELDS,
  properties: {
    schemaVersion: { const: FAILOVER_STATUS_SCHEMA_VERSION },
    generatedAt: { type: "string", format: "date-time" },
    controllerState: { enum: FAILOVER_CONTROLLER_STATES },
    activeDnsTarget: { enum: FAILOVER_DNS_TARGETS },
    desiredDnsTarget: { enum: FAILOVER_DNS_TARGETS },
    actualApexDnsTarget: { enum: FAILOVER_DNS_TARGET_CLASSIFICATIONS },
    actualWwwDnsTarget: { enum: FAILOVER_DNS_TARGET_CLASSIFICATIONS },
    observedDeploymentTarget: { enum: FAILOVER_OBSERVED_DEPLOYMENT_TARGETS },
    liveOriginReadiness: {
      type: "object",
      additionalProperties: false,
      required: ["checkedAt", "dnsState", "apex", "www"],
      properties: {
        checkedAt: { type: "string", format: "date-time" },
        dnsState: { enum: FAILOVER_LIVE_ORIGIN_DNS_STATES },
        apex: liveOriginHostReadinessSchema,
        www: liveOriginHostReadinessSchema,
      },
    },
    lastHealthResult: { enum: FAILOVER_HEALTH_RESULTS },
    lastVpsCheckAt: nullableDateTimeSchema,
    lastVpsReachable: { type: "boolean" },
    lastVpsStatus: {
      oneOf: [
        { type: "integer", minimum: 100, maximum: 599 },
        { enum: FAILOVER_VPS_STATUS_CODES },
        { type: "null" },
      ],
    },
    lastVpsLatencyMs: {
      oneOf: [{ type: "integer", minimum: 0 }, { type: "null" }],
    },
    consecutiveVpsFailures: { type: "integer", minimum: 0 },
    failureThreshold: { const: FAILOVER_FAILURE_THRESHOLD },
    checkIntervalSeconds: { const: FAILOVER_CHECK_INTERVAL_SECONDS },
    lastDnsChangeAt: nullableDateTimeSchema,
    lastDnsChangeReason: { enum: FAILOVER_DNS_ACTIONS },
    manualLock: { type: "boolean" },
    nextCheckDueAt: nullableDateTimeSchema,
    stale: { type: "boolean" },
    staleReason: {
      oneOf: [{ enum: FAILOVER_STALE_REASONS }, { type: "null" }],
    },
    controllerVersion: {
      type: "string",
      pattern: FAILOVER_CONTROLLER_VERSION_PATTERN,
    },
    healthHistory: {
      type: "array",
      maxItems: 20,
      items: healthHistoryRowSchema,
    },
    dnsHistory: {
      type: "array",
      maxItems: 20,
      items: dnsHistoryRowSchema,
    },
  },
} as const;

export const failoverVpsHealthContract = {
  readinessPath: "/readyz",
  reachableHttpStatusRange: "200-299",
  expectedDeploymentTarget: "production-vps",
  unreachableConditions: [
    "readiness fetch returns a network, DNS, TLS, connection, or timeout error",
    "readiness fetch returns an HTTP status outside 200-299",
    "readiness response cannot be parsed as the expected readiness payload",
    "readiness response reports a deployment target other than production-vps",
  ],
  failureAccounting: {
    checkIntervalSeconds: FAILOVER_CHECK_INTERVAL_SECONDS,
    consecutiveFailuresBeforeFailover: FAILOVER_FAILURE_THRESHOLD,
  },
} as const;

export const failoverStaleControllerContract = {
  staleAfterSeconds: FAILOVER_CONTROLLER_STALE_AFTER_SECONDS,
  conditions: [
    "generatedAt is more than 60 seconds behind the observer clock",
    "nextCheckDueAt is more than 60 seconds behind the observer clock",
    "the controller cannot write a fresh status update",
  ],
} as const;

export const FAILOVER_PUBLIC_SAFE_STATUS_FIELDS = [
  ...FAILOVER_STATUS_REQUIRED_FIELDS,
  ...FAILOVER_STATUS_OPTIONAL_FIELDS,
] as const;
export const FAILOVER_INTERNAL_ONLY_FIELD_NAMES = [
  "cloudflareApiToken",
  "cloudflareZoneId",
  "cloudflareRecordId",
  "cloudflareRecordIds",
  "originIp",
  "vpsOriginIp",
  "dnsProviderToken",
  "readinessRequestHeaders",
  "manualActor",
  "manualAuditNote",
] as const;

export const failoverStatusFieldVisibility = {
  schemaVersion: "public",
  generatedAt: "public",
  controllerState: "public",
  activeDnsTarget: "public",
  desiredDnsTarget: "public",
  actualApexDnsTarget: "public",
  actualWwwDnsTarget: "public",
  observedDeploymentTarget: "public",
  liveOriginReadiness: "public",
  lastHealthResult: "public",
  lastVpsCheckAt: "public",
  lastVpsReachable: "public",
  lastVpsStatus: "public",
  lastVpsLatencyMs: "public",
  consecutiveVpsFailures: "public",
  failureThreshold: "public",
  checkIntervalSeconds: "public",
  lastDnsChangeAt: "public",
  lastDnsChangeReason: "public",
  manualLock: "public",
  nextCheckDueAt: "public",
  stale: "public",
  staleReason: "public",
  controllerVersion: "public",
  healthHistory: "public",
  dnsHistory: "public",
} as const satisfies Record<keyof FailoverStatus, "public">;

export function isPublicSafeFailoverStatusField(
  field: string,
): field is (typeof FAILOVER_PUBLIC_SAFE_STATUS_FIELDS)[number] {
  return (FAILOVER_PUBLIC_SAFE_STATUS_FIELDS as readonly string[]).includes(field);
}

const baseExample = {
  schemaVersion: FAILOVER_STATUS_SCHEMA_VERSION,
  generatedAt: "2026-07-22T03:30:00.000Z",
  lastVpsCheckAt: "2026-07-22T03:29:55.000Z",
  lastVpsLatencyMs: 84,
  consecutiveVpsFailures: 0,
  failureThreshold: FAILOVER_FAILURE_THRESHOLD,
  checkIntervalSeconds: FAILOVER_CHECK_INTERVAL_SECONDS,
  lastDnsChangeAt: null,
  lastDnsChangeReason: "none",
  manualLock: false,
  nextCheckDueAt: "2026-07-22T03:30:10.000Z",
  stale: false,
  staleReason: null,
  controllerVersion: "contract-v1",
  liveOriginReadiness: {
    checkedAt: "2026-07-22T03:30:00.000Z",
    dnsState: "in_sync",
    apex: {
      checkedAt: "2026-07-22T03:30:00.000Z",
      hostname: "nutsnews.com",
      ok: true,
      origin: "vps",
      status: 200,
      latencyMs: 86,
      deploymentTarget: "production-vps",
      sourceCommit: "contract-v1",
      buildId: "contract-v1",
      readinessCode: "ok",
      runtimeEnv: "production",
      sideEffectsMode: "enabled",
      databaseProviderMode: "supabase_primary",
      productionWritesPaused: false,
      cacheState: "fresh",
      error: null,
    },
    www: {
      checkedAt: "2026-07-22T03:30:00.000Z",
      hostname: "www.nutsnews.com",
      ok: true,
      origin: "vps",
      status: 200,
      latencyMs: 91,
      deploymentTarget: "production-vps",
      sourceCommit: "contract-v1",
      buildId: "contract-v1",
      readinessCode: "ok",
      runtimeEnv: "production",
      sideEffectsMode: "enabled",
      databaseProviderMode: "supabase_primary",
      productionWritesPaused: false,
      cacheState: "fresh",
      error: null,
    },
  },
} as const;

export const failoverStatusExamples = {
  healthyVpsPrimary: {
    ...baseExample,
    controllerState: "vps_primary_healthy",
    activeDnsTarget: "vps",
    desiredDnsTarget: "vps",
    actualApexDnsTarget: "vps",
    actualWwwDnsTarget: "vps",
    observedDeploymentTarget: "production-vps",
    lastHealthResult: "reachable",
    lastVpsReachable: true,
    lastVpsStatus: 200,
  },
  failedOverVercel: {
    ...baseExample,
    generatedAt: "2026-07-22T03:31:00.000Z",
    controllerState: "failed_over_vercel",
    activeDnsTarget: "vercel",
    desiredDnsTarget: "vercel",
    actualApexDnsTarget: "vercel",
    actualWwwDnsTarget: "vercel",
    observedDeploymentTarget: "vercel-production",
    lastHealthResult: "timeout",
    lastVpsCheckAt: "2026-07-22T03:30:55.000Z",
    lastVpsReachable: false,
    lastVpsStatus: "timeout",
    lastVpsLatencyMs: null,
    consecutiveVpsFailures: FAILOVER_FAILURE_THRESHOLD,
    lastDnsChangeAt: "2026-07-22T03:30:58.000Z",
    lastDnsChangeReason: "failover_to_vercel",
    nextCheckDueAt: "2026-07-22T03:31:10.000Z",
  },
  failbackPending: {
    ...baseExample,
    generatedAt: "2026-07-22T03:32:00.000Z",
    controllerState: "failback_pending",
    activeDnsTarget: "vercel",
    desiredDnsTarget: "vps",
    actualApexDnsTarget: "vercel",
    actualWwwDnsTarget: "vercel",
    observedDeploymentTarget: "vercel-production",
    lastHealthResult: "reachable",
    lastVpsReachable: true,
    lastVpsStatus: 200,
    lastDnsChangeAt: "2026-07-22T03:30:58.000Z",
    lastDnsChangeReason: "failover_to_vercel",
    nextCheckDueAt: "2026-07-22T03:32:10.000Z",
  },
  manualLock: {
    ...baseExample,
    generatedAt: "2026-07-22T03:33:00.000Z",
    controllerState: "manual_lock",
    activeDnsTarget: "vercel",
    desiredDnsTarget: "vps",
    actualApexDnsTarget: "vercel",
    actualWwwDnsTarget: "vercel",
    observedDeploymentTarget: "vercel-production",
    lastHealthResult: "reachable",
    lastVpsReachable: true,
    lastVpsStatus: 200,
    manualLock: true,
    nextCheckDueAt: "2026-07-22T03:33:10.000Z",
  },
  staleController: {
    ...baseExample,
    generatedAt: "2026-07-22T03:28:00.000Z",
    controllerState: "stale",
    activeDnsTarget: "vps",
    desiredDnsTarget: "vps",
    actualApexDnsTarget: "unknown",
    actualWwwDnsTarget: "unknown",
    observedDeploymentTarget: "unknown",
    lastHealthResult: "unknown",
    lastVpsCheckAt: "2026-07-22T03:27:55.000Z",
    lastVpsReachable: false,
    lastVpsStatus: null,
    lastVpsLatencyMs: null,
    nextCheckDueAt: "2026-07-22T03:28:10.000Z",
    stale: true,
    staleReason: "status_update_overdue",
  },
} as const satisfies Record<string, FailoverStatus>;
