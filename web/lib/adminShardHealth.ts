import { createClient } from "@supabase/supabase-js";

const DEFAULT_SHARD_COUNT = 25;
const DEFAULT_STALE_MINUTES = 180;
const DEFAULT_SLOW_RUN_MS = 15000;
const DAILY_WINDOW_DAYS = 7;

const WORKER_RUN_SELECT_COLUMNS = [
    "id",
    "created_at",
    "run_started_at",
    "run_completed_at",
    "run_source",
    "request_id",
    "shard_index",
    "feeds_per_shard",
    "max_ai_reviews",
    "success",
    "error_name",
    "error_message",
    "feed_count",
    "fetched_count",
    "candidate_count",
    "already_reviewed_count",
    "unreviewed_count",
    "eligible_for_ai_count",
    "ai_reviewed_count",
    "accepted_count",
    "rejected_count",
    "no_thumbnail_rejected_count",
    "locally_rejected_count",
    "image_hydration_lookup_count",
    "image_hydration_found_count",
    "review_save_ok",
    "article_save_ok",
    "ai_usage_save_ok",
    "cost_protection_limit_reached",
    "spike_warning_triggered",
    "duration_ms",
].join(",");

type SupabaseConfig = {
    url: string;
    serviceRoleKey: string;
};

type WorkerRunRow = {
    id: number;
    created_at: string;
    run_started_at: string;
    run_completed_at: string;
    run_source: "manual" | "scheduled" | "unknown";
    request_id: string | null;
    shard_index: number;
    feeds_per_shard: number;
    max_ai_reviews: number;
    success: boolean;
    error_name: string | null;
    error_message: string | null;
    feed_count: number;
    fetched_count: number;
    candidate_count: number;
    already_reviewed_count: number;
    unreviewed_count: number;
    eligible_for_ai_count: number;
    ai_reviewed_count: number;
    accepted_count: number;
    rejected_count: number;
    no_thumbnail_rejected_count: number;
    locally_rejected_count: number;
    image_hydration_lookup_count: number;
    image_hydration_found_count: number;
    review_save_ok: boolean;
    article_save_ok: boolean;
    ai_usage_save_ok: boolean;
    cost_protection_limit_reached: boolean;
    spike_warning_triggered: boolean;
    duration_ms: number;
};

export type ShardHealthStatus =
    | "healthy"
    | "warning"
    | "failed"
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
    successCount: number;
    failureCount: number;
    consecutiveFailureCount: number;
    latestErrorName: string | null;
    latestErrorMessage: string | null;
    feedCount: number;
    fetchedCount: number;
    candidateCount: number;
    acceptedCount: number;
    rejectedCount: number;
    noThumbnailRejectedCount: number;
    locallyRejectedCount: number;
    imageHydrationLookupCount: number;
    imageHydrationFoundCount: number;
    imageHydrationRate: number;
    aiReviewedCount: number;
    durationMs: number;
    averageDurationMs: number;
    maxDurationMs: number;
    reviewSaveOk: boolean;
    articleSaveOk: boolean;
    aiUsageSaveOk: boolean;
    costProtectionHitCount: number;
    spikeWarningCount: number;
};

export type RecentShardRun = {
    id: number;
    runStartedAt: string;
    runSource: string;
    shardIndex: number;
    success: boolean;
    status: ShardHealthStatus;
    statusLabel: string;
    errorName: string | null;
    errorMessage: string | null;
    feedCount: number;
    fetchedCount: number;
    candidateCount: number;
    acceptedCount: number;
    rejectedCount: number;
    noThumbnailRejectedCount: number;
    imageHydrationLookupCount: number;
    imageHydrationFoundCount: number;
    imageHydrationRate: number;
    aiReviewedCount: number;
    durationMs: number;
    reviewSaveOk: boolean;
    articleSaveOk: boolean;
    aiUsageSaveOk: boolean;
};

export type WorkerHealthDailyPoint = {
    date: string;
    runCount: number;
    successCount: number;
    failureCount: number;
    fetchedCount: number;
    candidateCount: number;
    acceptedCount: number;
    rejectedCount: number;
    noThumbnailRejectedCount: number;
    imageHydrationLookupCount: number;
    imageHydrationFoundCount: number;
    imageHydrationRate: number;
    aiReviewedCount: number;
    averageDurationMs: number;
};

