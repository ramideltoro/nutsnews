import { formatAdminDateTime } from "@/lib/adminTime";
import { getServerSupabase, getServerSupabaseConfig } from "@/lib/supabase";

const STALE_FEED_HOURS = 24;

const FEED_HEALTH_SELECT_COLUMNS = [
    "id",
    "source",
    "feed_url",
    "last_checked_at",
    "last_success_at",
    "last_failure_at",
    "last_status",
    "last_error_message",
    "last_article_count",
    "last_image_count",
    "last_accepted_count",
    "last_rejected_count",
    "consecutive_failure_count",
    "total_fetch_count",
    "total_success_count",
    "total_failure_count",
    "total_article_count",
    "total_image_count",
    "total_accepted_count",
    "total_rejected_count",
    "created_at",
    "updated_at",
].join(",");

const RSS_FEED_SELECT_COLUMNS = [
    "source",
    "url",
    "is_positive_source",
    "is_active",
].join(",");

type SupabaseConfig = {
    url: string;
    serviceRoleKey: string;
};

type FeedHealthDbRow = {
    id: number;
    source: string;
    feed_url: string;
    last_checked_at: string | null;
    last_success_at: string | null;
    last_failure_at: string | null;
    last_status: number | null;
    last_error_message: string | null;
    last_article_count: number;
    last_image_count: number;
    last_accepted_count: number;
    last_rejected_count: number;
    consecutive_failure_count: number;
    total_fetch_count: number;
    total_success_count: number;
    total_failure_count: number;
    total_article_count: number;
    total_image_count: number;
    total_accepted_count: number;
    total_rejected_count: number;
    created_at: string;
    updated_at: string;
};

type RssFeedDbRow = {
    source: string;
    url: string;
    is_positive_source: boolean | null;
    is_active: boolean | null;
};

export type FeedHealthStatus =
    | "healthy"
    | "warning"
    | "failed"
    | "stale"
    | "disabled"
    | "missing";

export type FeedHealthRow = {
    id: number | null;
    source: string;
    feedUrl: string;
    status: FeedHealthStatus;
    statusLabel: string;
    reason: string;
    isActive: boolean;
    isPositiveSource: boolean;
    lastCheckedAt: string | null;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastStatus: number | null;
    lastErrorMessage: string | null;
    lastArticleCount: number;
    lastImageCount: number;
    lastAcceptedCount: number;
    lastRejectedCount: number;
    consecutiveFailureCount: number;
    totalFetchCount: number;
    totalSuccessCount: number;
    totalFailureCount: number;
    totalArticleCount: number;
    totalImageCount: number;
    totalAcceptedCount: number;
    totalRejectedCount: number;
    successRate: number;
    imageRate: number;
    acceptanceRate: number;
    hoursSinceLastChecked: number | null;
    updatedAt: string | null;
};

export type FeedHealthSummary = {
    totalFeeds: number;
    activeFeeds: number;
    disabledFeeds: number;
    trackedFeeds: number;
    untrackedFeeds: number;
    healthyFeeds: number;
    warningFeeds: number;
    failedFeeds: number;
    staleFeeds: number;
    totalFetchCount: number;
    totalSuccessCount: number;
    totalFailureCount: number;
    totalArticleCount: number;
    totalImageCount: number;
    totalAcceptedCount: number;
    totalRejectedCount: number;
    successRate: number;
    imageRate: number;
    acceptanceRate: number;
    latestCheckedAt: string | null;
};

export type FeedHealthDashboardData = {
    isConfigured: boolean;
    errorMessage: string | null;
    generatedAt: string;
    staleAfterHours: number;
    summary: FeedHealthSummary;
    feeds: FeedHealthRow[];
    weakFeeds: FeedHealthRow[];
    bestFeeds: FeedHealthRow[];
    failedFeeds: FeedHealthRow[];
    staleFeeds: FeedHealthRow[];
    untrackedFeeds: FeedHealthRow[];
    disableWeakFeedsSql: string;
};

