import { getServerSupabase } from "@/lib/supabase";
import {
    getAdminDateKey,
    getAdminTimeZone,
    getLastAdminDateKeys,
} from "@/lib/adminTime";

type AiUsageRunRow = {
    id: number;
    created_at: string;
    run_started_at: string;
    run_completed_at: string;
    run_source: "manual" | "scheduled" | "unknown";
    request_id: string | null;
    shard_index: number;
    feeds_per_shard: number;
    max_ai_reviews: number;
    feed_count: number;
    fetched_count: number;
    candidate_count: number;
    already_reviewed_count: number;
    unreviewed_count: number;
    eligible_for_ai_count: number;
    ai_reviewed_count: number;
    openai_model: string;
    openai_call_count: number;
    openai_prompt_tokens: number;
    openai_completion_tokens: number;
    openai_total_tokens: number;
    estimated_openai_cost_usd: number | string;
    openai_review_count: number | string | null;
    openai_review_prompt_tokens: number | string | null;
    openai_review_completion_tokens: number | string | null;
    openai_review_total_tokens: number | string | null;
    estimated_openai_review_cost_usd: number | string | null;
    openai_translation_count: number | string | null;
    openai_translation_prompt_tokens: number | string | null;
    openai_translation_completion_tokens: number | string | null;
    openai_translation_total_tokens: number | string | null;
    estimated_openai_translation_cost_usd: number | string | null;
    local_ai_model: string | null;
    local_ai_call_count: number | string | null;
    local_ai_prompt_tokens: number | string | null;
    local_ai_completion_tokens: number | string | null;
    local_ai_total_tokens: number | string | null;
    local_ai_accepted_count: number | string | null;
    local_ai_rejected_count: number | string | null;
    local_ai_review_count: number | string | null;
    local_ai_review_prompt_tokens: number | string | null;
    local_ai_review_completion_tokens: number | string | null;
    local_ai_review_total_tokens: number | string | null;
    local_ai_translation_count: number | string | null;
    local_ai_translation_prompt_tokens: number | string | null;
    local_ai_translation_completion_tokens: number | string | null;
    local_ai_translation_total_tokens: number | string | null;
    estimated_local_ai_savings_usd: number | string | null;
    openai_accepted_count: number;
    openai_rejected_count: number;
    published_accepted_count: number;
    total_rejected_count: number;
    no_thumbnail_rejected_count: number;
    locally_rejected_count: number;
    cost_protection_limit_reached: boolean;
    spike_warning_triggered: boolean;
    review_save_ok: boolean;
    article_save_ok: boolean;
    duration_ms: number;
};

export type AiUsageSummary = {
    runCount: number;
    shardCount: number;
    openAiCallCount: number;
    localAiCallCount: number;
    totalAiActivityCount: number;
    aiReviewedCount: number;
    acceptedCount: number;
    rejectedCount: number;
    acceptanceRate: number;
    rejectionRate: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    estimatedLocalAiSavingsUsd: number;
    openAiReviewCount: number;
    openAiTranslationCount: number;
    localAiReviewCount: number;
    localAiTranslationCount: number;
    openAiReviewTokens: number;
    openAiTranslationTokens: number;
    localAiReviewTokens: number;
    localAiTranslationTokens: number;
    estimatedOpenAiReviewCostUsd: number;
    estimatedOpenAiTranslationCostUsd: number;
    costProtectionHitCount: number;
    spikeWarningCount: number;
    averageDurationMs: number;
    latestRunAt: string | null;
};

export type AiUsageDailyPoint = {
    date: string;
    runCount: number;
    openAiCallCount: number;
    localAiCallCount: number;
    totalAiActivityCount: number;
    aiReviewedCount: number;
    acceptedCount: number;
    rejectedCount: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    estimatedLocalAiSavingsUsd: number;
    openAiReviewCount: number;
    openAiTranslationCount: number;
    localAiReviewCount: number;
    localAiTranslationCount: number;
    openAiReviewTokens: number;
    openAiTranslationTokens: number;
    localAiReviewTokens: number;
    localAiTranslationTokens: number;
    estimatedOpenAiReviewCostUsd: number;
    estimatedOpenAiTranslationCostUsd: number;
    costProtectionHitCount: number;
    spikeWarningCount: number;
};

