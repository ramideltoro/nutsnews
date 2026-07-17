import { formatAdminDateTime } from "@/lib/adminTime";
import { ExternalUrlSafetyError, assertPublicHttpUrl } from "@/lib/externalUrlSafety";
import { getServerSupabaseConfig } from "@/lib/supabase";
import { RuntimeSafetyError, assertDataMutation } from "@/lib/runtimeSafety";

const FEED_QUALITY_SELECT_COLUMNS = [
  "feed_id",
  "source",
  "feed_url",
  "is_active",
  "is_positive_source",
  "source_trust_tier",
  "publisher_allowlist_status",
  "recommended_trust_tier",
  "tier_recommendation_reason",
  "feed_health_id",
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
  "unique_reviewed_url_count",
  "unique_published_url_count",
  "success_rate_pct",
  "thumbnail_rate_pct",
  "accepted_rate_pct",
  "failure_rate_pct",
  "duplicate_rate_pct",
  "quality_score",
  "quality_grade",
  "quality_reason",
  "updated_at",
].join(",");

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type NumericValue = number | string | null;

type FeedQualityDbRow = {
  feed_id: number;
  source: string;
  feed_url: string;
  is_active: boolean | string | null;
  is_positive_source: boolean | string | null;
  source_trust_tier: string | null;
  publisher_allowlist_status: string | null;
  recommended_trust_tier: string | null;
  tier_recommendation_reason: string | null;
  feed_health_id: number | null;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_status: number | null;
  last_error_message: string | null;
  last_article_count: NumericValue;
  last_image_count: NumericValue;
  last_accepted_count: NumericValue;
  last_rejected_count: NumericValue;
  consecutive_failure_count: NumericValue;
  total_fetch_count: NumericValue;
  total_success_count: NumericValue;
  total_failure_count: NumericValue;
  total_article_count: NumericValue;
  total_image_count: NumericValue;
  total_accepted_count: NumericValue;
  total_rejected_count: NumericValue;
  unique_reviewed_url_count: NumericValue;
  unique_published_url_count: NumericValue;
  success_rate_pct: NumericValue;
  thumbnail_rate_pct: NumericValue;
  accepted_rate_pct: NumericValue;
  failure_rate_pct: NumericValue;
  duplicate_rate_pct: NumericValue;
  quality_score: NumericValue;
  quality_grade: string | null;
  quality_reason: string | null;
  updated_at: string | null;
};

export type FeedManagementStatus =
  | "active"
  | "inactive"
  | "failing"
  | "weak"
  | "untracked";

export type FeedQualityGrade =
  | "excellent"
  | "good"
  | "review"
  | "poor"
  | "untracked"
  | "inactive";

export type SourceTrustTier =
  | "trusted"
  | "watchlist"
  | "experimental"
  | "disabled";

export type PublisherAllowlistStatus =
  | "allowlisted"
  | "candidate"
  | "blocked";

export type ManagedFeed = {
  id: number;
  source: string;
  url: string;
  isActive: boolean;
  isPositiveSource: boolean;
  sourceTrustTier: SourceTrustTier;
  sourceTrustTierLabel: string;
  publisherAllowlistStatus: PublisherAllowlistStatus;
  publisherAllowlistLabel: string;
  recommendedTrustTier: SourceTrustTier;
  recommendedTrustTierLabel: string;
  tierRecommendationReason: string;
  tierRecommendationMatches: boolean;
  status: FeedManagementStatus;
  statusLabel: string;
  reason: string;
  qualityScore: number;
  qualityGrade: FeedQualityGrade;
  qualityLabel: string;
  qualityReason: string;
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
  uniqueReviewedUrlCount: number;
  uniquePublishedUrlCount: number;
  successRate: number;
  imageRate: number;
  acceptanceRate: number;
  failureRate: number;
  duplicateRate: number;
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
  trustedFeeds: number;
  watchlistFeeds: number;
  experimentalFeeds: number;
  disabledTierFeeds: number;
  allowlistedPublishers: number;
  candidatePublishers: number;
  blockedPublishers: number;
  tierRecommendationMismatches: number;
  trackedFeeds: number;
  untrackedFeeds: number;
  failingFeeds: number;
  weakFeeds: number;
  excellentFeeds: number;
  goodFeeds: number;
  reviewFeeds: number;
  poorFeeds: number;
  untrackedQualityFeeds: number;
  inactiveQualityFeeds: number;
  totalAcceptedCount: number;
  totalRejectedCount: number;
  totalArticleCount: number;
  totalImageCount: number;
  successRate: number;
  imageRate: number;
  acceptanceRate: number;
  failureRate: number;
  duplicateRate: number;
  averageQualityScore: number;
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
  lowQualityFeeds: ManagedFeed[];
  bestQualityFeeds: ManagedFeed[];
  recommendedDisableFeeds: ManagedFeed[];
  rankingSql: string;
};