export type ShardHealthSummary = {
    totalShards: number;
    healthyShards: number;
    warningShards: number;
    failedShards: number;
    staleShards: number;
    noFeedShards: number;
    missingShards: number;
    totalRuns: number;
    totalSuccessfulRuns: number;
    totalFailedRuns: number;
    totalConsecutiveFailures: number;
    totalFeeds: number;
    totalFetched: number;
    totalCandidates: number;
    totalAccepted: number;
    totalRejected: number;
    totalNoThumbnailRejected: number;
    totalImageHydrationLookups: number;
    totalImageHydrationFound: number;
    imageHydrationRate: number;
    totalAiReviewed: number;
    acceptanceRate: number;
    averageDurationMs: number;
    latestRunAt: string | null;
    latestFailureAt: string | null;
};

export type ShardHealthDashboardData = {
    isConfigured: boolean;
    errorMessage: string | null;
    generatedAt: string;
    staleAfterMinutes: number;
    slowRunMs: number;
    summary: ShardHealthSummary;
    shards: ShardHealthRow[];
    slowestShards: ShardHealthRow[];
    problemShards: ShardHealthRow[];
    failedShards: ShardHealthRow[];
    daily: WorkerHealthDailyPoint[];
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

function getRate(part: number, total: number) {
    if (total <= 0) {
        return 0;
    }

    return Math.round((part / total) * 100);
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

function getDateKey(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "unknown";
    }

    return date.toISOString().slice(0, 10);
}

function getDailyWindowKeys(days: number) {
    const keys: string[] = [];
    const today = new Date();

    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const date = new Date(today);
        date.setUTCDate(today.getUTCDate() - offset);
        keys.push(date.toISOString().slice(0, 10));
    }

    return keys;
}

function getConsecutiveFailureCount(runs: WorkerRunRow[]) {
    let count = 0;

    for (const run of runs) {
        if (run.success) {
            break;
        }

        count += 1;
    }

    return count;
}

function getLatestSuccessfulRunAt(runs: WorkerRunRow[]) {
    return runs.find((run) => run.success)?.run_started_at ?? null;
}

function emptySummary(totalShards = DEFAULT_SHARD_COUNT): ShardHealthSummary {
    return {
        totalShards,
        healthyShards: 0,
        warningShards: 0,
        failedShards: 0,
        staleShards: 0,
        noFeedShards: 0,
        missingShards: totalShards,
        totalRuns: 0,
        totalSuccessfulRuns: 0,
        totalFailedRuns: 0,
        totalConsecutiveFailures: 0,
        totalFeeds: 0,
        totalFetched: 0,
        totalCandidates: 0,
        totalAccepted: 0,
        totalRejected: 0,
        totalNoThumbnailRejected: 0,
        totalImageHydrationLookups: 0,
        totalImageHydrationFound: 0,
        imageHydrationRate: 0,
        totalAiReviewed: 0,
        acceptanceRate: 0,
        averageDurationMs: 0,
        latestRunAt: null,
        latestFailureAt: null,
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
        successCount: 0,
        failureCount: 0,
        consecutiveFailureCount: 0,
        latestErrorName: null,
        latestErrorMessage: null,
        feedCount: 0,
        fetchedCount: 0,
        candidateCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        noThumbnailRejectedCount: 0,
        locallyRejectedCount: 0,
        imageHydrationLookupCount: 0,
        imageHydrationFoundCount: 0,
        imageHydrationRate: 0,
        aiReviewedCount: 0,
        durationMs: 0,
        averageDurationMs: 0,
        maxDurationMs: 0,
        reviewSaveOk: false,
        articleSaveOk: false,
        aiUsageSaveOk: false,
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
    latestRun: WorkerRunRow;
    minutesSinceLastRun: number | null;
    staleAfterMinutes: number;
    slowRunMs: number;
}): Pick<ShardHealthRow, "status" | "statusLabel" | "reason"> {
    if (!latestRun.success) {
        return {
            status: "failed",
            statusLabel: "Failed",
            reason:
                latestRun.error_message ||
                latestRun.error_name ||
                "The latest saved Worker run failed.",
        };
    }

    if (latestRun.feed_count === 0) {
        return {
            status: "no-feeds",
            statusLabel: "No Feeds",
            reason: "The latest successful run found zero feeds for this shard.",
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
            reason: "The latest successful run had a review or article save warning.",
        };
    }

    if (!latestRun.ai_usage_save_ok) {
        return {
            status: "warning",
            statusLabel: "Usage Save Warning",
            reason: "The latest successful run did not save AI usage telemetry cleanly.",
        };
    }

    if (latestRun.duration_ms > slowRunMs) {
        return {
            status: "warning",
            statusLabel: "Slow",
            reason: `The latest successful run took more than ${Math.round(
                slowRunMs / 1000,
            )} seconds.`,
        };
    }

    if (latestRun.fetched_count === 0) {
        return {
            status: "warning",
            statusLabel: "No Fetches",
            reason: "The latest successful run completed but fetched zero articles.",
        };
    }

    if (
        latestRun.image_hydration_lookup_count > 0 &&
        latestRun.image_hydration_found_count === 0
    ) {
        return {
            status: "warning",
            statusLabel: "No Images Found",
            reason: "The latest successful run tried image hydration but found zero images.",
        };
    }

    return {
        status: "healthy",
        statusLabel: "Healthy",
        reason: "Latest saved run is recent and completed with expected activity.",
    };
}

