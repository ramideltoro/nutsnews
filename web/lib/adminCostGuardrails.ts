import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { formatAdminDateTime } from "@/lib/adminTime";

type RiskLevel = "ok" | "watch" | "danger" | "unknown";
type ForecastStatus = "safe" | "approaching_limit" | "projected_to_breach" | "insufficient_trend_data";

type AiUsageRunRow = {
  run_started_at: string;
  openai_call_count: number | null;
  openai_prompt_tokens: number | null;
  openai_completion_tokens: number | null;
  openai_total_tokens: number | null;
  estimated_openai_cost_usd: number | string | null;
  cost_protection_limit_reached: boolean | null;
  spike_warning_triggered: boolean | null;
  local_ai_call_count?: number | null;
  local_ai_total_tokens?: number | null;
};

type WorkerRunRow = {
  run_started_at: string;
  success: boolean | null;
  shard_index: number | null;
  fetched_count: number | null;
  ai_reviewed_count: number | null;
  accepted_count: number | null;
  rejected_count: number | null;
  duration_ms: number | null;
  cost_protection_limit_reached: boolean | null;
  spike_warning_triggered: boolean | null;
};

type QuotaUsageEventRow = {
  event_type: string;
  quantity: number | null;
  created_at: string;
};

export type GuardrailMetric = {
  id: string;
  label: string;
  group:
    | "Database"
    | "AI"
    | "Workers"
    | "Redis/KV"
    | "Email"
    | "PageSpeed/API"
    | "Egress"
    | "Vercel"
    | "Cloudflare";
  value: number | null;
  limit: number | null;
  unit: string;
  riskLevel: RiskLevel;
  usagePercent: number | null;
  forecast30DayValue: number | null;
  forecastDailyUsage: number | null;
  forecastUsagePercent: number | null;
  forecastStatus: ForecastStatus;
  forecastReason: string;
  warningThresholdPercent: number;
  dangerThresholdPercent: number;
  description: string;
  mitigation: string;
  dataSource: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
  inputNames: string[];
};

export type GuardrailsDashboardData = {
  isConfigured: boolean;
  errorMessage: string | null;
  generatedAt: string;
  latestRunLabel: string;
  overallRiskLevel: RiskLevel;
  metrics: GuardrailMetric[];
  warnings: GuardrailMetric[];
  last24Hours: {
    workerRuns: number;
    failedWorkerRuns: number;
    openAiCalls: number;
    openAiTokens: number;
    openAiCostUsd: number;
    localAiCalls: number;
    emailSends: number;
  };
  last7Days: {
    workerRuns: number;
    failedWorkerRuns: number;
    openAiCalls: number;
    openAiTokens: number;
    openAiCostUsd: number;
    localAiCalls: number;
    emailSends: number;
  };
  last30Days: {
    workerRuns: number;
    failedWorkerRuns: number;
    openAiCalls: number;
    openAiTokens: number;
    openAiCostUsd: number;
    localAiCalls: number;
    emailSends: number;
  };
};