function getSupabaseConfig(): SupabaseConfig | null {
    try {
        return getServerSupabaseConfig();
    } catch {
        return null;
    }
}

function emptySummary(): FeedHealthSummary {
    return {
        totalFeeds: 0,
        activeFeeds: 0,
        disabledFeeds: 0,
        trackedFeeds: 0,
        untrackedFeeds: 0,
        healthyFeeds: 0,
        warningFeeds: 0,
        failedFeeds: 0,
        staleFeeds: 0,
        totalFetchCount: 0,
        totalSuccessCount: 0,
        totalFailureCount: 0,
        totalArticleCount: 0,
        totalImageCount: 0,
        totalAcceptedCount: 0,
        totalRejectedCount: 0,
        successRate: 0,
        imageRate: 0,
        acceptanceRate: 0,
        latestCheckedAt: null,
    };
}

function emptyDashboardData(
    errorMessage: string | null = null,
): FeedHealthDashboardData {
    return {
        isConfigured: !errorMessage,
        errorMessage,
        generatedAt: new Date().toISOString(),
        staleAfterHours: STALE_FEED_HOURS,
        summary: emptySummary(),
        feeds: [],
        weakFeeds: [],
        bestFeeds: [],
        failedFeeds: [],
        staleFeeds: [],
        untrackedFeeds: [],
        disableWeakFeedsSql:
            "-- Feed health data is not available yet. Run the Worker after applying the feed_health migration.",
    };
}

function safeNumber(value: number | null | undefined) {
    return Number(value ?? 0);
}

function percent(numerator: number, denominator: number) {
    if (!denominator) {
        return 0;
    }

    return Math.round((numerator / denominator) * 100);
}

function hoursSince(value: string | null) {
    if (!value) {
        return null;
    }

    const timestamp = new Date(value).getTime();

    if (Number.isNaN(timestamp)) {
        return null;
    }

    return Math.max(0, Math.round((Date.now() - timestamp) / 36_000) / 100);
}

function resolveStatus(
    row: FeedHealthRow,
): Pick<FeedHealthRow, "status" | "statusLabel" | "reason"> {
    if (!row.isActive) {
        return {
            status: "disabled",
            statusLabel: "Disabled",
            reason: "Feed is inactive in rss_feeds and will not be selected by Worker shards.",
        };
    }

    if (!row.id) {
        return {
            status: "missing",
            statusLabel: "Untracked",
            reason: "Feed is active but has not been checked by the Worker since feed health tracking was added.",
        };
    }

    if (row.consecutiveFailureCount >= 3) {
        return {
            status: "failed",
            statusLabel: "Failing",
            reason: `Feed has failed ${row.consecutiveFailureCount} times in a row.`,
        };
    }

    if (row.hoursSinceLastChecked !== null && row.hoursSinceLastChecked >= STALE_FEED_HOURS) {
        return {
            status: "stale",
            statusLabel: "Stale",
            reason: `Feed has not been checked in ${row.hoursSinceLastChecked.toFixed(1)} hours.`,
        };
    }

    if (row.totalFetchCount >= 5 && row.successRate < 70) {
        return {
            status: "warning",
            statusLabel: "Low success",
            reason: `Success rate is ${row.successRate}% across ${row.totalFetchCount} checks.`,
        };
    }

    if (row.totalArticleCount >= 20 && row.imageRate < 10) {
        return {
            status: "warning",
            statusLabel: "Low images",
            reason: `Only ${row.imageRate}% of discovered articles had usable thumbnails.`,
        };
    }

    if (row.totalFetchCount >= 5 && row.totalAcceptedCount === 0) {
        return {
            status: "warning",
            statusLabel: "No accepts",
            reason: "Feed has been checked multiple times but has not produced accepted articles yet.",
        };
    }

    return {
        status: "healthy",
        statusLabel: "Healthy",
        reason: "Feed is fetching and producing usable signals.",
    };
}

