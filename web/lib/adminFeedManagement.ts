import { formatAdminDateTime } from "@/lib/adminTime";

const RSS_FEED_SELECT_COLUMNS = [
  "id",
  "source",
  "url",
  "is_positive_source",
  "is_active",
].join(",");

const FEED_HEALTH_SELECT_COLUMNS = [
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
  "updated_at",
].join(",");

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type RssFeedDbRow = {
  id: number;
  source: string;
  url: string;
  is_positive_source: boolean | string | null;
  is_active: boolean | string | null;
};

type FeedHealthDbRow = {
  source: string;
  feed_url: string;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_status: number | null;
  last_error_message: string | null;
  last_article_count: number | null;
  last_image_count: number | null;
  last_accepted_count: number | null;
  last_rejected_count: number | null;
  consecutive_failure_count: number | null;
  total_fetch_count: number | null;
  total_success_count: number | null;
  total_failure_count: number | null;
  total_article_count: number | null;
  total_image_count: number | null;
  total_accepted_count: number | null;
  total_rejected_count: number | null;
  updated_at: string | null;
};

export type FeedManagementStatus =
  | "active"
  | "inactive"
  | "failing"
  | "weak"
  | "untracked";

export type ManagedFeed = {
  id: number;
  source: string;
  url: string;
  isActive: boolean;
  isPositiveSource: boolean;
  status: FeedManagementStatus;
  statusLabel: string;
  reason: string;
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
  updatedAt: string | null;
  rawIsActiveValue: string;
  rawIsPositiveSourceValue: string;
};

export type FeedManagementSummary = {
  totalFeeds: number;
  activeFeeds: number;
  inactiveFeeds: number;
  positiveFeeds: number;
  ordinaryFeeds: number;
  trackedFeeds: number;
  untrackedFeeds: number;
  failingFeeds: number;
  weakFeeds: number;
  totalAcceptedCount: number;
  totalRejectedCount: number;
  totalArticleCount: number;
  totalImageCount: number;
  successRate: number;
  imageRate: number;
  acceptanceRate: number;
};

export type FeedManagementDashboardData = {
  isConfigured: boolean;
  errorMessage: string | null;
  generatedAt: string;
  summary: FeedManagementSummary;
  feeds: ManagedFeed[];
  activeFeeds: ManagedFeed[];
  inactiveFeeds: ManagedFeed[];
  failingFeeds: ManagedFeed[];
  untrackedFeeds: ManagedFeed[];
  recommendedDisableFeeds: ManagedFeed[];
};

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceRoleKey) {
    return null;
  }

  return {
    url,
    serviceRoleKey,
  };
}

function emptySummary(): FeedManagementSummary {
  return {
    totalFeeds: 0,
    activeFeeds: 0,
    inactiveFeeds: 0,
    positiveFeeds: 0,
    ordinaryFeeds: 0,
    trackedFeeds: 0,
    untrackedFeeds: 0,
    failingFeeds: 0,
    weakFeeds: 0,
    totalAcceptedCount: 0,
    totalRejectedCount: 0,
    totalArticleCount: 0,
    totalImageCount: 0,
    successRate: 0,
    imageRate: 0,
    acceptanceRate: 0,
  };
}

function emptyDashboardData(errorMessage: string | null = null): FeedManagementDashboardData {
  return {
    isConfigured: !errorMessage,
    errorMessage,
    generatedAt: new Date().toISOString(),
    summary: emptySummary(),
    feeds: [],
    activeFeeds: [],
    inactiveFeeds: [],
    failingFeeds: [],
    untrackedFeeds: [],
    recommendedDisableFeeds: [],
  };
}

function safeNumber(value: number | null | undefined) {
  return Number(value ?? 0);
}

function safeBoolean(value: boolean | string | null | undefined, defaultValue = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return defaultValue;
}

function getRawBooleanValue(value: boolean | string | null | undefined) {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "string") {
    return value;
  }

  return "null";
}

function percent(numerator: number, denominator: number) {
  if (!denominator) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
}