const MAX_ROWS_TO_LOAD = 10000;
const CLOUDFLARE_API_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function readNumberEnv(name: string, fallback: number | null) {
  const value = process.env[name]?.trim();

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readStringEnv(name: string, fallback: string | null) {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

function readBooleanEnv(name: string, fallback = false) {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value);
}

function readStringListEnv(name: string) {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function filterSince<T extends { run_started_at?: string; created_at?: string }>(
  rows: T[],
  since: Date,
) {
  const sinceTime = since.getTime();

  return rows.filter((row) => {
    const value = row.run_started_at ?? row.created_at;
    const time = value ? new Date(value).getTime() : Number.NaN;
    return Number.isFinite(time) && time >= sinceTime;
  });
}

function sum<T>(rows: T[], mapper: (row: T) => number) {
  return rows.reduce((total, row) => total + mapper(row), 0);
}

function sumQuotaEventTypes(rows: QuotaUsageEventRow[], eventTypes: string[]) {
  const eventTypeSet = new Set(eventTypes);
  return sum(
    rows.filter((row) => eventTypeSet.has(row.event_type)),
    (row) => toNumber(row.quantity),
  );
}

function usagePercent(value: number | null, limit: number | null) {
  if (value === null || limit === null || limit <= 0) {
    return null;
  }

  return Math.round((value / limit) * 1000) / 10;
}

function riskLevel(
  value: number | null,
  limit: number | null,
  warningThresholdPercent: number,
  dangerThresholdPercent: number,
): RiskLevel {
  const percent = usagePercent(value, limit);

  if (percent === null) {
    return "unknown";
  }

  if (percent >= dangerThresholdPercent) {
    return "danger";
  }

  if (percent >= warningThresholdPercent) {
    return "watch";
  }

  return "ok";
}

function roundMetricValue(value: number, unit: string) {
  if (unit === "USD") {
    return Math.round(value * 1_000_000) / 1_000_000;
  }

  if (unit === "GB" || unit === "GB-Hrs" || unit === "hours" || unit === "ms") {
    return Math.round(value * 100) / 100;
  }

  return Math.round(value);
}

function forecastWindowLabel(days: number) {
  return days === 1 ? "last 24 hours" : `last ${days} days`;
}

function forecastStatus(
  forecastValue: number | null,
  limit: number | null,
  warningThresholdPercent: number,
): ForecastStatus {
  if (forecastValue === null || limit === null || limit <= 0) {
    return "insufficient_trend_data";
  }

  const percent = usagePercent(forecastValue, limit);

  if (percent === null) {
    return "insufficient_trend_data";
  }

  if (percent >= 100) {
    return "projected_to_breach";
  }

  if (percent >= warningThresholdPercent) {
    return "approaching_limit";
  }

  return "safe";
}

function riskLevelFromForecastStatus(status: ForecastStatus): RiskLevel {
  switch (status) {
    case "projected_to_breach":
      return "danger";
    case "approaching_limit":
      return "watch";
    case "safe":
      return "ok";
    case "insufficient_trend_data":
      return "unknown";
  }
}

function highestRiskLevel(currentRiskLevel: RiskLevel, forecastRiskLevel: RiskLevel): RiskLevel {
  if (currentRiskLevel === "danger" || forecastRiskLevel === "danger") {
    return "danger";
  }

  if (currentRiskLevel === "watch" || forecastRiskLevel === "watch") {
    return "watch";
  }

  if (currentRiskLevel === "ok" || forecastRiskLevel === "ok") {
    return "ok";
  }

  return "unknown";
}

function mitigationForForecast(label: string, mitigation: string, status: ForecastStatus) {
  switch (status) {
    case "projected_to_breach":
      return `${label} is projected to breach its configured limit within 30 days. Prioritize this mitigation now: ${mitigation}`;
    case "approaching_limit":
      return `${label} is approaching its configured limit on the current trend. Review this mitigation before the next deployment: ${mitigation}`;
    case "safe":
      return `${label} is safe on the current 30-day projection. Keep this mitigation ready if the trend changes: ${mitigation}`;
    case "insufficient_trend_data":
      return `Trend data is insufficient for ${label}. First configure live usage or quota events, then use this mitigation if usage rises: ${mitigation}`;
  }
}

function buildForecast({
  forecastSourceValue,
  forecastSourceDays,
  limit,
  unit,
  warningThresholdPercent,
  insufficientReason,
}: {
  forecastSourceValue: number | null | undefined;
  forecastSourceDays: number | null | undefined;
  limit: number | null;
  unit: string;
  warningThresholdPercent: number;
  insufficientReason?: string;
}) {
  if (
    typeof forecastSourceValue !== "number" ||
    !Number.isFinite(forecastSourceValue) ||
    forecastSourceValue < 0 ||
    typeof forecastSourceDays !== "number" ||
    !Number.isFinite(forecastSourceDays) ||
    forecastSourceDays <= 0
  ) {
    return {
      forecast30DayValue: null,
      forecastDailyUsage: null,
      forecastUsagePercent: null,
      forecastStatus: "insufficient_trend_data" as const,
      forecastReason:
        insufficientReason ??
        "Insufficient trend data: no recent usage values were available from Cloudflare, quota events, or manual inputs.",
    };
  }

  const dailyUsage = forecastSourceValue / forecastSourceDays;
  const forecastValue = roundMetricValue(dailyUsage * 30, unit);
  const forecastPercent = usagePercent(forecastValue, limit);
  const status = forecastStatus(forecastValue, limit, warningThresholdPercent);
  const sourceWindow = forecastWindowLabel(forecastSourceDays);
  const reason =
    limit === null || limit <= 0
      ? `Projected from ${roundMetricValue(dailyUsage, unit).toLocaleString("en-US")} ${unit}/day over the ${sourceWindow}; no configured limit is available to compare against.`
      : `Projected from ${roundMetricValue(dailyUsage, unit).toLocaleString("en-US")} ${unit}/day over the ${sourceWindow}; forecast is ${forecastPercent ?? "unknown"}% of the configured limit.`;

  return {
    forecast30DayValue: forecastValue,
    forecastDailyUsage: roundMetricValue(dailyUsage, unit),
    forecastUsagePercent: forecastPercent,
    forecastStatus: status,
    forecastReason: reason,
  };
}

function buildMetric({
  id,
  label,
  group,
  value,
  limit,
  unit,
  warningThresholdPercent = 70,
  dangerThresholdPercent = 90,
  forecastSourceLast7Days,
  forecastSourceValue,
  forecastSourceDays,
  forecastInsufficientReason,
  description,
  mitigation,
  dataSource,
  sourceUrl = null,
  sourceLabel = null,
  inputNames = [],
}: {
  id: string;
  label: string;
  group: GuardrailMetric["group"];
  value: number | null;
  limit: number | null;
  unit: string;
  warningThresholdPercent?: number;
  dangerThresholdPercent?: number;
  forecastSourceLast7Days?: number;
  forecastSourceValue?: number | null;
  forecastSourceDays?: number | null;
  forecastInsufficientReason?: string;
  description: string;
  mitigation: string;
  dataSource: string;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  inputNames?: string[];
}): GuardrailMetric {
  const forecast = buildForecast({
    forecastSourceValue:
      typeof forecastSourceValue === "number" || forecastSourceValue === null
        ? forecastSourceValue
        : forecastSourceLast7Days,
    forecastSourceDays:
      typeof forecastSourceDays === "number" || forecastSourceValue !== undefined
        ? forecastSourceDays
        : typeof forecastSourceLast7Days === "number"
          ? 7
          : null,
    limit,
    unit,
    warningThresholdPercent,
    insufficientReason: forecastInsufficientReason,
  });
  const currentRiskLevel = riskLevel(value, limit, warningThresholdPercent, dangerThresholdPercent);
  const forecastRiskLevel = riskLevelFromForecastStatus(forecast.forecastStatus);

  return {
    id,
    label,
    group,
    value,
    limit,
    unit,
    warningThresholdPercent,
    dangerThresholdPercent,
    riskLevel: highestRiskLevel(currentRiskLevel, forecastRiskLevel),
    usagePercent: usagePercent(value, limit),
    ...forecast,
    description,
    mitigation: mitigationForForecast(label, mitigation, forecast.forecastStatus),
    dataSource,
    sourceUrl,
    sourceLabel,
    inputNames,
  };
}

type VercelUsageMetricConfig = {
  id: string;
  label: string;
  envName: string;
  unit: string;
  currentValue: number;
  includedLimit: number;
  upperLimit?: number;
  usageMetric: string;
  description: string;
  mitigation: string;
};

const VERCEL_USAGE_METRICS: VercelUsageMetricConfig[] = [
  {
    id: "vercel-fluid-active-cpu",
    label: "Fluid Active CPU",
    envName: "NUTSNEWS_VERCEL_FLUID_ACTIVE_CPU_HOURS",
    unit: "hours",
    currentValue: 3.2,
    includedLimit: 4,
    upperLimit: 16,
    usageMetric: "fluid-active-cpu",
    description: "Vercel Fluid Compute active CPU time for the current billing period.",
    mitigation:
      "Keep public pages cached, avoid telemetry tunnels through middleware, and move uptime monitors to /healthz.",
  },
  {
    id: "vercel-isr-writes",
    label: "ISR Writes",
    envName: "NUTSNEWS_VERCEL_ISR_WRITES",
    unit: "writes",
    currentValue: 61000,
    includedLimit: 200000,
    upperLimit: 2000000,
    usageMetric: "isr-writes",
    description: "Incremental Static Regeneration writes reported by Vercel.",
    mitigation:
      "Keep revalidation intervals coarse for public pages and avoid unnecessary path/tag revalidation loops.",
  },
  {
    id: "vercel-image-transformations",
    label: "Image Optimization Transformations",
    envName: "NUTSNEWS_VERCEL_IMAGE_TRANSFORMATIONS",
    unit: "transformations",
    currentValue: 1200,
    includedLimit: 5000,
    upperLimit: 10000,
    usageMetric: "image-optimization-transformations",
    description: "Vercel Image Optimization transformation count.",
    mitigation:
      "Prefer stable image sizes, keep image cache TTLs long, and avoid transforming unsupported publisher image formats repeatedly.",
  },
  {
    id: "vercel-fast-origin-transfer",
    label: "Fast Origin Transfer",
    envName: "NUTSNEWS_VERCEL_FAST_ORIGIN_TRANSFER_GB",
    unit: "GB",
    currentValue: 1.31,
    includedLimit: 10,
    upperLimit: 100,
    usageMetric: "fast-origin-transfer",
    description: "Vercel Fast Origin Transfer usage for uncached or origin-bound traffic.",
    mitigation:
      "Protect public API/page cache headers, keep Cloudflare cache hit rate high, and move monitors to /healthz.",
  },
  {
    id: "vercel-image-cache-writes",
    label: "Image Optimization Cache Writes",
    envName: "NUTSNEWS_VERCEL_IMAGE_CACHE_WRITES",
    unit: "writes",
    currentValue: 11000,
    includedLimit: 100000,
    upperLimit: 200000,
    usageMetric: "image-optimization-cache-writes",
    description: "Vercel Image Optimization cache writes.",
    mitigation:
      "Constrain image variants, reuse consistent sizes, and keep publisher image URLs stable where possible.",
  },
  {
    id: "vercel-edge-requests",
    label: "Edge Requests",
    envName: "NUTSNEWS_VERCEL_EDGE_REQUESTS",
    unit: "requests",
    currentValue: 105000,
    includedLimit: 1000000,
    upperLimit: 10000000,
    usageMetric: "edge-requests",
    description: "Vercel Edge Network request volume.",
    mitigation:
      "Keep bots on /healthz, preserve CDN caching for public pages/APIs, and reduce noisy telemetry routes.",
  },
  {
    id: "vercel-function-invocations",
    label: "Function Invocations",
    envName: "NUTSNEWS_VERCEL_FUNCTION_INVOCATIONS",
    unit: "invocations",
    currentValue: 72000,
    includedLimit: 1000000,
    usageMetric: "function-invocations",
    description: "Vercel serverless/function invocation count.",
    mitigation:
      "Keep public routes static/ISR where possible, cache API responses, and avoid middleware on public/API paths.",
  },
  {
    id: "vercel-isr-reads",
    label: "ISR Reads",
    envName: "NUTSNEWS_VERCEL_ISR_READS",
    unit: "reads",
    currentValue: 60000,
    includedLimit: 1000000,
    upperLimit: 10000000,
    usageMetric: "isr-reads",
    description: "Vercel ISR cache read volume.",
    mitigation:
      "Keep ISR useful for public pages, but avoid high-cardinality route generation for low-value bot traffic.",
  },
  {
    id: "vercel-fluid-provisioned-memory",
    label: "Fluid Provisioned Memory",
    envName: "NUTSNEWS_VERCEL_FLUID_PROVISIONED_MEMORY_GB_HOURS",
    unit: "GB-Hrs",
    currentValue: 14.4,
    includedLimit: 360,
    upperLimit: 1440,
    usageMetric: "fluid-provisioned-memory",
    description: "Vercel Fluid Compute provisioned memory usage.",
    mitigation:
      "Avoid long-running public functions, reduce repeated bot/API work, and keep expensive admin pages authenticated.",
  },
  {
    id: "vercel-fast-data-transfer",
    label: "Fast Data Transfer",
    envName: "NUTSNEWS_VERCEL_FAST_DATA_TRANSFER_GB",
    unit: "GB",
    currentValue: 1.93,
    includedLimit: 100,
    usageMetric: "fast-data-transfer",
    description: "Vercel Fast Data Transfer usage for delivered traffic.",
    mitigation:
      "Keep payloads small, preserve CDN caching, and avoid unbounded public API polling.",
  },
];

function getVercelUsageBaseUrl() {
  return readStringEnv(
    "NUTSNEWS_VERCEL_USAGE_URL",
    "https://vercel.com/nutsnews/nutsnews/usage",
  );
}

function buildUsageUrl(baseUrl: string | null, metric: string) {
  if (!baseUrl) {
    return null;
  }

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("metric", metric);
    return url.toString();
  } catch {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}metric=${encodeURIComponent(metric)}`;
  }
}

function getCloudflareDashboardBaseUrl() {
  return readStringEnv("CLOUDFLARE_DASHBOARD_URL", "https://dash.cloudflare.com/");
}

function getCloudflareDashboardUrl(pathname: string) {
  const baseUrl = getCloudflareDashboardBaseUrl();

  if (!baseUrl) {
    return null;
  }

  try {
    return new URL(pathname.replace(/^\/+/, ""), baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
  } catch {
    return `${baseUrl.replace(/\/+$/, "")}/${pathname.replace(/^\/+/, "")}`;
  }
}

function formatCompactValue(value: number, unit: string) {
  if (unit === "hours") {
    const wholeHours = Math.floor(value);
    const minutes = Math.round((value - wholeHours) * 60);
    return minutes > 0 ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
  }

  if (unit === "GB" || unit === "GB-Hrs") {
    return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unit}`;
  }

  return `${value.toLocaleString("en-US")} ${unit}`;
}

