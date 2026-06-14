import { createClient } from "@supabase/supabase-js";

const DEFAULT_SHARD_COUNT = 25;
const DEFAULT_STALE_MINUTES = 15;
const DEFAULT_SLOW_RUN_MS = 15000;

type SupabaseConfig = {
    url: string;
    serviceRoleKey: string;
};

type ShardRunRow = {
    id: number;
    created_at: string;
    run_started_at: string;
    run_completed_at: string;
    run_source: string;
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
    estimated_openai_cost_usd: string | number;
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

export type ShardHealthStatus =
    | "healthy"
    | "warning"
    | "stale"
    | "no-feeds"
    | "missing";

export type ShardHealthRow = {
    shardIndex: number;
    status: ShardHealthStatus;
    statusLabel: string;
    reason: string;
    lastRunAt: string | null;
    lastSuccessfulRunAt: string | null;
    minutesSinceLastRun: number | null;
    runSource: string | null;
    runCount: number;
    feedCount: number;
    fetchedCount: number;
    candidateCount: number;
    acceptedCount: number;
    rejectedCount: number;
    noThumbnailRejectedCount: number;
    locallyRejectedCount: number;
    aiReviewedCount: number;
    durationMs: number;
    averageDurationMs: number;
    maxDurationMs: number;
    reviewSaveOk: boolean;
    articleSaveOk: boolean;
    costProtectionHitCount: number;
    spikeWarningCount: number;
};

export type RecentShardRun = {
    id: number;
    runStartedAt: string;
    runSource: string;
    shardIndex: number;
    status: ShardHealthStatus;
    statusLabel: string;
    feedCount: number;
    fetchedCount: number;
    acceptedCount: number;
    rejectedCount: number;
    aiReviewedCount: number;
    durationMs: number;
    reviewSaveOk: boolean;
    articleSaveOk: boolean;
};

export type ShardHealthSummary = {
    totalShards: number;
    healthyShards: number;
    warningShards: number;
    staleShards: number;
    noFeedShards: number;
    missingShards: number;
    totalRuns: number;
    totalFeeds: number;
    totalFetched: number;
    totalAccepted: number;
    totalRejected: number;
    averageDurationMs: number;
    latestRunAt: string | null;
};

export type ShardHealthDashboardData = {
    isConfigured: boolean;
    errorMessage: string | null;
    generatedAt: string;
    staleAfterMinutes: number;
    slowRunMs: number;
    summary: ShardHealthSummary;
    shards: ShardHealthRow[];
    recentRuns: RecentShardRun[];
};

function getSupabaseConfig(): SupabaseConfig | null {
    const url =
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!url || !serviceRoleKey) {
        return null;
    }

    return {
        url,
        serviceRoleKey,
    };
}

function getOptionalNumber(value: string | undefined, fallback: number) {
    if (!value) {
        return fallback;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }

    return parsed;
}

function toNumber(value: string | number | null | undefined) {
    if (value === null || value === undefined) {
        return 0;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return 0;
    }

    return parsed;
}

function minutesSince(value: string | null, now: Date) {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return Math.max(0, Math.round((now.getTime() - date.getTime()) / 60000));
}

function emptySummary(totalShards = DEFAULT_SHARD_COUNT): ShardHealthSummary {
    return {
        totalShards,
        healthyShards: 0,
        warningShards: 0,
        staleShards: 0,
        noFeedShards: 0,
        missingShards: totalShards,
        totalRuns: 0,
        totalFeeds: 0,
        totalFetched: 0,
        totalAccepted: 0,
        totalRejected: 0,
        averageDurationMs: 0,
        latestRunAt: null,
    };
}

function createMissingShard(shardIndex: number): ShardHealthRow {
    return {
        shardIndex,
        status: "missing",
        statusLabel: "Missing",
        reason: "No saved Worker run was found for this shard.",
        lastRunAt: null,
        lastSuccessfulRunAt: null,
        minutesSinceLastRun: null,
        runSource: null,
        runCount: 0,
        feedCount: 0,
        fetchedCount: 0,
        candidateCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        noThumbnailRejectedCount: 0,
        locallyRejectedCount: 0,
        aiReviewedCount: 0,
        durationMs: 0,
        averageDurationMs: 0,
        maxDurationMs: 0,
        reviewSaveOk: false,
        articleSaveOk: false,
        costProtectionHitCount: 0,
        spikeWarningCount: 0,
    };
}