function buildFeedRow(
    feed: RssFeedDbRow,
    health: FeedHealthDbRow | undefined,
): FeedHealthRow {
    const totalFetchCount = safeNumber(health?.total_fetch_count);
    const totalSuccessCount = safeNumber(health?.total_success_count);
    const totalFailureCount = safeNumber(health?.total_failure_count);
    const totalArticleCount = safeNumber(health?.total_article_count);
    const totalImageCount = safeNumber(health?.total_image_count);
    const totalAcceptedCount = safeNumber(health?.total_accepted_count);
    const totalRejectedCount = safeNumber(health?.total_rejected_count);
    const lastCheckedAt = health?.last_checked_at ?? null;
    const row: FeedHealthRow = {
        id: health?.id ?? null,
        source: health?.source ?? feed.source,
        feedUrl: health?.feed_url ?? feed.url,
        status: "missing",
        statusLabel: "Untracked",
        reason: "Feed is active but has not been checked by the Worker since feed health tracking was added.",
        isActive: feed.is_active ?? true,
        isPositiveSource: feed.is_positive_source ?? false,
        lastCheckedAt,
        lastSuccessAt: health?.last_success_at ?? null,
        lastFailureAt: health?.last_failure_at ?? null,
        lastStatus: health?.last_status ?? null,
        lastErrorMessage: health?.last_error_message ?? null,
        lastArticleCount: safeNumber(health?.last_article_count),
        lastImageCount: safeNumber(health?.last_image_count),
        lastAcceptedCount: safeNumber(health?.last_accepted_count),
        lastRejectedCount: safeNumber(health?.last_rejected_count),
        consecutiveFailureCount: safeNumber(health?.consecutive_failure_count),
        totalFetchCount,
        totalSuccessCount,
        totalFailureCount,
        totalArticleCount,
        totalImageCount,
        totalAcceptedCount,
        totalRejectedCount,
        successRate: percent(totalSuccessCount, totalFetchCount),
        imageRate: percent(totalImageCount, totalArticleCount),
        acceptanceRate: percent(
            totalAcceptedCount,
            totalAcceptedCount + totalRejectedCount,
        ),
        hoursSinceLastChecked: hoursSince(lastCheckedAt),
        updatedAt: health?.updated_at ?? null,
    };
    const resolvedStatus = resolveStatus(row);

    return {
        ...row,
        ...resolvedStatus,
    };
}