function buildVercelUsageMetrics() {
  const vercelUsageBaseUrl = getVercelUsageBaseUrl();

  return VERCEL_USAGE_METRICS.map((metric) => {
    const value = readNumberEnv(metric.envName, metric.currentValue);
    const limit = metric.upperLimit ?? metric.includedLimit;
    const warningThresholdPercent = metric.upperLimit
      ? Math.round((metric.includedLimit / metric.upperLimit) * 1000) / 10
      : 70;

    return buildMetric({
      id: metric.id,
      label: metric.label,
      group: "Vercel",
      value,
      limit,
      unit: metric.unit,
      warningThresholdPercent,
      dangerThresholdPercent: metric.upperLimit ? 90 : 100,
      description:
        `${metric.description} Included/free threshold: ${formatCompactValue(metric.includedLimit, metric.unit)}${
          metric.upperLimit ? `; upper threshold: ${formatCompactValue(metric.upperLimit, metric.unit)}` : ""
        }.`,
      mitigation: metric.mitigation,
      dataSource: `Vercel usage manual input (${metric.envName})`,
      sourceUrl: buildUsageUrl(vercelUsageBaseUrl, metric.usageMetric),
      sourceLabel: "Vercel usage",
      inputNames: [metric.envName, "NUTSNEWS_VERCEL_USAGE_URL"],
    });
  });
}

type CloudflareGraphQlUsage = {
  workersRequests24h: number | null;
  workersRequests30d: number | null;
  workersCpuP99Ms: number | null;
  workersSubrequests30d: number | null;
  cdnRequests30d: number | null;
  cdnBandwidthGb30d: number | null;
  cdnCachedBandwidthGb30d: number | null;
  errorMessage: string | null;
};

type CloudflareUsageMetricConfig = {
  id: string;
  label: string;
  envName: string;
  limitEnvName: string;
  unit: string;
  defaultLimit: number | null;
  windowDays?: number;
  usageMetric: string;
  description: string;
  mitigation: string;
  warningThresholdPercent?: number;
  dangerThresholdPercent?: number;
  apiValue: (usage: CloudflareGraphQlUsage) => number | null;
  persistedEventTypes?: string[];
  enabled?: () => boolean;
};

const CLOUDFLARE_USAGE_METRICS: CloudflareUsageMetricConfig[] = [
  {
    id: "cloudflare-workers-requests-24h",
    label: "Workers requests, last 24h",
    envName: "CLOUDFLARE_WORKERS_REQUESTS_24H",
    limitEnvName: "CLOUDFLARE_WORKERS_REQUESTS_DAILY_LIMIT",
    unit: "requests",
    defaultLimit: 100000,
    windowDays: 1,
    usageMetric: "workers-and-pages",
    description:
      "Cloudflare Workers account request pressure for the last 24 hours. The Workers Free plan has a 100,000 requests/day account limit.",
    mitigation:
      "Reduce shard schedule frequency, pause low-quality feeds, and confirm uptime monitors are not calling Worker endpoints.",
    apiValue: (usage) => usage.workersRequests24h,
    persistedEventTypes: ["cloudflare_worker_request", "cloudflare_workers_request"],
  },
  {
    id: "cloudflare-workers-requests-30d",
    label: "Workers requests, last 30d",
    envName: "CLOUDFLARE_WORKERS_REQUESTS_30D",
    limitEnvName: "CLOUDFLARE_WORKERS_REQUESTS_30D_LIMIT",
    unit: "requests",
    defaultLimit: 3000000,
    usageMetric: "workers-and-pages",
    description:
      "30-day Workers request volume. This is a trend guardrail derived from the 100,000 requests/day free-tier limit.",
    mitigation:
      "Keep Worker runs bounded, reduce shard count during spikes, and use KV snapshots to avoid repeated expensive refreshes.",
    apiValue: (usage) => usage.workersRequests30d,
    persistedEventTypes: ["cloudflare_worker_request", "cloudflare_workers_request"],
  },
  {
    id: "cloudflare-workers-cpu-p99",
    label: "Workers CPU p99",
    envName: "CLOUDFLARE_WORKERS_CPU_P99_MS",
    limitEnvName: "CLOUDFLARE_WORKERS_CPU_P99_MS_LIMIT",
    unit: "ms",
    defaultLimit: 10,
    usageMetric: "workers-and-pages",
    description:
      "Cloudflare Workers p99 CPU time. Waiting on network calls does not count as CPU, but CPU overages can trigger Worker 1102 errors.",
    mitigation:
      "Move CPU-heavy parsing to smaller batches, lower per-run review limits, and profile worker code before raising paid-plan limits.",
    warningThresholdPercent: 70,
    dangerThresholdPercent: 100,
    apiValue: (usage) => usage.workersCpuP99Ms,
  },
  {
    id: "cloudflare-workers-subrequests-30d",
    label: "Workers subrequests, last 30d",
    envName: "CLOUDFLARE_WORKERS_SUBREQUESTS_30D",
    limitEnvName: "CLOUDFLARE_WORKERS_SUBREQUESTS_30D_LIMIT",
    unit: "subrequests",
    defaultLimit: null,
    usageMetric: "workers-and-pages",
    description:
      "Cloudflare Workers subrequests over 30 days. This has no single monthly account quota, but high volume predicts pressure on per-invocation subrequest limits.",
    mitigation:
      "Keep feed fetches and article-page image hydration bounded; raise limits only in the Worker repo after owner approval.",
    apiValue: (usage) => usage.workersSubrequests30d,
  },
  {
    id: "cloudflare-kv-reads-24h",
    label: "Workers KV reads, last 24h",
    envName: "CLOUDFLARE_KV_READS_24H",
    limitEnvName: "CLOUDFLARE_KV_READS_DAILY_LIMIT",
    unit: "reads",
    defaultLimit: 100000,
    windowDays: 1,
    usageMetric: "workers-kv",
    description:
      "Cloudflare Workers KV reads for Worker state and public feed edge snapshots. Free KV includes 100,000 reads/day.",
    mitigation:
      "Cache Worker state reads, keep public feed snapshot TTLs useful, and avoid polling edge-snapshot status too frequently.",
    apiValue: () => null,
    persistedEventTypes: ["cloudflare_kv_read", "kv_read"],
  },
  {
    id: "cloudflare-kv-writes-24h",
    label: "Workers KV writes, last 24h",
    envName: "CLOUDFLARE_KV_WRITES_24H",
    limitEnvName: "CLOUDFLARE_KV_WRITES_DAILY_LIMIT",
    unit: "writes",
    defaultLimit: 1000,
    windowDays: 1,
    usageMetric: "workers-kv",
    description:
      "Cloudflare Workers KV writes for dedupe state, run state, and public feed edge snapshots. Free KV includes 1,000 writes/day to different keys.",
    mitigation:
      "Skip unchanged snapshot writes, keep idle scheduled runs from writing state, and reduce shard frequency during write spikes.",
    apiValue: () => null,
    persistedEventTypes: ["cloudflare_kv_write", "kv_write"],
  },
  {
    id: "cloudflare-kv-list-delete-24h",
    label: "Workers KV list/delete ops, last 24h",
    envName: "CLOUDFLARE_KV_LIST_DELETE_24H",
    limitEnvName: "CLOUDFLARE_KV_LIST_DELETE_24H_LIMIT",
    unit: "ops",
    defaultLimit: null,
    windowDays: 1,
    usageMetric: "workers-kv",
    description:
      "KV list/delete operations. NutsNews hot paths should not list keys; set manual inputs if cleanup tooling starts using list/delete operations.",
    mitigation:
      "Keep key cleanup out of runtime hot paths and prefer TTL expiry over manual list/delete sweeps.",
    apiValue: () => null,
    persistedEventTypes: ["cloudflare_kv_list", "cloudflare_kv_delete", "kv_list", "kv_delete"],
  },
  {
    id: "cloudflare-kv-storage",
    label: "Workers KV storage",
    envName: "CLOUDFLARE_KV_STORAGE_GB",
    limitEnvName: "CLOUDFLARE_KV_STORAGE_GB_LIMIT",
    unit: "GB",
    defaultLimit: 1,
    usageMetric: "workers-kv",
    description:
      "Cloudflare KV account storage for Worker state and edge snapshots. Free KV storage is 1 GB/account.",
    mitigation:
      "Keep snapshot payloads compact, expire dedupe/run-state keys aggressively, and archive large fallback data outside KV.",
    apiValue: () => null,
  },
  {
    id: "cloudflare-cdn-bandwidth-30d",
    label: "Cloudflare CDN bandwidth, last 30d",
    envName: "CLOUDFLARE_CDN_BANDWIDTH_30D_GB",
    limitEnvName: "CLOUDFLARE_CDN_BANDWIDTH_30D_GB_LIMIT",
    unit: "GB",
    defaultLimit: 100,
    usageMetric: "analytics",
    description:
      "Cloudflare zone bandwidth/egress for the public site. Cloudflare may not expose a simple hard bandwidth quota, so the limit is an operational threshold.",
    mitigation:
      "Keep public routes cacheable, compress payloads, avoid oversized images, and investigate bot traffic when bandwidth spikes.",
    apiValue: (usage) => usage.cdnBandwidthGb30d,
    persistedEventTypes: ["cloudflare_cdn_bandwidth_gb", "cloudflare_bandwidth_gb"],
  },
  {
    id: "cloudflare-cdn-requests-30d",
    label: "Cloudflare CDN requests, last 30d",
    envName: "CLOUDFLARE_CDN_REQUESTS_30D",
    limitEnvName: "CLOUDFLARE_CDN_REQUESTS_30D_LIMIT",
    unit: "requests",
    defaultLimit: null,
    usageMetric: "analytics",
    description:
      "Cloudflare request volume for the public site. This is operational pressure rather than a normal free-plan request quota.",
    mitigation:
      "Route monitors to /healthz, block abusive bots with Cloudflare rules, and preserve cache HITs for public pages/API.",
    apiValue: (usage) => usage.cdnRequests30d,
    persistedEventTypes: ["cloudflare_cdn_request", "cloudflare_request"],
  },
  {
    id: "cloudflare-cdn-uncached-bandwidth-30d",
    label: "Cloudflare uncached bandwidth, last 30d",
    envName: "CLOUDFLARE_CDN_UNCACHED_BANDWIDTH_30D_GB",
    limitEnvName: "CLOUDFLARE_CDN_UNCACHED_BANDWIDTH_30D_GB_LIMIT",
    unit: "GB",
    defaultLimit: 10,
    usageMetric: "cache",
    description:
      "Estimated Cloudflare bandwidth that was not served from cache. This protects Vercel/Supabase origin usage.",
    mitigation:
      "Fix no-store regressions, tune Cloudflare cache rules, and keep bots away from origin-bound API/page routes.",
    apiValue: (usage) =>
      usage.cdnBandwidthGb30d === null || usage.cdnCachedBandwidthGb30d === null
        ? null
        : Math.max(0, usage.cdnBandwidthGb30d - usage.cdnCachedBandwidthGb30d),
    persistedEventTypes: ["cloudflare_uncached_bandwidth_gb"],
  },
  {
    id: "cloudflare-turnstile-validations-30d",
    label: "Turnstile validations, last 30d",
    envName: "CLOUDFLARE_TURNSTILE_VALIDATIONS_30D",
    limitEnvName: "CLOUDFLARE_TURNSTILE_VALIDATIONS_30D_LIMIT",
    unit: "validations",
    defaultLimit: null,
    usageMetric: "turnstile",
    description:
      "Cloudflare Turnstile Siteverify validations from the contact form. Set manual inputs if contact abuse makes this operationally important.",
    mitigation:
      "Tighten contact form throttling, keep honeypot checks enabled, and review Cloudflare Turnstile analytics during spam bursts.",
    apiValue: () => null,
    persistedEventTypes: ["cloudflare_turnstile_validation", "turnstile_validation"],
  },
];