function buildShardRows({
                            runs,
                            shardCount,
                            staleAfterMinutes,
                            slowRunMs,
                        }: {
    runs: WorkerRunRow[];
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
        const successCount = shardRuns.filter((run) => run.success).length;
        const failureCount = shardRuns.filter((run) => !run.success).length;
        const consecutiveFailureCount = getConsecutiveFailureCount(shardRuns);
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
            lastSuccessfulRunAt: getLatestSuccessfulRunAt(shardRuns),
            minutesSinceLastRun: minutes,
            runSource: latestRun.run_source,
            runCount,
            successCount,
            failureCount,
            consecutiveFailureCount,
            latestErrorName: latestRun.success ? null : latestRun.error_name,
            latestErrorMessage: latestRun.success ? null : latestRun.error_message,
            feedCount: latestRun.feed_count,
            fetchedCount: latestRun.fetched_count,
            candidateCount: latestRun.candidate_count,
            acceptedCount: latestRun.accepted_count,
            rejectedCount: latestRun.rejected_count,
            noThumbnailRejectedCount: latestRun.no_thumbnail_rejected_count,
            locallyRejectedCount: latestRun.locally_rejected_count,
            imageHydrationLookupCount: latestRun.image_hydration_lookup_count,
            imageHydrationFoundCount: latestRun.image_hydration_found_count,
            imageHydrationRate: getRate(
                latestRun.image_hydration_found_count,
                latestRun.image_hydration_lookup_count,
            ),
            aiReviewedCount: latestRun.ai_reviewed_count,
            durationMs: latestRun.duration_ms,
            averageDurationMs: runCount > 0 ? Math.round(totalDuration / runCount) : 0,
            maxDurationMs: maxDuration,
            reviewSaveOk: latestRun.review_save_ok,
            articleSaveOk: latestRun.article_save_ok,
            aiUsageSaveOk: latestRun.ai_usage_save_ok,
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
    runs: WorkerRunRow[];
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
            success: run.success,
            status: status.status,
            statusLabel: status.statusLabel,
            errorName: run.error_name,
            errorMessage: run.error_message,
            feedCount: run.feed_count,
            fetchedCount: run.fetched_count,
            candidateCount: run.candidate_count,
            acceptedCount: run.accepted_count,
            rejectedCount: run.rejected_count,
            noThumbnailRejectedCount: run.no_thumbnail_rejected_count,
            imageHydrationLookupCount: run.image_hydration_lookup_count,
            imageHydrationFoundCount: run.image_hydration_found_count,
            imageHydrationRate: getRate(
                run.image_hydration_found_count,
                run.image_hydration_lookup_count,
            ),
            aiReviewedCount: run.ai_reviewed_count,
            durationMs: run.duration_ms,
            reviewSaveOk: run.review_save_ok,
            articleSaveOk: run.article_save_ok,
            aiUsageSaveOk: run.ai_usage_save_ok,
        };
    });
}

function buildDailyPoints(runs: WorkerRunRow[]): WorkerHealthDailyPoint[] {
    const keys = getDailyWindowKeys(DAILY_WINDOW_DAYS);

    return keys.map((key) => {
        const dayRuns = runs.filter((run) => getDateKey(run.run_started_at) === key);
        const totalDuration = dayRuns.reduce(
            (sum, run) => sum + run.duration_ms,
            0,
        );
        const imageHydrationLookupCount = dayRuns.reduce(
            (sum, run) => sum + run.image_hydration_lookup_count,
            0,
        );
        const imageHydrationFoundCount = dayRuns.reduce(
            (sum, run) => sum + run.image_hydration_found_count,
            0,
        );

        return {
            date: key,
            runCount: dayRuns.length,
            successCount: dayRuns.filter((run) => run.success).length,
            failureCount: dayRuns.filter((run) => !run.success).length,
            fetchedCount: dayRuns.reduce((sum, run) => sum + run.fetched_count, 0),
            candidateCount: dayRuns.reduce(
                (sum, run) => sum + run.candidate_count,
                0,
            ),
            acceptedCount: dayRuns.reduce((sum, run) => sum + run.accepted_count, 0),
            rejectedCount: dayRuns.reduce((sum, run) => sum + run.rejected_count, 0),
            noThumbnailRejectedCount: dayRuns.reduce(
                (sum, run) => sum + run.no_thumbnail_rejected_count,
                0,
            ),
            imageHydrationLookupCount,
            imageHydrationFoundCount,
            imageHydrationRate: getRate(
                imageHydrationFoundCount,
                imageHydrationLookupCount,
            ),
            aiReviewedCount: dayRuns.reduce(
                (sum, run) => sum + run.ai_reviewed_count,
                0,
            ),
            averageDurationMs:
                dayRuns.length > 0 ? Math.round(totalDuration / dayRuns.length) : 0,
        };
    });
}

