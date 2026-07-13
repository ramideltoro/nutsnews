import { getServerSupabase } from "@/lib/supabase";
import {
  getAdminDateKey,
  getAdminTimeZone,
  getLastAdminDateKeys,
} from "@/lib/adminTime";

type LocalAiUsageRunRow = {
  id: number;
  run_started_at: string;
  run_completed_at: string | null;
  run_source: "manual" | "scheduled" | "unknown";
  shard_index: number;
  ai_provider: string | null;
  local_ai_model: string | null;
  local_ai_call_count: number | string | null;
  local_ai_prompt_tokens: number | string | null;
  local_ai_completion_tokens: number | string | null;
  local_ai_total_tokens: number | string | null;
  local_ai_accepted_count: number | string | null;
  local_ai_rejected_count: number | string | null;
  local_ai_duration_ms: number | string | null;
  openai_call_count: number | string | null;
  ai_reviewed_count: number | string | null;
  duration_ms: number | string | null;
};

type LocalAiReviewDbRow = {
  id: number;
  reviewed_at: string;
  original_url: string;
  source: string;
  title: string;
  decision: "accept" | "reject";
  category: string | null;
  positivity_score: number | string | null;
  summary: string | null;
  reason: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  review_duration_ms: number | string | null;
};

export type LocalAiSummary = {
  runCount: number;
  shardCount: number;
  localAiCallCount: number;
  fallbackOpenAiCallCount: number;
  reviewedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  acceptanceRate: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  averageReviewDurationMs: number;
  averageRunDurationMs: number;
  latestRunAt: string | null;
  latestModel: string;
};

export type LocalAiModelSummary = {
  model: string;
  runCount: number;
  callCount: number;
  acceptedCount: number;
  rejectedCount: number;
  acceptanceRate: number;
  totalTokens: number;
  averageReviewDurationMs: number;
  latestRunAt: string | null;
};

export type LocalAiDailyPoint = {
  date: string;
  runCount: number;
  callCount: number;
  acceptedCount: number;
  rejectedCount: number;
  fallbackOpenAiCallCount: number;
  averageReviewDurationMs: number;
};

export type LocalAiLatestRun = {
  id: number;
  runStartedAt: string;
  runSource: "manual" | "scheduled" | "unknown";
  shardIndex: number;
  provider: string;
  model: string;
  localAiCallCount: number;
  fallbackOpenAiCallCount: number;
  acceptedCount: number;
  rejectedCount: number;
  totalTokens: number;
  averageReviewDurationMs: number;
  durationMs: number;
};

export type LocalAiRecentReview = {
  id: number;
  reviewedAt: string;
  originalUrl: string;
  source: string;
  title: string;
  decision: "accept" | "reject";
  category: string;
  positivityScore: number;
  summary: string;
  reason: string;
  provider: string;
  model: string;
  reviewDurationMs: number;
};

export type LocalAiDashboardData = {
  isConfigured: boolean;
  errorMessage: string | null;
  generatedAt: string;
  last24Hours: LocalAiSummary;
  last7Days: LocalAiSummary;
  last30Days: LocalAiSummary;
  modelSummaries: LocalAiModelSummary[];
  daily: LocalAiDailyPoint[];
  latestRuns: LocalAiLatestRun[];
  recentReviews: LocalAiRecentReview[];
};

const MAX_RUN_ROWS_TO_LOAD = 5000;
const MAX_REVIEW_ROWS_TO_LOAD = 50;

function dateHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function dateDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

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

function filterRowsSince(rows: LocalAiUsageRunRow[], since: Date) {
  const sinceTime = since.getTime();

  return rows.filter((row) => {
    const runTime = new Date(row.run_started_at).getTime();

    if (Number.isNaN(runTime)) {
      return false;
    }

    return runTime >= sinceTime;
  });
}

function emptySummary(): LocalAiSummary {
  return {
    runCount: 0,
    shardCount: 0,
    localAiCallCount: 0,
    fallbackOpenAiCallCount: 0,
    reviewedCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    acceptanceRate: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    averageReviewDurationMs: 0,
    averageRunDurationMs: 0,
    latestRunAt: null,
    latestModel: "qwen2.5:3b",
  };
}

function getModel(row: LocalAiUsageRunRow) {
  return row.local_ai_model || "qwen2.5:3b";
}