const CLOUDFLARE_OPTIONAL_SERVICE_METRICS: CloudflareUsageMetricConfig[] = [
  {
    id: "cloudflare-r2-storage",
    label: "R2 storage",
    envName: "CLOUDFLARE_R2_STORAGE_GB",
    limitEnvName: "CLOUDFLARE_R2_STORAGE_GB_LIMIT",
    unit: "GB",
    defaultLimit: 10,
    usageMetric: "r2",
    description:
      "Cloudflare R2 storage. Hidden unless CLOUDFLARE_ENABLE_R2_GUARDRAILS=true because NutsNews currently uses KV, not R2, for the edge feed snapshot.",
    mitigation:
      "Apply lifecycle rules, archive old objects, and keep publisher-image caching scoped before enabling R2-backed delivery.",
    apiValue: () => null,
    enabled: () => readBooleanEnv("CLOUDFLARE_ENABLE_R2_GUARDRAILS"),
  },
  {
    id: "cloudflare-r2-class-a-ops",
    label: "R2 Class A operations",
    envName: "CLOUDFLARE_R2_CLASS_A_OPS_30D",
    limitEnvName: "CLOUDFLARE_R2_CLASS_A_OPS_30D_LIMIT",
    unit: "ops",
    defaultLimit: 1000000,
    usageMetric: "r2",
    description: "Cloudflare R2 Class A write/list operations. Hidden unless R2 guardrails are explicitly enabled.",
    mitigation: "Batch writes, avoid list-heavy cleanup jobs, and prefer deterministic object keys.",
    apiValue: () => null,
    enabled: () => readBooleanEnv("CLOUDFLARE_ENABLE_R2_GUARDRAILS"),
  },
  {
    id: "cloudflare-r2-class-b-ops",
    label: "R2 Class B operations",
    envName: "CLOUDFLARE_R2_CLASS_B_OPS_30D",
    limitEnvName: "CLOUDFLARE_R2_CLASS_B_OPS_30D_LIMIT",
    unit: "ops",
    defaultLimit: 10000000,
    usageMetric: "r2",
    description: "Cloudflare R2 Class B read/head operations. Hidden unless R2 guardrails are explicitly enabled.",
    mitigation: "Serve public assets through Cloudflare cache and avoid uncached object reads from bots.",
    apiValue: () => null,
    enabled: () => readBooleanEnv("CLOUDFLARE_ENABLE_R2_GUARDRAILS"),
  },
  {
    id: "cloudflare-r2-egress",
    label: "R2 egress",
    envName: "CLOUDFLARE_R2_EGRESS_30D_GB",
    limitEnvName: "CLOUDFLARE_R2_EGRESS_30D_GB_LIMIT",
    unit: "GB",
    defaultLimit: null,
    usageMetric: "r2",
    description: "Cloudflare R2 egress. Hidden unless R2 guardrails are explicitly enabled.",
    mitigation: "Put R2 behind cacheable custom domains and avoid r2.dev production delivery.",
    apiValue: () => null,
    enabled: () => readBooleanEnv("CLOUDFLARE_ENABLE_R2_GUARDRAILS"),
  },
  {
    id: "cloudflare-d1-reads",
    label: "D1 reads",
    envName: "CLOUDFLARE_D1_READS_30D",
    limitEnvName: "CLOUDFLARE_D1_READS_30D_LIMIT",
    unit: "reads",
    defaultLimit: null,
    usageMetric: "d1",
    description: "Cloudflare D1 reads. Hidden unless CLOUDFLARE_ENABLE_D1_GUARDRAILS=true because NutsNews uses Supabase Postgres.",
    mitigation: "Move read-heavy paths to cached snapshots before introducing D1.",
    apiValue: () => null,
    enabled: () => readBooleanEnv("CLOUDFLARE_ENABLE_D1_GUARDRAILS"),
  },
  {
    id: "cloudflare-d1-writes",
    label: "D1 writes",
    envName: "CLOUDFLARE_D1_WRITES_30D",
    limitEnvName: "CLOUDFLARE_D1_WRITES_30D_LIMIT",
    unit: "writes",
    defaultLimit: null,
    usageMetric: "d1",
    description: "Cloudflare D1 writes. Hidden unless D1 guardrails are explicitly enabled.",
    mitigation: "Batch writes and keep high-volume ingestion in the owning Worker repo.",
    apiValue: () => null,
    enabled: () => readBooleanEnv("CLOUDFLARE_ENABLE_D1_GUARDRAILS"),
  },
  {
    id: "cloudflare-d1-storage",
    label: "D1 storage",
    envName: "CLOUDFLARE_D1_STORAGE_GB",
    limitEnvName: "CLOUDFLARE_D1_STORAGE_GB_LIMIT",
    unit: "GB",
    defaultLimit: null,
    usageMetric: "d1",
    description: "Cloudflare D1 storage. Hidden unless D1 guardrails are explicitly enabled.",
    mitigation: "Archive old records and keep Supabase as the primary database unless the architecture changes.",
    apiValue: () => null,
    enabled: () => readBooleanEnv("CLOUDFLARE_ENABLE_D1_GUARDRAILS"),
  },
  {
    id: "cloudflare-queues-messages",
    label: "Queues messages",
    envName: "CLOUDFLARE_QUEUES_MESSAGES_30D",
    limitEnvName: "CLOUDFLARE_QUEUES_MESSAGES_30D_LIMIT",
    unit: "messages",
    defaultLimit: null,
    usageMetric: "queues",
    description: "Cloudflare Queues messages. Hidden unless CLOUDFLARE_ENABLE_QUEUES_GUARDRAILS=true.",
    mitigation: "Tune producer rates and consumer batch sizes in the worker repo if queues are introduced.",
    apiValue: () => null,
    enabled: () => readBooleanEnv("CLOUDFLARE_ENABLE_QUEUES_GUARDRAILS"),
  },
  {
    id: "cloudflare-durable-objects-requests",
    label: "Durable Objects requests",
    envName: "CLOUDFLARE_DURABLE_OBJECTS_REQUESTS_30D",
    limitEnvName: "CLOUDFLARE_DURABLE_OBJECTS_REQUESTS_30D_LIMIT",
    unit: "requests",
    defaultLimit: null,
    usageMetric: "durable-objects",
    description: "Cloudflare Durable Objects requests. Hidden unless CLOUDFLARE_ENABLE_DURABLE_OBJECTS_GUARDRAILS=true.",
    mitigation: "Shard object IDs carefully and keep hot state small if Durable Objects are introduced.",
    apiValue: () => null,
    enabled: () => readBooleanEnv("CLOUDFLARE_ENABLE_DURABLE_OBJECTS_GUARDRAILS"),
  },
  {
    id: "cloudflare-images-transformations",
    label: "Cloudflare Images transformations",
    envName: "CLOUDFLARE_IMAGES_TRANSFORMATIONS_30D",
    limitEnvName: "CLOUDFLARE_IMAGES_TRANSFORMATIONS_30D_LIMIT",
    unit: "transformations",
    defaultLimit: null,
    usageMetric: "images",
    description: "Cloudflare Images transformations. Hidden unless CLOUDFLARE_ENABLE_IMAGES_GUARDRAILS=true because web currently uses Vercel/Next image optimization.",
    mitigation: "Limit image variants and cache transformed URLs if Cloudflare Images replaces or supplements Next Image.",
    apiValue: () => null,
    enabled: () => readBooleanEnv("CLOUDFLARE_ENABLE_IMAGES_GUARDRAILS"),
  },
  {
    id: "cloudflare-pages-builds",
    label: "Pages builds/deployments",
    envName: "CLOUDFLARE_PAGES_BUILDS_30D",
    limitEnvName: "CLOUDFLARE_PAGES_BUILDS_30D_LIMIT",
    unit: "builds",
    defaultLimit: null,
    usageMetric: "workers-and-pages",
    description: "Cloudflare Pages builds/deployments. Hidden unless CLOUDFLARE_ENABLE_PAGES_GUARDRAILS=true because NutsNews web deploys on Vercel.",
    mitigation: "Keep web deployments on Vercel unless Pages is intentionally introduced.",
    apiValue: () => null,
    enabled: () => readBooleanEnv("CLOUDFLARE_ENABLE_PAGES_GUARDRAILS"),
  },
];