function getShardStatus({
                            latestRun,
                            minutesSinceLastRun,
                            staleAfterMinutes,
                            slowRunMs,
                        }: {
    latestRun: ShardRunRow;
    minutesSinceLastRun: number | null;
    staleAfterMinutes: number;
    slowRunMs: number;
}): Pick<ShardHealthRow, "status" | "statusLabel" | "reason"> {
    if (latestRun.feed_count === 0) {
        return {
            status: "no-feeds",
            statusLabel: "No Feeds",
            reason: "The latest run found zero feeds for this shard.",
        };
    }

    if (minutesSinceLastRun !== null && minutesSinceLastRun > staleAfterMinutes) {
        return {
            status: "stale",
            statusLabel: "Stale",
            reason: `No saved run in more than ${staleAfterMinutes} minutes.`,
        };
    }

    if (!latestRun.review_save_ok || !latestRun.article_save_ok) {
        return {
            status: "warning",
            statusLabel: "Save Warning",
            reason: "The latest run had a review or article save warning.",
        };
    }

    if (latestRun.duration_ms > slowRunMs) {
        return {
            status: "warning",
            statusLabel: "Slow",
            reason: `The latest run took more than ${Math.round(
                slowRunMs / 1000,
            )} seconds.`,
        };
    }

    if (latestRun.fetched_count === 0) {
        return {
            status: "warning",
            statusLabel: "No Fetches",
            reason: "The latest run completed but fetched zero articles.",
        };
    }

    return {
        status: "healthy",
        statusLabel: "Healthy",
        reason: "Latest run is recent and completed with expected activity.",
    };
}

function buildShardRows({
                            runs,
                            shardCount,
                            staleAfterMinutes,
                            slowRunMs,
                        }: {
    runs: ShardRunRow[];
    shardCount: number;
    staleAfterMinutes: number;
    slowRunMs: number;
}) {
    const now = new Date();
    const rows: ShardHealthRow[] = [];

    for (let shardIndex = 0; shardIndex < shardCount; shardIndex += 1) {
        const shardRuns = runs
            .filter((run) => run.shard_index === shardIndex)
            .sort(
                (a, b) =>
                    new Date(b.run_started_at).getTime() -
                    new Date(a.run_started_at).getTime(),
            );

        const latestRun = shardRuns[0];

        if (!latestRun) {
            rows.push(createMissingShard(shardIndex));
            continue;
        }

        const latestRunAt = latestRun.run_started_at;
        const minutes = minutesSince(latestRunAt, now);
        const status = getShardStatus({
            latestRun,
            minutesSinceLastRun: minutes,
            staleAfterMinutes,
            slowRunMs,
        });

        const runCount = shardRuns.length;
        const totalDuration = shardRuns.reduce(
            (sum, run) => sum + run.duration_ms,
            0,
        );
        const maxDuration = shardRuns.reduce(
            (max, run) => Math.max(max, run.duration_ms),
            0,
        );
        const costProtectionHitCount = shardRuns.filter(
            (run) => run.cost_protection_limit_reached,
        ).length;
        const spikeWarningCount = shardRuns.filter(
            (run) => run.spike_warning_triggered,
        ).length;

        rows.push({
            shardIndex,
            ...status,
            lastRunAt: latestRunAt,
            lastSuccessfulRunAt: latestRunAt,
            minutesSinceLastRun: minutes,
            runSource: latestRun.run_source,
            runCount,
            feedCount: latestRun.feed_count,
            fetchedCount: latestRun.fetched_count,
            candidateCount: latestRun.candidate_count,
            acceptedCount: latestRun.published_accepted_count,
            rejectedCount: latestRun.total_rejected_count,
            noThumbnailRejectedCount: latestRun.no_thumbnail_rejected_count,
            locallyRejectedCount: latestRun.locally_rejected_count,
            aiReviewedCount: latestRun.ai_reviewed_count,
            durationMs: latestRun.duration_ms,
            averageDurationMs: runCount > 0 ? Math.round(totalDuration / runCount) : 0,
            maxDurationMs: maxDuration,
            reviewSaveOk: latestRun.review_save_ok,
            articleSaveOk: latestRun.article_save_ok,
            costProtectionHitCount,
            spikeWarningCount,
        });
    }

    return rows;
}