function summarizeRows(rows: LocalAiUsageRunRow[]): LocalAiSummary {
  if (rows.length === 0) {
    return emptySummary();
  }

  const shardIndexes = new Set(rows.map((row) => row.shard_index));
  const localAiCallCount = rows.reduce(
    (total, row) => total + toNumber(row.local_ai_call_count),
    0,
  );
  const fallbackOpenAiCallCount = rows.reduce(
    (total, row) => total + toNumber(row.openai_call_count),
    0,
  );
  const reviewedCount = rows.reduce(
    (total, row) => total + toNumber(row.ai_reviewed_count),
    0,
  );
  const acceptedCount = rows.reduce(
    (total, row) => total + toNumber(row.local_ai_accepted_count),
    0,
  );
  const rejectedCount = rows.reduce(
    (total, row) => total + toNumber(row.local_ai_rejected_count),
    0,
  );
  const promptTokens = rows.reduce(
    (total, row) => total + toNumber(row.local_ai_prompt_tokens),
    0,
  );
  const completionTokens = rows.reduce(
    (total, row) => total + toNumber(row.local_ai_completion_tokens),
    0,
  );
  const totalTokens = rows.reduce(
    (total, row) => total + toNumber(row.local_ai_total_tokens),
    0,
  );
  const reviewDurationMs = rows.reduce(
    (total, row) => total + toNumber(row.local_ai_duration_ms),
    0,
  );
  const runDurationMs = rows.reduce(
    (total, row) => total + toNumber(row.duration_ms),
    0,
  );

  return {
    runCount: rows.length,
    shardCount: shardIndexes.size,
    localAiCallCount,
    fallbackOpenAiCallCount,
    reviewedCount,
    acceptedCount,
    rejectedCount,
    acceptanceRate:
      localAiCallCount === 0
        ? 0
        : Math.round((acceptedCount / localAiCallCount) * 100),
    promptTokens,
    completionTokens,
    totalTokens,
    averageReviewDurationMs:
      localAiCallCount === 0
        ? 0
        : Math.round(reviewDurationMs / localAiCallCount),
    averageRunDurationMs: Math.round(runDurationMs / rows.length),
    latestRunAt: rows[0]?.run_started_at ?? null,
    latestModel: getModel(rows[0]),
  };
}

function buildModelSummaries(
  rows: LocalAiUsageRunRow[],
): LocalAiModelSummary[] {
  const rowsByModel = new Map<string, LocalAiUsageRunRow[]>();

  for (const row of rows) {
    const model = getModel(row);
    const currentRows = rowsByModel.get(model) ?? [];
    currentRows.push(row);
    rowsByModel.set(model, currentRows);
  }

  return Array.from(rowsByModel.entries())
    .map(([model, modelRows]) => {
      const summary = summarizeRows(modelRows);

      return {
        model,
        runCount: summary.runCount,
        callCount: summary.localAiCallCount,
        acceptedCount: summary.acceptedCount,
        rejectedCount: summary.rejectedCount,
        acceptanceRate: summary.acceptanceRate,
        totalTokens: summary.totalTokens,
        averageReviewDurationMs: summary.averageReviewDurationMs,
        latestRunAt: summary.latestRunAt,
      };
    })
    .sort((a, b) => b.callCount - a.callCount);
}

function buildDailyPoints(rows: LocalAiUsageRunRow[]): LocalAiDailyPoint[] {
  const timeZone = getAdminTimeZone();

  return getLastAdminDateKeys(7, timeZone).map((dateKey) => {
    const dateRows = rows.filter((row) => {
      if (!row.run_started_at) {
        return false;
      }

      return getAdminDateKey(row.run_started_at, timeZone) === dateKey;
    });
    const summary = summarizeRows(dateRows);

    return {
      date: dateKey,
      runCount: summary.runCount,
      callCount: summary.localAiCallCount,
      acceptedCount: summary.acceptedCount,
      rejectedCount: summary.rejectedCount,
      fallbackOpenAiCallCount: summary.fallbackOpenAiCallCount,
      averageReviewDurationMs: summary.averageReviewDurationMs,
    };
  });
}