type FeedToggleRpcRow = {
  feed_id: number;
  feed_source: string;
  feed_url: string;
  previous_is_active: boolean | string | null;
  next_is_active: boolean | string | null;
  audit_event_id: string;
};

type FeedTrustTierRpcRow = {
  feed_id: number;
  feed_source: string;
  feed_url: string;
  previous_source_trust_tier: string;
  next_source_trust_tier: string;
  previous_publisher_allowlist_status: string;
  next_publisher_allowlist_status: string;
  previous_is_active: boolean | string | null;
  next_is_active: boolean | string | null;
  audit_event_id: string;
};

function getSupabaseConfig(): SupabaseConfig | null {
  try {
    return getServerSupabaseConfig();
  } catch {
    return null;
  }
}

function emptySummary(): FeedManagementSummary {
  return {
    totalFeeds: 0,
    activeFeeds: 0,
    inactiveFeeds: 0,
    positiveFeeds: 0,
    ordinaryFeeds: 0,
    trustedFeeds: 0,
    watchlistFeeds: 0,
    experimentalFeeds: 0,
    disabledTierFeeds: 0,
    allowlistedPublishers: 0,
    candidatePublishers: 0,
    blockedPublishers: 0,
    tierRecommendationMismatches: 0,
    trackedFeeds: 0,
    untrackedFeeds: 0,
    failingFeeds: 0,
    weakFeeds: 0,
    excellentFeeds: 0,
    goodFeeds: 0,
    reviewFeeds: 0,
    poorFeeds: 0,
    untrackedQualityFeeds: 0,
    inactiveQualityFeeds: 0,
    totalAcceptedCount: 0,
    totalRejectedCount: 0,
    totalArticleCount: 0,
    totalImageCount: 0,
    successRate: 0,
    imageRate: 0,
    acceptanceRate: 0,
    failureRate: 0,
    duplicateRate: 0,
    averageQualityScore: 0,
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
    lowQualityFeeds: [],
    bestQualityFeeds: [],
    recommendedDisableFeeds: [],
    rankingSql: buildRankingSql(),
  };
}