function buildRecentRuns({
                             runs,
                             staleAfterMinutes,
                             slowRunMs,
                         }: {
    runs: ShardRunRow[];
    staleAfterMinutes: number;
    slowRunMs: number;
}): RecentShardRun[] {
    const now = new Date();

    return runs.slice(0, 50).map((run) => {
        const status = getShardStatus({
            latestRun: run,
            minutesSinceLastRun: minutesSince(run.run_started_at, now),
            staleAfterMinutes,
            slowRunMs,
        });

        return {
            id: run.id,
            runStartedAt: run.run_started_at,
            runSource: run.run_source,
            shardIndex: run.shard_index,
            status: status.status,
            statusLabel: status.statusLabel,
            feedCount: run.feed_count,
            fetchedCount: run.fetched_count,
            acceptedCount: run.published_accepted_count,
            rejectedCount: run.total_rejected_count,
            aiReviewedCount: run.ai_reviewed_count,
            durationMs: run.duration_ms,
            reviewSaveOk: run.review_save_ok,
            articleSaveOk: run.article_save_ok,
        };
    });
}

function buildSummary({
                          shards,
                          runs,
                          shardCount,
                      }: {
    shards: ShardHealthRow[];
    runs: ShardRunRow[];
    shardCount: number;
}): ShardHealthSummary {
    const totalDuration = runs.reduce((sum, run) => sum + run.duration_ms, 0);

    return {
        totalShards: shardCount,
        healthyShards: shards.filter((shard) => shard.status === "healthy").length,
        warningShards: shards.filter((shard) => shard.status === "warning").length,
        staleShards: shards.filter((shard) => shard.status === "stale").length,
        noFeedShards: shards.filter((shard) => shard.status === "no-feeds").length,
        missingShards: shards.filter((shard) => shard.status === "missing").length,
        totalRuns: runs.length,
        totalFeeds: shards.reduce((sum, shard) => sum + shard.feedCount, 0),
        totalFetched: shards.reduce((sum, shard) => sum + shard.fetchedCount, 0),
        totalAccepted: shards.reduce((sum, shard) => sum + shard.acceptedCount, 0),
        totalRejected: shards.reduce((sum, shard) => sum + shard.rejectedCount, 0),
        averageDurationMs:
            runs.length > 0 ? Math.round(totalDuration / runs.length) : 0,
        latestRunAt: runs[0]?.run_started_at ?? null,
    };
}

async function getShardRunRows() {
    const config = getSupabaseConfig();

    if (!config) {
        throw new Error(
            "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
        );
    }

    const supabase = createClient(config.url, config.serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

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
            ].join(","),
        )
        .order("run_started_at", {
            ascending: false,
        })
        .limit(500);

    if (error) {
        throw new Error(error.message);
    }

    return (data ?? []) as unknown as ShardRunRow[];
}

export async function getAdminShardHealthDashboardData(): Promise<ShardHealthDashboardData> {
    const shardCount = getOptionalNumber(
        process.env.ADMIN_SHARD_COUNT,
        DEFAULT_SHARD_COUNT,
    );
    const staleAfterMinutes = getOptionalNumber(
        process.env.ADMIN_SHARD_STALE_MINUTES,
        DEFAULT_STALE_MINUTES,
    );
    const slowRunMs = getOptionalNumber(
        process.env.ADMIN_SHARD_SLOW_RUN_MS,
        DEFAULT_SLOW_RUN_MS,
    );

    try {
        const runs = await getShardRunRows();
        const shards = buildShardRows({
            runs,
            shardCount,
            staleAfterMinutes,
            slowRunMs,
        });
        const recentRuns = buildRecentRuns({
            runs,
            staleAfterMinutes,
            slowRunMs,
        });
        const summary = buildSummary({
            shards,
            runs,
            shardCount,
        });

        return {
            isConfigured: true,
            errorMessage: null,
            generatedAt: new Date().toISOString(),
            staleAfterMinutes,
            slowRunMs,
            summary,
            shards,
            recentRuns,
        };
    } catch (error) {
        return {
            isConfigured: false,
            errorMessage:
                error instanceof Error
                    ? error.message
                    : "Unknown shard health dashboard error.",
            generatedAt: new Date().toISOString(),
            staleAfterMinutes,
            slowRunMs,
            summary: emptySummary(shardCount),
            shards: Array.from({ length: shardCount }, (_, index) =>
                createMissingShard(index),
            ),
            recentRuns: [],
        };
    }
}