function buildSummary({
                          shards,
                          runs,
                          shardCount,
                      }: {
    shards: ShardHealthRow[];
    runs: WorkerRunRow[];
    shardCount: number;
}): ShardHealthSummary {
    const totalDuration = runs.reduce((sum, run) => sum + run.duration_ms, 0);
    const totalAccepted = shards.reduce(
        (sum, shard) => sum + shard.acceptedCount,
        0,
    );
    const totalRejected = shards.reduce(
        (sum, shard) => sum + shard.rejectedCount,
        0,
    );
    const totalImageHydrationLookups = shards.reduce(
        (sum, shard) => sum + shard.imageHydrationLookupCount,
        0,
    );
    const totalImageHydrationFound = shards.reduce(
        (sum, shard) => sum + shard.imageHydrationFoundCount,
        0,
    );

    return {
        totalShards: shardCount,
        healthyShards: shards.filter((shard) => shard.status === "healthy").length,
        warningShards: shards.filter((shard) => shard.status === "warning").length,
        failedShards: shards.filter((shard) => shard.status === "failed").length,
        staleShards: shards.filter((shard) => shard.status === "stale").length,
        noFeedShards: shards.filter((shard) => shard.status === "no-feeds").length,
        missingShards: shards.filter((shard) => shard.status === "missing").length,
        totalRuns: runs.length,
        totalSuccessfulRuns: runs.filter((run) => run.success).length,
        totalFailedRuns: runs.filter((run) => !run.success).length,
        totalConsecutiveFailures: shards.reduce(
            (sum, shard) => sum + shard.consecutiveFailureCount,
            0,
        ),
        totalFeeds: shards.reduce((sum, shard) => sum + shard.feedCount, 0),
        totalFetched: shards.reduce((sum, shard) => sum + shard.fetchedCount, 0),
        totalCandidates: shards.reduce(
            (sum, shard) => sum + shard.candidateCount,
            0,
        ),
        totalAccepted,
        totalRejected,
        totalNoThumbnailRejected: shards.reduce(
            (sum, shard) => sum + shard.noThumbnailRejectedCount,
            0,
        ),
        totalImageHydrationLookups,
        totalImageHydrationFound,
        imageHydrationRate: getRate(
            totalImageHydrationFound,
            totalImageHydrationLookups,
        ),
        totalAiReviewed: shards.reduce(
            (sum, shard) => sum + shard.aiReviewedCount,
            0,
        ),
        acceptanceRate: getRate(totalAccepted, totalAccepted + totalRejected),
        averageDurationMs:
            runs.length > 0 ? Math.round(totalDuration / runs.length) : 0,
        latestRunAt: runs[0]?.run_started_at ?? null,
        latestFailureAt:
            runs.find((run) => !run.success)?.run_started_at ?? null,
    };
}

async function getWorkerRunRows() {
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
        .from("worker_runs")
        .select(WORKER_RUN_SELECT_COLUMNS)
        .order("run_started_at", {
            ascending: false,
        })
        .limit(500);

    if (error) {
        throw new Error(error.message);
    }

    return (data ?? []) as unknown as WorkerRunRow[];
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
        const runs = await getWorkerRunRows();
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
        const daily = buildDailyPoints(runs);
        const summary = buildSummary({
            shards,
            runs,
            shardCount,
        });
        const problemShards = shards.filter((shard) => shard.status !== "healthy");
        const failedShards = shards.filter((shard) => shard.status === "failed");
        const slowestShards = [...shards]
            .filter((shard) => shard.runCount > 0)
            .sort((a, b) => b.durationMs - a.durationMs)
            .slice(0, 8);

        return {
            isConfigured: true,
            errorMessage: null,
            generatedAt: new Date().toISOString(),
            staleAfterMinutes,
            slowRunMs,
            summary,
            shards,
            slowestShards,
            problemShards,
            failedShards,
            daily,
            recentRuns,
        };
    } catch (error) {
        const shards = Array.from({ length: shardCount }, (_, index) =>
            createMissingShard(index),
        );

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
            shards,
            slowestShards: [],
            problemShards: shards,
            failedShards: [],
            daily: buildDailyPoints([]),
            recentRuns: [],
        };
    }
}