function buildLatestRuns(rows: LocalAiUsageRunRow[]): LocalAiLatestRun[] {
  return rows.slice(0, 25).map((row) => {
    const localAiCallCount = toNumber(row.local_ai_call_count);
    const acceptedCount = toNumber(row.local_ai_accepted_count);
    const rejectedCount = toNumber(row.local_ai_rejected_count);

    return {
      id: row.id,
      runStartedAt: row.run_started_at,
      runSource: row.run_source,
      shardIndex: row.shard_index,
      provider: row.ai_provider || "local",
      model: getModel(row),
      localAiCallCount,
      fallbackOpenAiCallCount: toNumber(row.openai_call_count),
      acceptedCount,
      rejectedCount,
      totalTokens: toNumber(row.local_ai_total_tokens),
      averageReviewDurationMs:
        localAiCallCount === 0
          ? 0
          : Math.round(toNumber(row.local_ai_duration_ms) / localAiCallCount),
      durationMs: toNumber(row.duration_ms),
    };
  });
}

function buildRecentReviews(rows: LocalAiReviewDbRow[]): LocalAiRecentReview[] {
  return rows.map((row) => ({
    id: row.id,
    reviewedAt: row.reviewed_at,
    originalUrl: row.original_url,
    source: row.source,
    title: row.title,
    decision: row.decision,
    category: row.category || "Uncategorized",
    positivityScore: toNumber(row.positivity_score),
    summary: row.summary || "",
    reason: row.reason || "",
    provider: row.ai_provider || "local",
    model: row.ai_model || "qwen2.5:3b",
    reviewDurationMs: toNumber(row.review_duration_ms),
  }));
}

function createSupabaseAdminClient() {
  return getServerSupabase();
}

async function loadLocalAiRunsSince(since: Date) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("ai_usage_runs")
    .select(
      [
        "id",
        "run_started_at",
        "run_completed_at",
        "run_source",
        "shard_index",
        "ai_provider",
        "local_ai_model",
        "local_ai_call_count",
        "local_ai_prompt_tokens",
        "local_ai_completion_tokens",
        "local_ai_total_tokens",
        "local_ai_accepted_count",
        "local_ai_rejected_count",
        "local_ai_duration_ms",
        "openai_call_count",
        "ai_reviewed_count",
        "duration_ms",
      ].join(", "),
    )
    .or("ai_provider.eq.local,local_ai_call_count.gt.0")
    .gte("run_started_at", since.toISOString())
    .order("run_started_at", { ascending: false })
    .limit(MAX_RUN_ROWS_TO_LOAD);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as LocalAiUsageRunRow[];
}

async function loadRecentLocalReviews() {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("article_ai_reviews")
    .select(
      [
        "id",
        "reviewed_at",
        "original_url",
        "source",
        "title",
        "decision",
        "category",
        "positivity_score",
        "summary",
        "reason",
        "ai_provider",
        "ai_model",
        "review_duration_ms",
      ].join(", "),
    )
    .eq("ai_provider", "local")
    .order("reviewed_at", { ascending: false })
    .limit(MAX_REVIEW_ROWS_TO_LOAD);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as LocalAiReviewDbRow[];
}

export async function getAdminLocalAiDashboardData(): Promise<LocalAiDashboardData> {
  const generatedAt = new Date().toISOString();

  try {
    const [runs, reviews] = await Promise.all([
      loadLocalAiRunsSince(dateDaysAgo(30)),
      loadRecentLocalReviews(),
    ]);
    const last24HourRuns = filterRowsSince(runs, dateHoursAgo(24));
    const last7DayRuns = filterRowsSince(runs, dateDaysAgo(7));
    const last30DayRuns = filterRowsSince(runs, dateDaysAgo(30));

    return {
      isConfigured: true,
      errorMessage: null,
      generatedAt,
      last24Hours: summarizeRows(last24HourRuns),
      last7Days: summarizeRows(last7DayRuns),
      last30Days: summarizeRows(last30DayRuns),
      modelSummaries: buildModelSummaries(last30DayRuns),
      daily: buildDailyPoints(last7DayRuns),
      latestRuns: buildLatestRuns(runs),
      recentReviews: buildRecentReviews(reviews),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load local AI dashboard data.";

    return {
      isConfigured: false,
      errorMessage: message,
      generatedAt,
      last24Hours: emptySummary(),
      last7Days: emptySummary(),
      last30Days: emptySummary(),
      modelSummaries: [],
      daily: buildDailyPoints([]),
      latestRuns: [],
      recentReviews: [],
    };
  }
}
