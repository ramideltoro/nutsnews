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

export const FAILOVER_CHECK_INTERVAL_SECONDS = 15 as const;
export const FAILOVER_FAILURE_THRESHOLD = 3 as const;
export const FAILOVER_CONTROLLER_STALE_AFTER_SECONDS = 60 as const;

export type FailoverDnsTarget = (typeof FAILOVER_DNS_TARGETS)[number];
export type FailoverDnsTargetClassification = (typeof FAILOVER_DNS_TARGET_CLASSIFICATIONS)[number];
export type FailoverObservedDeploymentTarget = (typeof FAILOVER_OBSERVED_DEPLOYMENT_TARGETS)[number];
export type FailoverHealthResult = (typeof FAILOVER_HEALTH_RESULTS)[number];
export type FailoverVpsStatusCode = (typeof FAILOVER_VPS_STATUS_CODES)[number];
export type FailoverDnsAction = (typeof FAILOVER_DNS_ACTIONS)[number];
export type FailoverControllerState = (typeof FAILOVER_CONTROLLER_STATES)[number];
export type FailoverStaleReason = (typeof FAILOVER_STALE_REASONS)[number];
export type FailoverIsoDateTime = string;
export type FailoverVpsStatus = number | FailoverVpsStatusCode | null;

export type FailoverStatus = {
  schemaVersion: typeof FAILOVER_STATUS_SCHEMA_VERSION;
  generatedAt: FailoverIsoDateTime;
  controllerState: FailoverControllerState;
  activeDnsTarget: FailoverDnsTarget;
  desiredDnsTarget: FailoverDnsTarget;
  actualApexDnsTarget: FailoverDnsTargetClassification;
  actualWwwDnsTarget: FailoverDnsTargetClassification;
  observedDeploymentTarget: FailoverObservedDeploymentTarget;
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

const nullableDateTimeSchema = {
  oneOf: [{ type: "string", format: "date-time" }, { type: "null" }],
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

export const FAILOVER_PUBLIC_SAFE_STATUS_FIELDS = FAILOVER_STATUS_REQUIRED_FIELDS;
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