function buildDisableWeakFeedsSql(weakFeeds: FeedHealthRow[]) {
    const urls = weakFeeds
        .filter((feed) => feed.isActive)
        .slice(0, 25)
        .map((feed) => feed.feedUrl.replace(/'/g, "''"));

    if (urls.length === 0) {
        return "-- No weak active feeds are currently recommended for disabling.";
    }

    return `update public.rss_feeds\nset is_active = false\nwhere url in (\n${urls
        .map((url) => `  '${url}'`)
        .join(",\n")}\n);`;
}

function buildSummary(feeds: FeedHealthRow[]): FeedHealthSummary {
    const latestCheckedAt = feeds
        .map((feed) => feed.lastCheckedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;
    const summary = feeds.reduce(
        (acc, feed) => {
            acc.totalFeeds += 1;
            acc.activeFeeds += feed.isActive ? 1 : 0;
            acc.disabledFeeds += feed.isActive ? 0 : 1;
            acc.trackedFeeds += feed.id ? 1 : 0;
            acc.untrackedFeeds += feed.id ? 0 : 1;
            acc.healthyFeeds += feed.status === "healthy" ? 1 : 0;
            acc.warningFeeds += feed.status === "warning" ? 1 : 0;
            acc.failedFeeds += feed.status === "failed" ? 1 : 0;
            acc.staleFeeds += feed.status === "stale" ? 1 : 0;
            acc.totalFetchCount += feed.totalFetchCount;
            acc.totalSuccessCount += feed.totalSuccessCount;
            acc.totalFailureCount += feed.totalFailureCount;
            acc.totalArticleCount += feed.totalArticleCount;
            acc.totalImageCount += feed.totalImageCount;
            acc.totalAcceptedCount += feed.totalAcceptedCount;
            acc.totalRejectedCount += feed.totalRejectedCount;

            return acc;
        },
        {
            ...emptySummary(),
            latestCheckedAt,
        },
    );

    return {
        ...summary,
        successRate: percent(summary.totalSuccessCount, summary.totalFetchCount),
        imageRate: percent(summary.totalImageCount, summary.totalArticleCount),
        acceptanceRate: percent(
            summary.totalAcceptedCount,
            summary.totalAcceptedCount + summary.totalRejectedCount,
        ),
    };
}

export async function getAdminFeedHealthDashboardData(): Promise<FeedHealthDashboardData> {
    const config = getSupabaseConfig();

    if (!config) {
        return emptyDashboardData(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for the admin feed health dashboard.",
        );
    }

    const supabase = getServerSupabase();

    const [feedsResult, healthResult] = await Promise.all([
        supabase
            .from("rss_feeds")
            .select(RSS_FEED_SELECT_COLUMNS)
            .order("id", { ascending: true }),
        supabase
            .from("feed_health")
            .select(FEED_HEALTH_SELECT_COLUMNS)
            .order("total_accepted_count", { ascending: false }),
    ]);

    if (feedsResult.error) {
        return emptyDashboardData(
            `Failed to load rss_feeds: ${feedsResult.error.message}`,
        );
    }

    if (healthResult.error) {
        return emptyDashboardData(
            `Failed to load feed_health: ${healthResult.error.message}`,
        );
    }

    const feeds = (feedsResult.data ?? []) as unknown as RssFeedDbRow[];
    const healthRows = (healthResult.data ?? []) as unknown as FeedHealthDbRow[];
    const healthByUrl = new Map(healthRows.map((row) => [row.feed_url, row]));
    const rows = feeds
        .map((feed) => buildFeedRow(feed, healthByUrl.get(feed.url)))
        .sort((a, b) => {
            const statusWeight: Record<FeedHealthStatus, number> = {
                failed: 0,
                warning: 1,
                stale: 2,
                missing: 3,
                healthy: 4,
                disabled: 5,
            };

            return (
                statusWeight[a.status] - statusWeight[b.status] ||
                b.consecutiveFailureCount - a.consecutiveFailureCount ||
                b.totalAcceptedCount - a.totalAcceptedCount ||
                a.source.localeCompare(b.source)
            );
        });
    const weakFeeds = rows
        .filter(
            (feed) =>
                feed.status === "failed" ||
                feed.status === "warning" ||
                feed.status === "stale" ||
                feed.status === "missing",
        )
        .slice(0, 30);
    const bestFeeds = [...rows]
        .filter((feed) => feed.isActive && feed.totalFetchCount > 0)
        .sort(
            (a, b) =>
                b.totalAcceptedCount - a.totalAcceptedCount ||
                b.imageRate - a.imageRate ||
                b.successRate - a.successRate ||
                a.source.localeCompare(b.source),
        )
        .slice(0, 15);

    return {
        isConfigured: true,
        errorMessage: null,
        generatedAt: new Date().toISOString(),
        staleAfterHours: STALE_FEED_HOURS,
        summary: buildSummary(rows),
        feeds: rows,
        weakFeeds,
        bestFeeds,
        failedFeeds: rows.filter((feed) => feed.status === "failed"),
        staleFeeds: rows.filter((feed) => feed.status === "stale"),
        untrackedFeeds: rows.filter((feed) => feed.status === "missing"),
        disableWeakFeedsSql: buildDisableWeakFeedsSql(weakFeeds),
    };
}

export function formatFeedDateTime(value: string | null, fallback = "Never") {
    return formatAdminDateTime(value, fallback);
}