function resolveStatus(feed: ManagedFeed): Pick<ManagedFeed, "status" | "statusLabel" | "reason"> {
  if (!feed.isActive) {
    return {
      status: "inactive",
      statusLabel: "Inactive",
      reason: "Feed is disabled and will not be selected by Worker shards.",
    };
  }

  if (!feed.lastCheckedAt) {
    return {
      status: "untracked",
      statusLabel: "Untracked",
      reason: "Feed is active but has not been checked since feed health tracking was enabled.",
    };
  }

  if (feed.consecutiveFailureCount >= 3) {
    return {
      status: "failing",
      statusLabel: "Failing",
      reason: `Feed failed ${feed.consecutiveFailureCount} checks in a row.`,
    };
  }

  if (feed.totalFetchCount >= 5 && feed.successRate < 70) {
    return {
      status: "weak",
      statusLabel: "Low success",
      reason: `Feed success rate is ${feed.successRate}% across ${feed.totalFetchCount} checks.`,
    };
  }

  if (feed.totalArticleCount >= 20 && feed.imageRate < 10) {
    return {
      status: "weak",
      statusLabel: "Low images",
      reason: `Only ${feed.imageRate}% of discovered articles had usable thumbnails.`,
    };
  }

  return {
    status: "active",
    statusLabel: "Active",
    reason: "Feed is active and available to Worker shards.",
  };
}

function buildManagedFeed(feed: RssFeedDbRow, health: FeedHealthDbRow | undefined): ManagedFeed {
  const totalFetchCount = safeNumber(health?.total_fetch_count);
  const totalSuccessCount = safeNumber(health?.total_success_count);
  const totalFailureCount = safeNumber(health?.total_failure_count);
  const totalArticleCount = safeNumber(health?.total_article_count);
  const totalImageCount = safeNumber(health?.total_image_count);
  const totalAcceptedCount = safeNumber(health?.total_accepted_count);
  const totalRejectedCount = safeNumber(health?.total_rejected_count);
  const baseFeed: ManagedFeed = {
    id: feed.id,
    source: feed.source,
    url: feed.url,
    isActive: safeBoolean(feed.is_active, true),
    isPositiveSource: safeBoolean(feed.is_positive_source, false),
    status: "untracked",
    statusLabel: "Untracked",
    reason: "Feed is active but has not been checked since feed health tracking was enabled.",
    lastCheckedAt: health?.last_checked_at ?? null,
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
    acceptanceRate: percent(totalAcceptedCount, totalAcceptedCount + totalRejectedCount),
    updatedAt: health?.updated_at ?? null,
    rawIsActiveValue: getRawBooleanValue(feed.is_active),
    rawIsPositiveSourceValue: getRawBooleanValue(feed.is_positive_source),
  };
  const status = resolveStatus(baseFeed);

  return {
    ...baseFeed,
    ...status,
  };
}

function buildSummary(feeds: ManagedFeed[]): FeedManagementSummary {
  const summary = feeds.reduce((acc, feed) => {
    acc.totalFeeds += 1;
    acc.activeFeeds += feed.isActive ? 1 : 0;
    acc.inactiveFeeds += feed.isActive ? 0 : 1;
    acc.positiveFeeds += feed.isPositiveSource ? 1 : 0;
    acc.ordinaryFeeds += feed.isPositiveSource ? 0 : 1;
    acc.trackedFeeds += feed.lastCheckedAt ? 1 : 0;
    acc.untrackedFeeds += feed.lastCheckedAt ? 0 : 1;
    acc.failingFeeds += feed.status === "failing" ? 1 : 0;
    acc.weakFeeds += feed.status === "weak" ? 1 : 0;
    acc.totalAcceptedCount += feed.totalAcceptedCount;
    acc.totalRejectedCount += feed.totalRejectedCount;
    acc.totalArticleCount += feed.totalArticleCount;
    acc.totalImageCount += feed.totalImageCount;
    acc.successRate = 0;
    acc.imageRate = 0;
    acc.acceptanceRate = 0;

    return acc;
  }, emptySummary());
  const totalFetchCount = feeds.reduce((sum, feed) => sum + feed.totalFetchCount, 0);
  const totalSuccessCount = feeds.reduce((sum, feed) => sum + feed.totalSuccessCount, 0);

  return {
    ...summary,
    successRate: percent(totalSuccessCount, totalFetchCount),
    imageRate: percent(summary.totalImageCount, summary.totalArticleCount),
    acceptanceRate: percent(
      summary.totalAcceptedCount,
      summary.totalAcceptedCount + summary.totalRejectedCount,
    ),
  };
}