function getCloudflareApiConfig() {
  return {
    accountId: readStringEnv("CLOUDFLARE_ACCOUNT_ID", null),
    zoneId: readStringEnv("CLOUDFLARE_ZONE_ID", null),
    apiToken: readStringEnv("CLOUDFLARE_API_TOKEN", null),
    workerScriptNames: readStringListEnv("CLOUDFLARE_WORKER_SCRIPT_NAMES"),
  };
}

async function fetchCloudflareGraphQl<T>(
  query: string,
  variables: Record<string, unknown>,
  apiToken: string,
): Promise<T> {
  const response = await fetch(CLOUDFLARE_API_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Cloudflare GraphQL request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message || "Unknown GraphQL error").join("; "));
  }

  if (!payload.data) {
    throw new Error("Cloudflare GraphQL response did not include data.");
  }

  return payload.data;
}

function emptyCloudflareUsage(errorMessage: string | null = null): CloudflareGraphQlUsage {
  return {
    workersRequests24h: null,
    workersRequests30d: null,
    workersCpuP99Ms: null,
    workersSubrequests30d: null,
    cdnRequests30d: null,
    cdnBandwidthGb30d: null,
    cdnCachedBandwidthGb30d: null,
    errorMessage,
  };
}

function appendCloudflareUsageError(usage: CloudflareGraphQlUsage, message: string) {
  usage.errorMessage = usage.errorMessage ? `${usage.errorMessage} ${message}` : message;
}