function safeNumber(value: NumericValue | undefined) {
  const numberValue = Number(value ?? 0);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return numberValue;
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

function normalizeQualityGrade(value: string | null | undefined): FeedQualityGrade {
  if (
    value === "excellent" ||
    value === "good" ||
    value === "review" ||
    value === "poor" ||
    value === "untracked" ||
    value === "inactive"
  ) {
    return value;
  }

  return "untracked";
}

function getQualityLabel(grade: FeedQualityGrade) {
  if (grade === "excellent") {
    return "Excellent";
  }

  if (grade === "good") {
    return "Good";
  }

  if (grade === "review") {
    return "Review";
  }

  if (grade === "poor") {
    return "Poor";
  }

  if (grade === "inactive") {
    return "Inactive";
  }

  return "Untracked";
}

function normalizeSourceTrustTier(value: string | null | undefined): SourceTrustTier {
  if (
    value === "trusted" ||
    value === "watchlist" ||
    value === "experimental" ||
    value === "disabled"
  ) {
    return value;
  }

  return "experimental";
}

function normalizePublisherAllowlistStatus(
  value: string | null | undefined,
): PublisherAllowlistStatus {
  if (value === "allowlisted" || value === "candidate" || value === "blocked") {
    return value;
  }

  return "candidate";
}

function getSourceTrustTierLabel(tier: SourceTrustTier) {
  if (tier === "trusted") {
    return "Trusted";
  }

  if (tier === "watchlist") {
    return "Watchlist";
  }

  if (tier === "disabled") {
    return "Disabled";
  }

  return "Experimental";
}

function getPublisherAllowlistLabel(status: PublisherAllowlistStatus) {
  if (status === "allowlisted") {
    return "Allowlisted";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return "Candidate";
}

function parseSourceTrustTierInput(value: string): SourceTrustTier | null {
  const normalized = value.trim().toLowerCase();

  if (
    normalized === "trusted" ||
    normalized === "watchlist" ||
    normalized === "experimental" ||
    normalized === "disabled"
  ) {
    return normalized;
  }

  return null;
}

function parsePublisherAllowlistStatusInput(value: string): PublisherAllowlistStatus | null {
  const normalized = value.trim().toLowerCase();

  if (normalized === "allowlisted" || normalized === "candidate" || normalized === "blocked") {
    return normalized;
  }

  return null;
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

  if (feed.qualityScore < 50 || feed.qualityGrade === "poor") {
    return {
      status: "weak",
      statusLabel: "Low quality",
      reason: feed.qualityReason,
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
    reason: feed.qualityReason || "Feed is active and available to Worker shards.",
  };
}

function buildManagedFeed(row: FeedQualityDbRow): ManagedFeed {
  const totalFetchCount = safeNumber(row.total_fetch_count);
  const totalSuccessCount = safeNumber(row.total_success_count);
  const totalFailureCount = safeNumber(row.total_failure_count);
  const totalArticleCount = safeNumber(row.total_article_count);
  const totalImageCount = safeNumber(row.total_image_count);
  const totalAcceptedCount = safeNumber(row.total_accepted_count);
  const totalRejectedCount = safeNumber(row.total_rejected_count);
  const qualityGrade = normalizeQualityGrade(row.quality_grade);
  const sourceTrustTier = normalizeSourceTrustTier(row.source_trust_tier);
  const publisherAllowlistStatus = normalizePublisherAllowlistStatus(row.publisher_allowlist_status);
  const recommendedTrustTier = normalizeSourceTrustTier(row.recommended_trust_tier);
  const baseFeed: ManagedFeed = {
    id: row.feed_id,
    source: row.source,
    url: row.feed_url,
    isActive: safeBoolean(row.is_active, true),
    isPositiveSource: safeBoolean(row.is_positive_source, false),
    sourceTrustTier,
    sourceTrustTierLabel: getSourceTrustTierLabel(sourceTrustTier),
    publisherAllowlistStatus,
    publisherAllowlistLabel: getPublisherAllowlistLabel(publisherAllowlistStatus),
    recommendedTrustTier,
    recommendedTrustTierLabel: getSourceTrustTierLabel(recommendedTrustTier),
    tierRecommendationReason:
      row.tier_recommendation_reason || "No trust tier recommendation is available yet.",
    tierRecommendationMatches: sourceTrustTier === recommendedTrustTier,
    status: "untracked",
    statusLabel: "Untracked",
    reason: "Feed is active but has not been checked since feed health tracking was enabled.",
    qualityScore: Math.round(safeNumber(row.quality_score)),
    qualityGrade,
    qualityLabel: getQualityLabel(qualityGrade),
    qualityReason: row.quality_reason || "Quality score is not available yet.",
    lastCheckedAt: row.last_checked_at ?? null,
    lastSuccessAt: row.last_success_at ?? null,
    lastFailureAt: row.last_failure_at ?? null,
    lastStatus: row.last_status ?? null,
    lastErrorMessage: row.last_error_message ?? null,
    lastArticleCount: safeNumber(row.last_article_count),
    lastImageCount: safeNumber(row.last_image_count),
    lastAcceptedCount: safeNumber(row.last_accepted_count),
    lastRejectedCount: safeNumber(row.last_rejected_count),
    consecutiveFailureCount: safeNumber(row.consecutive_failure_count),
    totalFetchCount,
    totalSuccessCount,
    totalFailureCount,
    totalArticleCount,
    totalImageCount,
    totalAcceptedCount,
    totalRejectedCount,
    uniqueReviewedUrlCount: safeNumber(row.unique_reviewed_url_count),
    uniquePublishedUrlCount: safeNumber(row.unique_published_url_count),
    successRate: Math.round(safeNumber(row.success_rate_pct)) || percent(totalSuccessCount, totalFetchCount),
    imageRate: Math.round(safeNumber(row.thumbnail_rate_pct)) || percent(totalImageCount, totalArticleCount),
    acceptanceRate:
      Math.round(safeNumber(row.accepted_rate_pct)) ||
      percent(totalAcceptedCount, totalAcceptedCount + totalRejectedCount),
    failureRate: Math.round(safeNumber(row.failure_rate_pct)) || percent(totalFailureCount, totalFetchCount),
    duplicateRate: Math.round(safeNumber(row.duplicate_rate_pct)),
    updatedAt: row.updated_at ?? null,
    rawIsActiveValue: getRawBooleanValue(row.is_active),
    rawIsPositiveSourceValue: getRawBooleanValue(row.is_positive_source),
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
    acc.trustedFeeds += feed.sourceTrustTier === "trusted" ? 1 : 0;
    acc.watchlistFeeds += feed.sourceTrustTier === "watchlist" ? 1 : 0;
    acc.experimentalFeeds += feed.sourceTrustTier === "experimental" ? 1 : 0;
    acc.disabledTierFeeds += feed.sourceTrustTier === "disabled" ? 1 : 0;
    acc.allowlistedPublishers += feed.publisherAllowlistStatus === "allowlisted" ? 1 : 0;
    acc.candidatePublishers += feed.publisherAllowlistStatus === "candidate" ? 1 : 0;
    acc.blockedPublishers += feed.publisherAllowlistStatus === "blocked" ? 1 : 0;
    acc.tierRecommendationMismatches += feed.tierRecommendationMatches ? 0 : 1;
    acc.trackedFeeds += feed.lastCheckedAt ? 1 : 0;
    acc.untrackedFeeds += feed.lastCheckedAt ? 0 : 1;
    acc.failingFeeds += feed.status === "failing" ? 1 : 0;
    acc.weakFeeds += feed.status === "weak" ? 1 : 0;
    acc.excellentFeeds += feed.qualityGrade === "excellent" ? 1 : 0;
    acc.goodFeeds += feed.qualityGrade === "good" ? 1 : 0;
    acc.reviewFeeds += feed.qualityGrade === "review" ? 1 : 0;
    acc.poorFeeds += feed.qualityGrade === "poor" ? 1 : 0;
    acc.untrackedQualityFeeds += feed.qualityGrade === "untracked" ? 1 : 0;
    acc.inactiveQualityFeeds += feed.qualityGrade === "inactive" ? 1 : 0;
    acc.totalAcceptedCount += feed.totalAcceptedCount;
    acc.totalRejectedCount += feed.totalRejectedCount;
    acc.totalArticleCount += feed.totalArticleCount;
    acc.totalImageCount += feed.totalImageCount;

    return acc;
  }, emptySummary());
  const totalFetchCount = feeds.reduce((sum, feed) => sum + feed.totalFetchCount, 0);
  const totalSuccessCount = feeds.reduce((sum, feed) => sum + feed.totalSuccessCount, 0);
  const totalFailureCount = feeds.reduce((sum, feed) => sum + feed.totalFailureCount, 0);
  const activeScoredFeeds = feeds.filter((feed) => feed.isActive && feed.totalFetchCount > 0);
  const totalQualityScore = activeScoredFeeds.reduce((sum, feed) => sum + feed.qualityScore, 0);
  const weightedDuplicateNumerator = feeds.reduce(
    (sum, feed) => sum + feed.duplicateRate * feed.totalArticleCount,
    0,
  );

  return {
    ...summary,
    successRate: percent(totalSuccessCount, totalFetchCount),
    imageRate: percent(summary.totalImageCount, summary.totalArticleCount),
    acceptanceRate: percent(
      summary.totalAcceptedCount,
      summary.totalAcceptedCount + summary.totalRejectedCount,
    ),
    failureRate: percent(totalFailureCount, totalFetchCount),
    duplicateRate: summary.totalArticleCount ? Math.round(weightedDuplicateNumerator / summary.totalArticleCount) : 0,
    averageQualityScore: activeScoredFeeds.length
      ? Math.round(totalQualityScore / activeScoredFeeds.length)
      : 0,
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

function buildRankingSql() {
  return `select
  source,
  feed_url,
  is_active,
  source_trust_tier,
  publisher_allowlist_status,
  recommended_trust_tier,
  quality_score,
  quality_grade,
  success_rate_pct,
  thumbnail_rate_pct,
  accepted_rate_pct,
  failure_rate_pct,
  duplicate_rate_pct,
  total_fetch_count,
  total_accepted_count,
  quality_reason,
  tier_recommendation_reason
from public.feed_quality_scores
order by source_trust_tier asc, quality_score desc, total_accepted_count desc, source asc;`;
}

export async function getAdminFeedManagementDashboardData(): Promise<FeedManagementDashboardData> {
  const config = getSupabaseConfig();

  if (!config) {
    return emptyDashboardData(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for the admin feed management dashboard.",
    );
  }

  const qualityResult = await fetchSupabaseRows<FeedQualityDbRow>(
    config,
    `/rest/v1/feed_quality_scores?select=${FEED_QUALITY_SELECT_COLUMNS}&order=quality_score.asc,total_accepted_count.desc`,
  );

  if (qualityResult.errorMessage) {
    return emptyDashboardData(
      `Failed to load feed_quality_scores. Apply migration 20260615002000_create_feed_quality_scores.sql first. Supabase error: ${qualityResult.errorMessage}`,
    );
  }

  const managedFeeds = qualityResult.data
    .map((row) => buildManagedFeed(row))
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
        a.qualityScore - b.qualityScore ||
        Number(b.isActive) - Number(a.isActive) ||
        b.consecutiveFailureCount - a.consecutiveFailureCount ||
        b.totalAcceptedCount - a.totalAcceptedCount ||
        a.source.localeCompare(b.source)
      );
    });

  const lowQualityFeeds = managedFeeds
    .filter(
      (feed) =>
        feed.isActive &&
        (feed.qualityGrade === "poor" ||
          feed.qualityGrade === "review" ||
          feed.status === "failing" ||
          feed.status === "weak"),
    )
    .slice(0, 20);
  const bestQualityFeeds = [...managedFeeds]
    .filter((feed) => feed.isActive && feed.totalFetchCount > 0)
    .sort(
      (a, b) =>
        b.qualityScore - a.qualityScore ||
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
    summary: buildSummary(managedFeeds),
    feeds: managedFeeds,
    activeFeeds: managedFeeds.filter((feed) => feed.isActive),
    inactiveFeeds: managedFeeds.filter((feed) => !feed.isActive),
    failingFeeds: managedFeeds.filter((feed) => feed.status === "failing"),
    untrackedFeeds: managedFeeds.filter((feed) => feed.status === "untracked"),
    lowQualityFeeds,
    bestQualityFeeds,
    recommendedDisableFeeds: lowQualityFeeds
      .filter((feed) => feed.status === "failing" || feed.qualityScore < 50)
      .slice(0, 20),
    rankingSql: buildRankingSql(),
  };
}

export async function setAdminRssFeedActiveStatus({
  actorEmail,
  feedUrl,
  isActive,
}: {
  actorEmail?: string | null;
  feedUrl: string;
  isActive: boolean;
}) {
  try {
    assertDataMutation("admin-feed-management");
  } catch (error) {
    if (error instanceof RuntimeSafetyError) {
      return {
        ok: false,
        message: "Feed management mutations are disabled in this environment.",
      };
    }
    throw error;
  }

  let safeFeedUrl: string;
  try {
    safeFeedUrl = assertPublicHttpUrl(feedUrl, "Feed URL");
  } catch (error) {
    if (error instanceof ExternalUrlSafetyError) {
      return {
        ok: false,
        message: "Feed URL is not allowed.",
      };
    }

    throw error;
  }

  const config = getSupabaseConfig();

  if (!config) {
    return {
      ok: false,
      message: "Missing Supabase admin configuration.",
    };
  }

  const normalizedActorEmail = actorEmail?.trim().toLowerCase() || "unknown-admin@example.invalid";

  const response = await fetch(`${config.url}/rest/v1/rpc/set_rss_feed_active_with_audit`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_actor_email: normalizedActorEmail,
      p_feed_url: safeFeedUrl,
      p_is_active: isActive,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    return {
      ok: false,
      message: errorText || `Supabase returned ${response.status}`,
    };
  }

  const rows = response.status === 204 ? [] : ((await response.json()) as FeedToggleRpcRow[]);
  const updatedFeed = rows[0];

  if (response.status !== 204 && !updatedFeed?.audit_event_id) {
    return {
      ok: false,
      message: "Feed status changed, but the audit event was not returned.",
    };
  }

  return {
    ok: true,
    message: isActive ? "Feed enabled." : "Feed disabled.",
  };
}

export async function setAdminRssFeedTrustTier({
  actorEmail,
  feedUrl,
  sourceTrustTier,
  publisherAllowlistStatus,
}: {
  actorEmail?: string | null;
  feedUrl: string;
  sourceTrustTier: string;
  publisherAllowlistStatus: string;
}) {
  try {
    assertDataMutation("admin-feed-management");
  } catch (error) {
    if (error instanceof RuntimeSafetyError) {
      return {
        ok: false,
        message: "Feed management mutations are disabled in this environment.",
      };
    }
    throw error;
  }

  let safeFeedUrl: string;
  try {
    safeFeedUrl = assertPublicHttpUrl(feedUrl, "Feed URL");
  } catch (error) {
    if (error instanceof ExternalUrlSafetyError) {
      return {
        ok: false,
        message: "Feed URL is not allowed.",
      };
    }

    throw error;
  }

  const safeSourceTrustTier = parseSourceTrustTierInput(sourceTrustTier);
  const safePublisherAllowlistStatus = parsePublisherAllowlistStatusInput(
    publisherAllowlistStatus,
  );

  if (!safeSourceTrustTier) {
    return {
      ok: false,
      message: "Source trust tier is not allowed.",
    };
  }

  if (!safePublisherAllowlistStatus) {
    return {
      ok: false,
      message: "Publisher allowlist status is not allowed.",
    };
  }

  const config = getSupabaseConfig();

  if (!config) {
    return {
      ok: false,
      message: "Missing Supabase admin configuration.",
    };
  }

  const normalizedActorEmail = actorEmail?.trim().toLowerCase() || "unknown-admin@example.invalid";

  const response = await fetch(`${config.url}/rest/v1/rpc/set_rss_feed_trust_tier_with_audit`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_actor_email: normalizedActorEmail,
      p_feed_url: safeFeedUrl,
      p_source_trust_tier: safeSourceTrustTier,
      p_publisher_allowlist_status: safePublisherAllowlistStatus,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    return {
      ok: false,
      message: errorText || `Supabase returned ${response.status}`,
    };
  }

  const rows = response.status === 204 ? [] : ((await response.json()) as FeedTrustTierRpcRow[]);
  const updatedFeed = rows[0];

  if (response.status !== 204 && !updatedFeed?.audit_event_id) {
    return {
      ok: false,
      message: "Source tier changed, but the audit event was not returned.",
    };
  }

  const nextTier = parseSourceTrustTierInput(
    updatedFeed?.next_source_trust_tier ?? safeSourceTrustTier,
  ) ?? safeSourceTrustTier;
  const nextTierLabel = getSourceTrustTierLabel(nextTier);

  return {
    ok: true,
    message:
      nextTier === "disabled"
        ? "Source trust tier set to Disabled and feed disabled."
        : `Source trust tier updated to ${nextTierLabel}.`,
  };
}

export function formatFeedManagementDateTime(value: string | null, fallback = "Never") {
  return formatAdminDateTime(value, fallback);
}