async function fetchSupabaseRows<T>(
  config: SupabaseConfig,
  pathAndQuery: string,
): Promise<{ data: T[]; errorMessage: string | null }> {
  const response = await fetch(`${config.url}${pathAndQuery}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    return {
      data: [],
      errorMessage: errorText || `Supabase returned ${response.status}`,
    };
  }

  return {
    data: (await response.json()) as T[],
    errorMessage: null,
  };
}

export async function getAdminFeedManagementDashboardData(): Promise<FeedManagementDashboardData> {
  const config = getSupabaseConfig();

  if (!config) {
    return emptyDashboardData(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for the admin feed management dashboard.",
    );
  }

  const [feedsResult, healthResult] = await Promise.all([
    fetchSupabaseRows<RssFeedDbRow>(
      config,
      `/rest/v1/rss_feeds?select=${RSS_FEED_SELECT_COLUMNS}&order=id.asc`,
    ),
    fetchSupabaseRows<FeedHealthDbRow>(
      config,
      `/rest/v1/feed_health?select=${FEED_HEALTH_SELECT_COLUMNS}&order=total_accepted_count.desc`,
    ),
  ]);

  if (feedsResult.errorMessage) {
    return emptyDashboardData(`Failed to load rss_feeds: ${feedsResult.errorMessage}`);
  }

  if (healthResult.errorMessage) {
    return emptyDashboardData(`Failed to load feed_health: ${healthResult.errorMessage}`);
  }

  const feeds = feedsResult.data;
  const healthRows = healthResult.data;
  const healthByUrl = new Map(healthRows.map((row) => [row.feed_url, row]));
  const managedFeeds = feeds
    .map((feed) => buildManagedFeed(feed, healthByUrl.get(feed.url)))
    .sort((a, b) => {
      const statusWeight: Record<FeedManagementStatus, number> = {
        failing: 0,
        weak: 1,
        untracked: 2,
        active: 3,
        inactive: 4,
      };

      return (
        statusWeight[a.status] - statusWeight[b.status] ||
        Number(b.isActive) - Number(a.isActive) ||
        b.consecutiveFailureCount - a.consecutiveFailureCount ||
        b.totalAcceptedCount - a.totalAcceptedCount ||
        a.source.localeCompare(b.source)
      );
    });

  return {
    isConfigured: true,
    errorMessage: null,
    generatedAt: new Date().toISOString(),
    summary: buildSummary(managedFeeds),
    feeds: managedFeeds,
    activeFeeds: managedFeeds.filter((feed) => feed.isActive),
    inactiveFeeds: managedFeeds.filter((feed) => !feed.isActive),
    failingFeeds: managedFeeds.filter((feed) => feed.status === "failing"),
    untrackedFeeds: managedFeeds.filter((feed) => feed.status === "untracked"),
    recommendedDisableFeeds: managedFeeds
      .filter((feed) => feed.isActive && (feed.status === "failing" || feed.status === "weak"))
      .slice(0, 20),
  };
}

export async function setAdminRssFeedActiveStatus({
  feedUrl,
  isActive,
}: {
  feedUrl: string;
  isActive: boolean;
}) {
  const config = getSupabaseConfig();

  if (!config) {
    return {
      ok: false,
      message: "Missing Supabase admin configuration.",
    };
  }

  const response = await fetch(
    `${config.url}/rest/v1/rss_feeds?url=eq.${encodeURIComponent(feedUrl)}`,
    {
      method: "PATCH",
      cache: "no-store",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        is_active: isActive,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    return {
      ok: false,
      message: errorText || `Supabase returned ${response.status}`,
    };
  }

  return {
    ok: true,
    message: isActive ? "Feed enabled." : "Feed disabled.",
  };
}

export function formatFeedManagementDateTime(value: string | null, fallback = "Never") {
  return formatAdminDateTime(value, fallback);
}