function toGigabytes(bytes: number) {
  return Math.round((bytes / 1_000_000_000) * 100) / 100;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

async function loadCloudflareGraphQlUsage(): Promise<CloudflareGraphQlUsage> {
  const { accountId, zoneId, apiToken, workerScriptNames } = getCloudflareApiConfig();

  if (!apiToken || (!accountId && !zoneId)) {
    return emptyCloudflareUsage("Set CLOUDFLARE_API_TOKEN plus CLOUDFLARE_ACCOUNT_ID and/or CLOUDFLARE_ZONE_ID for live Cloudflare Analytics API usage.");
  }

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const until = now.toISOString();
  const usage = emptyCloudflareUsage(null);

  if (accountId) {
    try {
      const workerScriptFilter = workerScriptNames.length > 0 ? "scriptName: $scriptName," : "";
      const workerScriptVariable = workerScriptNames.length > 0 ? ", $scriptName: string" : "";
      const workerQuery = `
        query GetWorkersAnalytics($accountTag: string, $datetimeStart: string, $datetimeEnd: string${workerScriptVariable}) {
          viewer {
            accounts(filter: { accountTag: $accountTag }) {
              workersInvocationsAdaptive(limit: 10000, filter: {
                ${workerScriptFilter}
                datetime_geq: $datetimeStart,
                datetime_leq: $datetimeEnd
              }) {
                sum {
                  requests
                  subrequests
                }
                quantiles {
                  cpuTimeP99
                }
              }
            }
          }
        }
      `;

      let requests24h = 0;
      let requests30d = 0;
      let subrequests30d = 0;
      const cpuP99Values: number[] = [];
      const scriptNames = workerScriptNames.length > 0 ? workerScriptNames : [null];

      for (const scriptName of scriptNames) {
        const variables24h: Record<string, unknown> = {
          accountTag: accountId,
          datetimeStart: since24h,
          datetimeEnd: until,
        };
        const variables30d: Record<string, unknown> = {
          accountTag: accountId,
          datetimeStart: since30d,
          datetimeEnd: until,
        };

        if (scriptName) {
          variables24h.scriptName = scriptName;
          variables30d.scriptName = scriptName;
        }

        const [last24h, last30d] = await Promise.all([
          fetchCloudflareGraphQl<{
            viewer?: {
              accounts?: Array<{
                workersInvocationsAdaptive?: Array<{
                  sum?: { requests?: number; subrequests?: number };
                  quantiles?: { cpuTimeP99?: number };
                }>;
              }>;
            };
          }>(workerQuery, variables24h, apiToken),
          fetchCloudflareGraphQl<{
            viewer?: {
              accounts?: Array<{
                workersInvocationsAdaptive?: Array<{
                  sum?: { requests?: number; subrequests?: number };
                  quantiles?: { cpuTimeP99?: number };
                }>;
              }>;
            };
          }>(workerQuery, variables30d, apiToken),
        ]);

        const last24Rows = last24h.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
        const last30Rows = last30d.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];

        requests24h += sum(last24Rows, (row) => toNumber(row.sum?.requests));
        requests30d += sum(last30Rows, (row) => toNumber(row.sum?.requests));
        subrequests30d += sum(last30Rows, (row) => toNumber(row.sum?.subrequests));

        for (const row of last30Rows) {
          const cpuP99 = toNumber(row.quantiles?.cpuTimeP99);
          if (cpuP99 > 0) {
            cpuP99Values.push(cpuP99);
          }
        }
      }

      usage.workersRequests24h = requests24h;
      usage.workersRequests30d = requests30d;
      usage.workersSubrequests30d = subrequests30d;
      usage.workersCpuP99Ms = average(cpuP99Values);
    } catch (error) {
      appendCloudflareUsageError(
        usage,
        error instanceof Error
          ? `Workers Analytics unavailable: ${error.message}`
          : "Workers Analytics unavailable.",
      );
    }
  }

  if (zoneId) {
    try {
      const cdnQuery = `
        query GetZoneHttpAnalytics($zoneTag: string, $datetimeStart: string, $datetimeEnd: string) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequestsAdaptiveGroups(limit: 10000, filter: {
                datetime_geq: $datetimeStart,
                datetime_leq: $datetimeEnd
              }) {
                sum {
                  requests
                  bytes
                  cachedBytes
                }
              }
            }
          }
        }
      `;
      const data = await fetchCloudflareGraphQl<{
        viewer?: {
          zones?: Array<{
            httpRequestsAdaptiveGroups?: Array<{
              sum?: { requests?: number; bytes?: number; cachedBytes?: number };
            }>;
          }>;
        };
      }>(cdnQuery, { zoneTag: zoneId, datetimeStart: since30d, datetimeEnd: until }, apiToken);
      const rows = data.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
      usage.cdnRequests30d = sum(rows, (row) => toNumber(row.sum?.requests));
      usage.cdnBandwidthGb30d = toGigabytes(sum(rows, (row) => toNumber(row.sum?.bytes)));
      usage.cdnCachedBandwidthGb30d = toGigabytes(sum(rows, (row) => toNumber(row.sum?.cachedBytes)));
    } catch (error) {
      appendCloudflareUsageError(
        usage,
        error instanceof Error
          ? `Zone HTTP Analytics unavailable: ${error.message}`
          : "Zone HTTP Analytics unavailable.",
      );
    }
  }

  return usage;
}

function getCloudflareMetricValue({
  metric,
  usage,
  eventRows,
}: {
  metric: CloudflareUsageMetricConfig;
  usage: CloudflareGraphQlUsage;
  eventRows: QuotaUsageEventRow[];
}) {
  const eventWindowRows = metric.windowDays ? filterSince(eventRows, daysAgo(metric.windowDays)) : eventRows;
  const apiValue = metric.apiValue(usage);
  const persistedValue = metric.persistedEventTypes
    ? sumQuotaEventTypes(eventWindowRows, metric.persistedEventTypes)
    : 0;
  const fallbackValue =
    persistedValue > 0 ? persistedValue : apiValue === null ? null : Number(apiValue.toFixed(2));

  return readNumberEnv(metric.envName, fallbackValue);
}

function getCloudflareMetricTrend({
  metric,
  value,
  usage,
  eventRows,
}: {
  metric: CloudflareUsageMetricConfig;
  value: number | null;
  usage: CloudflareGraphQlUsage;
  eventRows: QuotaUsageEventRow[];
}) {
  const manualValue = readNumberEnv(metric.envName, null);

  if (manualValue !== null) {
    return {
      forecastSourceValue: manualValue,
      forecastSourceDays: metric.windowDays ?? 30,
      forecastInsufficientReason: undefined,
    };
  }

  if (metric.persistedEventTypes) {
    const last7Days = filterSince(eventRows, daysAgo(7));
    const persistedLast7Days = sumQuotaEventTypes(last7Days, metric.persistedEventTypes);

    if (persistedLast7Days > 0) {
      return {
        forecastSourceValue: persistedLast7Days,
        forecastSourceDays: 7,
        forecastInsufficientReason: undefined,
      };
    }
  }

  if (
    (metric.id === "cloudflare-workers-requests-24h" ||
      metric.id === "cloudflare-workers-requests-30d") &&
    usage.workersRequests24h !== null
  ) {
    return {
      forecastSourceValue: usage.workersRequests24h,
      forecastSourceDays: 1,
      forecastInsufficientReason: undefined,
    };
  }

  if (metric.windowDays && value !== null) {
    return {
      forecastSourceValue: value,
      forecastSourceDays: metric.windowDays,
      forecastInsufficientReason: undefined,
    };
  }

  if (value !== null) {
    return {
      forecastSourceValue: value,
      forecastSourceDays: 30,
      forecastInsufficientReason: undefined,
    };
  }

  return {
    forecastSourceValue: null,
    forecastSourceDays: null,
    forecastInsufficientReason:
      usage.errorMessage ??
      `Insufficient trend data: no recent Cloudflare Analytics, quota_usage_events, or ${metric.envName} value is available.`,
  };
}

function getCloudflareDataSource(metric: CloudflareUsageMetricConfig, usage: CloudflareGraphQlUsage) {
  if (process.env[metric.envName]?.trim()) {
    return `Cloudflare manual input (${metric.envName})`;
  }

  if (metric.persistedEventTypes?.some((eventType) => eventType.startsWith("cloudflare_"))) {
    return `quota_usage_events ${metric.persistedEventTypes.join("/")}, Cloudflare GraphQL Analytics, or ${metric.envName}`;
  }

  if (metric.apiValue(usage) !== null) {
    return "Cloudflare GraphQL Analytics API";
  }

  return `Manual input required. Set ${metric.envName} and ${metric.limitEnvName}.`;
}

function buildCloudflareUsageMetrics(usage: CloudflareGraphQlUsage, eventRows: QuotaUsageEventRow[]) {
  const metrics = [...CLOUDFLARE_USAGE_METRICS, ...CLOUDFLARE_OPTIONAL_SERVICE_METRICS].filter(
    (metric) => !metric.enabled || metric.enabled(),
  );

  return metrics.map((metric) => {
    const value = getCloudflareMetricValue({ metric, usage, eventRows });
    const limit = readNumberEnv(metric.limitEnvName, metric.defaultLimit);
    const trend = getCloudflareMetricTrend({ metric, value, usage, eventRows });
    const missingInputs =
      value === null || limit === null
        ? ` Set ${metric.envName} and ${metric.limitEnvName} if Cloudflare does not expose this usage through the configured API.`
        : "";

    return buildMetric({
      id: metric.id,
      label: metric.label,
      group: "Cloudflare",
      value,
      limit,
      unit: metric.unit,
      warningThresholdPercent: metric.warningThresholdPercent ?? 70,
      dangerThresholdPercent: metric.dangerThresholdPercent ?? 90,
      forecastSourceValue: trend.forecastSourceValue,
      forecastSourceDays: trend.forecastSourceDays,
      forecastInsufficientReason: trend.forecastInsufficientReason,
      description: `${metric.description}${missingInputs}`,
      mitigation: metric.mitigation,
      dataSource: getCloudflareDataSource(metric, usage),
      sourceUrl: getCloudflareDashboardUrl(metric.usageMetric),
      sourceLabel: "Cloudflare dashboard",
      inputNames: [
        metric.envName,
        metric.limitEnvName,
        "CLOUDFLARE_DASHBOARD_URL",
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_ZONE_ID",
        "CLOUDFLARE_WORKER_SCRIPT_NAMES",
      ],
    });
  });
}