export type AiUsageShardPoint = {
    shardIndex: number;
    runCount: number;
    openAiCallCount: number;
    localAiCallCount: number;
    totalAiActivityCount: number;
    aiReviewedCount: number;
    acceptedCount: number;
    rejectedCount: number;
    totalTokens: number;
    estimatedCostUsd: number;
    estimatedLocalAiSavingsUsd: number;
    latestRunAt: string | null;
    costProtectionHitCount: number;
    spikeWarningCount: number;
};

export type AiUsageLatestRun = {
    id: number;
    runStartedAt: string;
    runSource: "manual" | "scheduled" | "unknown";
    shardIndex: number;
    openAiModel: string;
    openAiCallCount: number;
    localAiCallCount: number;
    totalAiActivityCount: number;
    aiReviewedCount: number;
    acceptedCount: number;
    rejectedCount: number;
    totalTokens: number;
    estimatedCostUsd: number;
    estimatedLocalAiSavingsUsd: number;
    openAiReviewCount: number;
    openAiTranslationCount: number;
    localAiReviewCount: number;
    localAiTranslationCount: number;
    costProtectionLimitReached: boolean;
    spikeWarningTriggered: boolean;
    durationMs: number;
};

export type AiUsageDashboardData = {
    isConfigured: boolean;
    errorMessage: string | null;
    generatedAt: string;
    last24Hours: AiUsageSummary;
    last7Days: AiUsageSummary;
    last30Days: AiUsageSummary;
    daily: AiUsageDailyPoint[];
    shards: AiUsageShardPoint[];
    latestRuns: AiUsageLatestRun[];
};

const MAX_RUN_ROWS_TO_LOAD = 5000;

function emptySummary(): AiUsageSummary {
    return {
        runCount: 0,
        shardCount: 0,
        openAiCallCount: 0,
        localAiCallCount: 0,
        totalAiActivityCount: 0,
        aiReviewedCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        acceptanceRate: 0,
        rejectionRate: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        estimatedLocalAiSavingsUsd: 0,
        openAiReviewCount: 0,
        openAiTranslationCount: 0,
        localAiReviewCount: 0,
        localAiTranslationCount: 0,
        openAiReviewTokens: 0,
        openAiTranslationTokens: 0,
        localAiReviewTokens: 0,
        localAiTranslationTokens: 0,
        estimatedOpenAiReviewCostUsd: 0,
        estimatedOpenAiTranslationCostUsd: 0,
        costProtectionHitCount: 0,
        spikeWarningCount: 0,
        averageDurationMs: 0,
        latestRunAt: null,
    };
}

