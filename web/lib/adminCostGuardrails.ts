import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { formatAdminDateTime } from "@/lib/adminTime";

type RiskLevel = "ok" | "watch" | "danger" | "unknown";

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
    | "Vercel";
  value: number | null;
  limit: number | null;
  unit: string;
  riskLevel: RiskLevel;
  usagePercent: number | null;
  forecast30DayValue: number | null;
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

function forecast30DayValue(valueLast7Days: number) {
  return Math.round((valueLast7Days / 7) * 30);
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
  description: string;
  mitigation: string;
  dataSource: string;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  inputNames?: string[];
}): GuardrailMetric {
  return {
    id,
    label,
    group,
    value,
    limit,
    unit,
    warningThresholdPercent,
    dangerThresholdPercent,
    riskLevel: riskLevel(value, limit, warningThresholdPercent, dangerThresholdPercent),
    usagePercent: usagePercent(value, limit),
    forecast30DayValue:
      typeof forecastSourceLast7Days === "number"
        ? forecast30DayValue(forecastSourceLast7Days)
        : null,
    description,
    mitigation,
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
    const [aiRows, workerRows, eventRows, articleCount, summaryCount, feedCount] =
      await Promise.all([
        loadAiUsageRuns(supabase, since30),
        loadWorkerRuns(supabase, since30),
        loadQuotaUsageEvents(supabase, since30),
        getExactCount(supabase, "articles"),
        getExactCount(supabase, "article_summaries"),
        getExactCount(supabase, "rss_feeds"),
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