function getSupabaseAdminConfig() {
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function getExactCount(
  supabase: SupabaseClient,
  tableName: string,
) {
  const { count, error } = await supabase
    .from(tableName)
    .select("*", { count: "exact", head: true });

  if (error) {
    console.warn(`Unable to load ${tableName} row count for guardrails`, error.message);
    return null;
  }

  return count ?? 0;
}

async function loadQuotaUsageEvents(
  supabase: SupabaseClient,
  since: Date,
): Promise<QuotaUsageEventRow[]> {
  const { data, error } = await supabase
    .from("quota_usage_events")
    .select("event_type, quantity, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS_TO_LOAD);

  if (error) {
    // The table is optional for older deployments. Treat it as unknown/zero instead of breaking the dashboard.
    console.warn("Unable to load quota usage events for guardrails", error.message);
    return [];
  }

  return (data ?? []) as unknown as QuotaUsageEventRow[];
}

async function loadAiUsageRuns(
  supabase: SupabaseClient,
  since: Date,
): Promise<AiUsageRunRow[]> {
  const { data, error } = await supabase
    .from("ai_usage_runs")
    .select(
      [
        "run_started_at",
        "openai_call_count",
        "openai_prompt_tokens",
        "openai_completion_tokens",
        "openai_total_tokens",
        "estimated_openai_cost_usd",
        "cost_protection_limit_reached",
        "spike_warning_triggered",
        "local_ai_call_count",
        "local_ai_total_tokens",
      ].join(", "),
    )
    .gte("run_started_at", since.toISOString())
    .order("run_started_at", { ascending: false })
    .limit(MAX_ROWS_TO_LOAD);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as AiUsageRunRow[];
}

async function loadWorkerRuns(
  supabase: SupabaseClient,
  since: Date,
): Promise<WorkerRunRow[]> {
  const { data, error } = await supabase
    .from("worker_runs")
    .select(
      [
        "run_started_at",
        "success",
        "shard_index",
        "fetched_count",
        "ai_reviewed_count",
        "accepted_count",
        "rejected_count",
        "duration_ms",
        "cost_protection_limit_reached",
        "spike_warning_triggered",
      ].join(", "),
    )
    .gte("run_started_at", since.toISOString())
    .order("run_started_at", { ascending: false })
    .limit(MAX_ROWS_TO_LOAD);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as WorkerRunRow[];
}

function buildWindowStats({
  workerRows,
  aiRows,
  eventRows,
}: {
  workerRows: WorkerRunRow[];
  aiRows: AiUsageRunRow[];
  eventRows: QuotaUsageEventRow[];
}) {
  return {
    workerRuns: workerRows.length,
    failedWorkerRuns: workerRows.filter((row) => !row.success).length,
    openAiCalls: sum(aiRows, (row) => toNumber(row.openai_call_count)),
    openAiTokens: sum(aiRows, (row) => toNumber(row.openai_total_tokens)),
    openAiCostUsd: sum(aiRows, (row) => toNumber(row.estimated_openai_cost_usd)),
    localAiCalls: sum(aiRows, (row) => toNumber(row.local_ai_call_count)),
    emailSends: sum(
      eventRows.filter((row) => row.event_type === "email_send"),
      (row) => toNumber(row.quantity),
    ),
  };
}

function getOverallRiskLevel(metrics: GuardrailMetric[]): RiskLevel {
  if (metrics.some((metric) => metric.riskLevel === "danger")) {
    return "danger";
  }

  if (metrics.some((metric) => metric.riskLevel === "watch")) {
    return "watch";
  }

  if (metrics.every((metric) => metric.riskLevel === "unknown")) {
    return "unknown";
  }

  return "ok";
}

function emptyDashboard(generatedAt: string, errorMessage: string | null): GuardrailsDashboardData {
  return {
    isConfigured: false,
    errorMessage,
    generatedAt,
    latestRunLabel: "No data yet",
    overallRiskLevel: "unknown",
    metrics: [],
    warnings: [],
    last24Hours: {
      workerRuns: 0,
      failedWorkerRuns: 0,
      openAiCalls: 0,
      openAiTokens: 0,
      openAiCostUsd: 0,
      localAiCalls: 0,
      emailSends: 0,
    },
    last7Days: {
      workerRuns: 0,
      failedWorkerRuns: 0,
      openAiCalls: 0,
      openAiTokens: 0,
      openAiCostUsd: 0,
      localAiCalls: 0,
      emailSends: 0,
    },
    last30Days: {
      workerRuns: 0,
      failedWorkerRuns: 0,
      openAiCalls: 0,
      openAiTokens: 0,
      openAiCostUsd: 0,
      localAiCalls: 0,
      emailSends: 0,
    },
  };
}

export async function getAdminCostGuardrailsDashboardData(): Promise<GuardrailsDashboardData> {
  const generatedAt = new Date().toISOString();
  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseAdminConfig();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return emptyDashboard(
      generatedAt,
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const since30 = daysAgo(30);
    const [aiRows, workerRows, eventRows, articleCount, summaryCount, feedCount, cloudflareUsage] =
      await Promise.all([
        loadAiUsageRuns(supabase, since30),
        loadWorkerRuns(supabase, since30),
        loadQuotaUsageEvents(supabase, since30),
        getExactCount(supabase, "articles"),
        getExactCount(supabase, "article_summaries"),
        getExactCount(supabase, "rss_feeds"),
        loadCloudflareGraphQlUsage(),
      ]);

    const last24Hours = buildWindowStats({
      workerRows: filterSince(workerRows, daysAgo(1)),
      aiRows: filterSince(aiRows, daysAgo(1)),
      eventRows: filterSince(eventRows, daysAgo(1)),
    });
    const last7Days = buildWindowStats({
      workerRows: filterSince(workerRows, daysAgo(7)),
      aiRows: filterSince(aiRows, daysAgo(7)),
      eventRows: filterSince(eventRows, daysAgo(7)),
    });
    const last30Days = buildWindowStats({ workerRows, aiRows, eventRows });
    const persistedRedisKvOps = sumQuotaEventTypes(eventRows, [
      "redis_kv_operation",
      "redis_kv_ops",
      "kv_operation",
      "kv_read",
      "kv_write",
    ]);
    const persistedEgressGb = sumQuotaEventTypes(eventRows, [
      "egress_gb",
      "bandwidth_gb",
      "fast_data_transfer_gb",
      "fast_origin_transfer_gb",
    ]);
    const persistedPageSpeedCalls = sumQuotaEventTypes(eventRows, [
      "pagespeed_api_call",
      "pagespeed_api_calls",
      "third_party_api_call",
    ]);
    const vercelFastOriginTransferGb =
      readNumberEnv("NUTSNEWS_VERCEL_FAST_ORIGIN_TRANSFER_GB", 1.31) ?? 1.31;
    const vercelFastDataTransferGb =
      readNumberEnv("NUTSNEWS_VERCEL_FAST_DATA_TRANSFER_GB", 1.93) ?? 1.93;
    const vercelEstimatedEgressGb = vercelFastOriginTransferGb + vercelFastDataTransferGb;

    const totalContentRows =
      articleCount === null || summaryCount === null || feedCount === null
        ? null
        : articleCount + summaryCount + feedCount;

    const metrics: GuardrailMetric[] = [
      buildMetric({
        id: "db-content-rows",
        label: "Database content rows",
        group: "Database",
        value: totalContentRows,
        limit: readNumberEnv("NUTSNEWS_DB_CONTENT_ROW_LIMIT", 50000),
        unit: "rows",
        description:
          "Approximate Supabase growth using articles, article_summaries, and rss_feeds row counts.",
        mitigation:
          "Archive old rejected reviews, reduce retained summaries, prune duplicate feeds, and export backups before deleting historical rows.",
        dataSource: "Supabase row counts",
      }),
      buildMetric({
        id: "article-count",
        label: "Articles table",
        group: "Database",
        value: articleCount,
        limit: readNumberEnv("NUTSNEWS_ARTICLE_ROW_LIMIT", 30000),
        unit: "articles",
        description: "Total rows currently stored in public.articles.",
        mitigation:
          "Lower article retention, keep only published/needed rows, or move old rows into an archive export.",
        dataSource: "Supabase articles count",
      }),
      buildMetric({
        id: "summary-count",
        label: "Translation summary rows",
        group: "Database",
        value: summaryCount,
        limit: readNumberEnv("NUTSNEWS_ARTICLE_SUMMARY_ROW_LIMIT", 90000),
        unit: "summaries",
        description: "Total rows stored in public.article_summaries for translated article titles and summaries.",
        mitigation:
          "Reduce enabled languages, backfill in smaller batches, or archive old translated rows for articles no longer shown.",
        dataSource: "Supabase article_summaries count",
      }),
      buildMetric({
        id: "openai-month-cost",
        label: "OpenAI cost, last 30 days",
        group: "AI",
        value: Number(last30Days.openAiCostUsd.toFixed(6)),
        limit: readNumberEnv("NUTSNEWS_OPENAI_MONTHLY_BUDGET_USD", 5),
        unit: "USD",
        warningThresholdPercent: 60,
        dangerThresholdPercent: 85,
        forecastSourceLast7Days: last7Days.openAiCostUsd,
        description: "Estimated OpenAI cost from Worker usage rows in the last 30 days.",
        mitigation:
          "Lower MAX_AI_REVIEWS, prefer local AI, increase local prefilters, or temporarily pause non-critical shards.",
        dataSource: "ai_usage_runs",
      }),
      buildMetric({
        id: "openai-month-calls",
        label: "OpenAI calls, last 30 days",
        group: "AI",
        value: last30Days.openAiCalls,
        limit: readNumberEnv("NUTSNEWS_OPENAI_MONTHLY_CALL_LIMIT", 50000),
        unit: "calls",
        forecastSourceLast7Days: last7Days.openAiCalls,
        description: "Number of OpenAI calls captured from Worker usage rows in the last 30 days.",
        mitigation:
          "Reduce AI review concurrency, reduce per-shard review limits, and push more review work to the local model.",
        dataSource: "ai_usage_runs",
      }),
      buildMetric({
        id: "worker-month-runs",
        label: "Worker invocations, last 30 days",
        group: "Workers",
        value: last30Days.workerRuns,
        limit: readNumberEnv("NUTSNEWS_WORKER_MONTHLY_INVOCATION_LIMIT", 100000),
        unit: "runs",
        forecastSourceLast7Days: last7Days.workerRuns,
        description: "Saved Worker run rows over the last 30 days. This is the best available proxy for Worker invocations.",
        mitigation:
          "Increase cron interval, reduce shard count, pause low-quality feeds, or consolidate shards when free-tier pressure rises.",
        dataSource: "worker_runs",
      }),
      buildMetric({
        id: "worker-failures-24h",
        label: "Worker failures, last 24 hours",
        group: "Workers",
        value: last24Hours.failedWorkerRuns,
        limit: readNumberEnv("NUTSNEWS_WORKER_24H_FAILURE_LIMIT", 5),
        unit: "failures",
        warningThresholdPercent: 40,
        dangerThresholdPercent: 100,
        description: "Failed Worker rows in the last 24 hours.",
        mitigation:
          "Inspect /admin/shards, check failed feed errors, temporarily disable failing feeds, and verify secrets/bindings.",
        dataSource: "worker_runs",
      }),
      buildMetric({
        id: "email-sends-30d",
        label: "Contact email sends, last 30 days",
        group: "Email",
        value: last30Days.emailSends,
        limit: readNumberEnv("NUTSNEWS_EMAIL_MONTHLY_SEND_LIMIT", 3000),
        unit: "emails",
        forecastSourceLast7Days: last7Days.emailSends,
        description:
          "Contact form email sends recorded after successful provider delivery. Older deployments may show zero until quota_usage_events exists.",
        mitigation:
          "Tighten Turnstile protection, add rate limiting, or temporarily route contact submissions to a cheaper provider/queue.",
        dataSource: "quota_usage_events.email_send",
      }),
      buildMetric({
        id: "redis-kv-ops",
        label: "Redis/KV usage",
        group: "Redis/KV",
        value: readNumberEnv("NUTSNEWS_REDIS_KV_30D_OPS", persistedRedisKvOps),
        limit: readNumberEnv("NUTSNEWS_REDIS_KV_30D_OP_LIMIT", 100000),
        unit: "ops",
        description:
          "Redis/KV operations in the last 30 days from quota_usage_events when present, or from manual environment input. A zero value means no matching quota events have been recorded yet.",
        mitigation:
          "Increase TTLs, avoid caching permanent no-thumbnail rejects, and keep Redis locks short-lived.",
        dataSource: "quota_usage_events redis/kv event types or NUTSNEWS_REDIS_KV_30D_OPS",
        sourceUrl: readStringEnv("NUTSNEWS_REDIS_KV_USAGE_URL", "https://dash.cloudflare.com/"),
        sourceLabel: "Redis/KV provider usage",
        inputNames: [
          "NUTSNEWS_REDIS_KV_30D_OPS",
          "NUTSNEWS_REDIS_KV_30D_OP_LIMIT",
          "NUTSNEWS_REDIS_KV_USAGE_URL",
        ],
      }),
      buildMetric({
        id: "egress-month-gb",
        label: "Estimated egress, last 30 days",
        group: "Egress",
        value: readNumberEnv(
          "NUTSNEWS_EGRESS_30D_GB",
          persistedEgressGb > 0 ? persistedEgressGb : Number(vercelEstimatedEgressGb.toFixed(2)),
        ),
        limit: readNumberEnv("NUTSNEWS_EGRESS_30D_GB_LIMIT", 100),
        unit: "GB",
        description:
          "Estimated 30-day bandwidth from persisted quota events, manual CDN input, or the current Vercel Fast Data Transfer plus Fast Origin Transfer values.",
        mitigation:
          "Use CDN caching, optimize images, keep API responses small, and avoid uncached high-frequency homepage/API refreshes.",
        dataSource: "quota_usage_events bandwidth event types, NUTSNEWS_EGRESS_30D_GB, or Vercel transfer inputs",
        sourceUrl: readStringEnv(
          "NUTSNEWS_EGRESS_USAGE_URL",
          buildUsageUrl(getVercelUsageBaseUrl(), "fast-data-transfer"),
        ),
        sourceLabel: "Bandwidth usage",
        inputNames: [
          "NUTSNEWS_EGRESS_30D_GB",
          "NUTSNEWS_EGRESS_30D_GB_LIMIT",
          "NUTSNEWS_EGRESS_USAGE_URL",
          "NUTSNEWS_VERCEL_FAST_DATA_TRANSFER_GB",
          "NUTSNEWS_VERCEL_FAST_ORIGIN_TRANSFER_GB",
        ],
      }),
      buildMetric({
        id: "pagespeed-api-calls",
        label: "PageSpeed/API calls, last 30 days",
        group: "PageSpeed/API",
        value: readNumberEnv("NUTSNEWS_PAGESPEED_30D_CALLS", persistedPageSpeedCalls),
        limit: readNumberEnv("NUTSNEWS_PAGESPEED_30D_CALL_LIMIT", 25000),
        unit: "calls",
        description:
          "PageSpeed or third-party API calls in the last 30 days from quota_usage_events when present, or from manual environment input. A zero value means audits have not recorded quota events yet.",
        mitigation:
          "Run PageSpeed audits less often, cache reports, or move scheduled audits to manual workflow_dispatch during incidents.",
        dataSource: "quota_usage_events pagespeed_api_call or NUTSNEWS_PAGESPEED_30D_CALLS",
        sourceUrl: readStringEnv(
          "NUTSNEWS_PAGESPEED_USAGE_URL",
          "https://console.cloud.google.com/apis/api/pagespeedonline.googleapis.com/quotas",
        ),
        sourceLabel: "PageSpeed API quotas",
        inputNames: [
          "NUTSNEWS_PAGESPEED_30D_CALLS",
          "NUTSNEWS_PAGESPEED_30D_CALL_LIMIT",
          "NUTSNEWS_PAGESPEED_USAGE_URL",
        ],
      }),
      ...buildCloudflareUsageMetrics(cloudflareUsage, eventRows),
      ...buildVercelUsageMetrics(),
    ];

    const warnings = metrics.filter(
      (metric) => metric.riskLevel === "watch" || metric.riskLevel === "danger",
    );
    const latestRun = workerRows[0]?.run_started_at ?? aiRows[0]?.run_started_at ?? null;

    return {
      isConfigured: true,
      errorMessage: null,
      generatedAt,
      latestRunLabel: formatAdminDateTime(latestRun, "No Worker/AI usage rows yet"),
      overallRiskLevel: getOverallRiskLevel(metrics),
      metrics,
      warnings,
      last24Hours,
      last7Days,
      last30Days,
    };
  } catch (error) {
    return emptyDashboard(
      generatedAt,
      error instanceof Error ? error.message : "Unable to load free-tier guardrail data.",
    );
  }
}