function dateHoursAgo(hours: number) {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function dateDaysAgo(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function getLocalDateKey(date: Date | string, timeZone: string) {
    return getAdminDateKey(date, timeZone);
}

function getLastLocalDateKeys(days: number, timeZone: string) {
    return getLastAdminDateKeys(days, timeZone);
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

function filterRowsSince(rows: AiUsageRunRow[], since: Date) {
    const sinceTime = since.getTime();

    return rows.filter((row) => {
        const runTime = new Date(row.run_started_at).getTime();

        if (Number.isNaN(runTime)) {
            return false;
        }

        return runTime >= sinceTime;
    });
}


function getOpenAiTranslationCount(row: AiUsageRunRow) {
    return toNumber(row.openai_translation_count);
}

function getOpenAiReviewCount(row: AiUsageRunRow) {
    const explicitCount = toNumber(row.openai_review_count);

    if (explicitCount > 0) {
        return explicitCount;
    }

    return Math.max(0, toNumber(row.openai_call_count) - getOpenAiTranslationCount(row));
}

function getLocalAiTranslationCount(row: AiUsageRunRow) {
    return toNumber(row.local_ai_translation_count);
}

function getLocalAiReviewCount(row: AiUsageRunRow) {
    const explicitCount = toNumber(row.local_ai_review_count);

    if (explicitCount > 0) {
        return explicitCount;
    }

    return Math.max(0, toNumber(row.local_ai_call_count) - getLocalAiTranslationCount(row));
}

function getOpenAiReviewTokens(row: AiUsageRunRow) {
    const explicitTokens = toNumber(row.openai_review_total_tokens);

    if (explicitTokens > 0) {
        return explicitTokens;
    }

    return Math.max(0, toNumber(row.openai_total_tokens) - toNumber(row.openai_translation_total_tokens));
}

function getOpenAiReviewCost(row: AiUsageRunRow) {
    const explicitCost = toNumber(row.estimated_openai_review_cost_usd);

    if (explicitCost > 0) {
        return explicitCost;
    }

    return Math.max(0, toNumber(row.estimated_openai_cost_usd) - toNumber(row.estimated_openai_translation_cost_usd));
}

function summarizeRuns(rows: AiUsageRunRow[]): AiUsageSummary {
    if (rows.length === 0) {
        return emptySummary();
    }

    const shardIndexes = new Set(rows.map((row) => row.shard_index));
    const openAiCallCount = rows.reduce((total, row) => total + toNumber(row.openai_call_count), 0);
    const localAiCallCount = rows.reduce((total, row) => total + toNumber(row.local_ai_call_count), 0);
    const openAiReviewCount = rows.reduce((total, row) => total + getOpenAiReviewCount(row), 0);
    const openAiTranslationCount = rows.reduce((total, row) => total + getOpenAiTranslationCount(row), 0);
    const localAiReviewCount = rows.reduce((total, row) => total + getLocalAiReviewCount(row), 0);
    const localAiTranslationCount = rows.reduce((total, row) => total + getLocalAiTranslationCount(row), 0);
    const aiReviewedCount = rows.reduce((total, row) => total + row.ai_reviewed_count, 0);
    const acceptedCount = rows.reduce((total, row) => total + row.openai_accepted_count + toNumber(row.local_ai_accepted_count), 0);
    const rejectedCount = rows.reduce((total, row) => total + row.openai_rejected_count + toNumber(row.local_ai_rejected_count), 0);
    const promptTokens = rows.reduce((total, row) => total + toNumber(row.openai_prompt_tokens), 0);
    const completionTokens = rows.reduce((total, row) => total + toNumber(row.openai_completion_tokens), 0);
    const totalTokens = rows.reduce((total, row) => total + toNumber(row.openai_total_tokens), 0);
    const estimatedCostUsd = rows.reduce((total, row) => total + toNumber(row.estimated_openai_cost_usd), 0);
    const estimatedLocalAiSavingsUsd = rows.reduce((total, row) => total + toNumber(row.estimated_local_ai_savings_usd), 0);
    const openAiReviewTokens = rows.reduce((total, row) => total + getOpenAiReviewTokens(row), 0);
    const openAiTranslationTokens = rows.reduce((total, row) => total + toNumber(row.openai_translation_total_tokens), 0);
    const localAiReviewTokens = rows.reduce((total, row) => total + toNumber(row.local_ai_review_total_tokens || row.local_ai_total_tokens), 0);
    const localAiTranslationTokens = rows.reduce((total, row) => total + toNumber(row.local_ai_translation_total_tokens), 0);
    const estimatedOpenAiReviewCostUsd = rows.reduce((total, row) => total + getOpenAiReviewCost(row), 0);
    const estimatedOpenAiTranslationCostUsd = rows.reduce((total, row) => total + toNumber(row.estimated_openai_translation_cost_usd), 0);
    const costProtectionHitCount = rows.filter((row) => row.cost_protection_limit_reached).length;
    const spikeWarningCount = rows.filter((row) => row.spike_warning_triggered).length;
    const totalDurationMs = rows.reduce((total, row) => total + row.duration_ms, 0);

    return {
        runCount: rows.length,
        shardCount: shardIndexes.size,
        openAiCallCount,
        localAiCallCount,
        totalAiActivityCount: openAiCallCount + localAiCallCount,
        aiReviewedCount,
        acceptedCount,
        rejectedCount,
        acceptanceRate: aiReviewedCount === 0 ? 0 : Math.round((acceptedCount / aiReviewedCount) * 100),
        rejectionRate: aiReviewedCount === 0 ? 0 : Math.round((rejectedCount / aiReviewedCount) * 100),
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
        estimatedLocalAiSavingsUsd,
        openAiReviewCount,
        openAiTranslationCount,
        localAiReviewCount,
        localAiTranslationCount,
        openAiReviewTokens,
        openAiTranslationTokens,
        localAiReviewTokens,
        localAiTranslationTokens,
        estimatedOpenAiReviewCostUsd,
        estimatedOpenAiTranslationCostUsd,
        costProtectionHitCount,
        spikeWarningCount,
        averageDurationMs: Math.round(totalDurationMs / rows.length),
        latestRunAt: rows[0]?.run_started_at ?? null,
    };
}

function buildDailyPoints(rows: AiUsageRunRow[]): AiUsageDailyPoint[] {
    const timeZone = getAdminTimeZone();

    return getLastLocalDateKeys(7, timeZone).map((dateKey) => {
        const dateRows = rows.filter((row) => {
            if (!row.run_started_at) {
                return false;
            }

            return getLocalDateKey(row.run_started_at, timeZone) === dateKey;
        });

        const summary = summarizeRuns(dateRows);

        return {
            date: dateKey,
            runCount: summary.runCount,
            openAiCallCount: summary.openAiCallCount,
            localAiCallCount: summary.localAiCallCount,
            totalAiActivityCount: summary.totalAiActivityCount,
            aiReviewedCount: summary.aiReviewedCount,
            acceptedCount: summary.acceptedCount,
            rejectedCount: summary.rejectedCount,
            promptTokens: summary.promptTokens,
            completionTokens: summary.completionTokens,
            totalTokens: summary.totalTokens,
            estimatedCostUsd: summary.estimatedCostUsd,
            estimatedLocalAiSavingsUsd: summary.estimatedLocalAiSavingsUsd,
            openAiReviewCount: summary.openAiReviewCount,
            openAiTranslationCount: summary.openAiTranslationCount,
            localAiReviewCount: summary.localAiReviewCount,
            localAiTranslationCount: summary.localAiTranslationCount,
            openAiReviewTokens: summary.openAiReviewTokens,
            openAiTranslationTokens: summary.openAiTranslationTokens,
            localAiReviewTokens: summary.localAiReviewTokens,
            localAiTranslationTokens: summary.localAiTranslationTokens,
            estimatedOpenAiReviewCostUsd: summary.estimatedOpenAiReviewCostUsd,
            estimatedOpenAiTranslationCostUsd: summary.estimatedOpenAiTranslationCostUsd,
            costProtectionHitCount: summary.costProtectionHitCount,
            spikeWarningCount: summary.spikeWarningCount,
        };
    });
}

function buildShardPoints(rows: AiUsageRunRow[]): AiUsageShardPoint[] {
    const rowsByShard = new Map<number, AiUsageRunRow[]>();

    for (const row of rows) {
        const currentRows = rowsByShard.get(row.shard_index) ?? [];
        currentRows.push(row);
        rowsByShard.set(row.shard_index, currentRows);
    }

    return Array.from(rowsByShard.entries())
        .map(([shardIndex, shardRows]) => {
            const summary = summarizeRuns(shardRows);

            return {
                shardIndex,
                runCount: summary.runCount,
                openAiCallCount: summary.openAiCallCount,
                localAiCallCount: summary.localAiCallCount,
                totalAiActivityCount: summary.totalAiActivityCount,
                aiReviewedCount: summary.aiReviewedCount,
                acceptedCount: summary.acceptedCount,
                rejectedCount: summary.rejectedCount,
                totalTokens: summary.totalTokens,
                estimatedCostUsd: summary.estimatedCostUsd,
                estimatedLocalAiSavingsUsd: summary.estimatedLocalAiSavingsUsd,
                latestRunAt: summary.latestRunAt,
                costProtectionHitCount: summary.costProtectionHitCount,
                spikeWarningCount: summary.spikeWarningCount,
            };
        })
        .sort((a, b) => a.shardIndex - b.shardIndex);
}

function buildLatestRuns(rows: AiUsageRunRow[]): AiUsageLatestRun[] {
    return rows.slice(0, 20).map((row) => ({
        id: row.id,
        runStartedAt: row.run_started_at,
        runSource: row.run_source,
        shardIndex: row.shard_index,
        openAiModel: row.openai_model,
        openAiCallCount: toNumber(row.openai_call_count),
        localAiCallCount: toNumber(row.local_ai_call_count),
        totalAiActivityCount: toNumber(row.openai_call_count) + toNumber(row.local_ai_call_count),
        aiReviewedCount: row.ai_reviewed_count,
        acceptedCount: row.openai_accepted_count,
        rejectedCount: row.openai_rejected_count,
        totalTokens: row.openai_total_tokens,
        estimatedCostUsd: toNumber(row.estimated_openai_cost_usd),
        estimatedLocalAiSavingsUsd: toNumber(row.estimated_local_ai_savings_usd),
        openAiReviewCount: getOpenAiReviewCount(row),
        openAiTranslationCount: getOpenAiTranslationCount(row),
        localAiReviewCount: getLocalAiReviewCount(row),
        localAiTranslationCount: getLocalAiTranslationCount(row),
        costProtectionLimitReached: row.cost_protection_limit_reached,
        spikeWarningTriggered: row.spike_warning_triggered,
        durationMs: row.duration_ms,
    }));
}

async function loadUsageRunsSince(since: Date) {
    const supabase = getServerSupabase();

    const { data, error } = await supabase
        .from("ai_usage_runs")
        .select(
            [
                "id",
                "created_at",
                "run_started_at",
                "run_completed_at",
                "run_source",
                "request_id",
                "shard_index",
                "feeds_per_shard",
                "max_ai_reviews",
                "feed_count",
                "fetched_count",
                "candidate_count",
                "already_reviewed_count",
                "unreviewed_count",
                "eligible_for_ai_count",
                "ai_reviewed_count",
                "openai_model",
                "openai_call_count",
                "openai_prompt_tokens",
                "openai_completion_tokens",
                "openai_total_tokens",
                "estimated_openai_cost_usd",
                "openai_review_count",
                "openai_review_prompt_tokens",
                "openai_review_completion_tokens",
                "openai_review_total_tokens",
                "estimated_openai_review_cost_usd",
                "openai_translation_count",
                "openai_translation_prompt_tokens",
                "openai_translation_completion_tokens",
                "openai_translation_total_tokens",
                "estimated_openai_translation_cost_usd",
                "local_ai_model",
                "local_ai_call_count",
                "local_ai_prompt_tokens",
                "local_ai_completion_tokens",
                "local_ai_total_tokens",
                "local_ai_accepted_count",
                "local_ai_rejected_count",
                "local_ai_review_count",
                "local_ai_review_prompt_tokens",
                "local_ai_review_completion_tokens",
                "local_ai_review_total_tokens",
                "local_ai_translation_count",
                "local_ai_translation_prompt_tokens",
                "local_ai_translation_completion_tokens",
                "local_ai_translation_total_tokens",
                "estimated_local_ai_savings_usd",
                "openai_accepted_count",
                "openai_rejected_count",
                "published_accepted_count",
                "total_rejected_count",
                "no_thumbnail_rejected_count",
                "locally_rejected_count",
                "cost_protection_limit_reached",
                "spike_warning_triggered",
                "review_save_ok",
                "article_save_ok",
                "duration_ms",
            ].join(", "),
        )
        .gte("run_started_at", since.toISOString())
        .order("run_started_at", { ascending: false })
        .limit(MAX_RUN_ROWS_TO_LOAD);

    if (error) {
        throw new Error(error.message);
    }

    return (data ?? []) as unknown as AiUsageRunRow[];
}

export async function getAdminAiUsageDashboardData(): Promise<AiUsageDashboardData> {
    const generatedAt = new Date().toISOString();

    try {
        const rows = await loadUsageRunsSince(dateDaysAgo(30));
        const last24HourRows = filterRowsSince(rows, dateHoursAgo(24));
        const last7DayRows = filterRowsSince(rows, dateDaysAgo(7));
        const last30DayRows = filterRowsSince(rows, dateDaysAgo(30));

        return {
            isConfigured: true,
            errorMessage: null,
            generatedAt,
            last24Hours: summarizeRuns(last24HourRows),
            last7Days: summarizeRuns(last7DayRows),
            last30Days: summarizeRuns(last30DayRows),
            daily: buildDailyPoints(last7DayRows),
            shards: buildShardPoints(last7DayRows),
            latestRuns: buildLatestRuns(rows),
        };
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Unable to load AI usage dashboard data.";

        return {
            isConfigured: false,
            errorMessage: message,
            generatedAt,
            last24Hours: emptySummary(),
            last7Days: emptySummary(),
            last30Days: emptySummary(),
            daily: buildDailyPoints([]),
            shards: [],
            latestRuns: [],
        };
    }
}
