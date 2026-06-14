import { createClient } from "@supabase/supabase-js";

type AiDecision = "accept" | "reject";

type ArticleAiReviewRow = {
    original_url: string;
    source: string;
    title: string;
    decision: AiDecision;
    category: string;
    positivity_score: number;
    summary: string;
    reason: string;
    reviewed_at: string;
};

export type AiUsagePricingConfig = {
    inputTokensPerReviewEstimate: number;
    outputTokensPerReviewEstimate: number;
    inputCostPerOneMillionTokens: number;
    outputCostPerOneMillionTokens: number;
};

export type AiUsageSummary = {
    savedReviewCount: number;
    estimatedAiReviewCount: number;
    skippedBeforeAiCount: number;
    acceptedCount: number;
    rejectedCount: number;
    acceptanceRate: number;
    rejectionRate: number;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedTotalTokens: number;
    estimatedCostUsd: number;
};

export type AiUsageDailyPoint = {
    date: string;
    savedReviewCount: number;
    estimatedAiReviewCount: number;
    acceptedCount: number;
    rejectedCount: number;
    skippedBeforeAiCount: number;
    estimatedCostUsd: number;
};

export type AiUsageLatestReview = {
    reviewedAt: string;
    source: string;
    title: string;
    decision: AiDecision;
    category: string;
    positivityScore: number;
    estimatedCostUsd: number;
};

export type AiUsageDashboardData = {
    isConfigured: boolean;
    errorMessage: string | null;
    generatedAt: string;
    pricing: AiUsagePricingConfig;
    last24Hours: AiUsageSummary;
    last7Days: AiUsageSummary;
    last30Days: AiUsageSummary;
    daily: AiUsageDailyPoint[];
    latestAiReviews: AiUsageLatestReview[];
};

const DEFAULT_INPUT_TOKENS_PER_REVIEW_ESTIMATE = 650;
const DEFAULT_OUTPUT_TOKENS_PER_REVIEW_ESTIMATE = 160;
const DEFAULT_INPUT_COST_PER_ONE_MILLION_TOKENS = 0.15;
const DEFAULT_OUTPUT_COST_PER_ONE_MILLION_TOKENS = 0.6;
const MAX_REVIEW_ROWS_TO_LOAD = 5000;

function getNumberEnv(name: string, fallback: number) {
    const value = process.env[name];

    if (!value) {
        return fallback;
    }

    const parsed = Number(value);

    if (Number.isNaN(parsed) || parsed < 0) {
        return fallback;
    }

    return parsed;
}

function getPricingConfig(): AiUsagePricingConfig {
    return {
        inputTokensPerReviewEstimate: getNumberEnv(
            "OPENAI_INPUT_TOKENS_PER_REVIEW_ESTIMATE",
            DEFAULT_INPUT_TOKENS_PER_REVIEW_ESTIMATE,
        ),
        outputTokensPerReviewEstimate: getNumberEnv(
            "OPENAI_OUTPUT_TOKENS_PER_REVIEW_ESTIMATE",
            DEFAULT_OUTPUT_TOKENS_PER_REVIEW_ESTIMATE,
        ),
        inputCostPerOneMillionTokens: getNumberEnv(
            "OPENAI_INPUT_COST_PER_1M_TOKENS",
            DEFAULT_INPUT_COST_PER_ONE_MILLION_TOKENS,
        ),
        outputCostPerOneMillionTokens: getNumberEnv(
            "OPENAI_OUTPUT_COST_PER_1M_TOKENS",
            DEFAULT_OUTPUT_COST_PER_ONE_MILLION_TOKENS,
        ),
    };
}

function emptySummary(): AiUsageSummary {
    return {
        savedReviewCount: 0,
        estimatedAiReviewCount: 0,
        skippedBeforeAiCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        acceptanceRate: 0,
        rejectionRate: 0,
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        estimatedTotalTokens: 0,
        estimatedCostUsd: 0,
    };
}

function dateHoursAgo(hours: number) {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function dateDaysAgo(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function getUtcDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
}

function getLastUtcDateKeys(days: number) {
    return Array.from({ length: days }, (_value, index) => {
        const date = dateDaysAgo(days - index - 1);
        return getUtcDateKey(date);
    });
}

function isSkippedBeforeAiReview(row: ArticleAiReviewRow) {
    const reason = row.reason?.trim().toLowerCase() ?? "";

    return reason.startsWith("skipped before ai");
}

function estimateUsageCost(
    estimatedAiReviewCount: number,
    pricing: AiUsagePricingConfig,
) {
    const estimatedInputTokens =
        estimatedAiReviewCount * pricing.inputTokensPerReviewEstimate;
    const estimatedOutputTokens =
        estimatedAiReviewCount * pricing.outputTokensPerReviewEstimate;

    const estimatedInputCostUsd =
        (estimatedInputTokens / 1_000_000) *
        pricing.inputCostPerOneMillionTokens;
    const estimatedOutputCostUsd =
        (estimatedOutputTokens / 1_000_000) *
        pricing.outputCostPerOneMillionTokens;

    return {
        estimatedInputTokens,
        estimatedOutputTokens,
        estimatedTotalTokens: estimatedInputTokens + estimatedOutputTokens,
        estimatedCostUsd: estimatedInputCostUsd + estimatedOutputCostUsd,
    };
}

function summarizeRows(
    rows: ArticleAiReviewRow[],
    pricing: AiUsagePricingConfig,
): AiUsageSummary {
    const aiRows = rows.filter((row) => !isSkippedBeforeAiReview(row));
    const acceptedCount = aiRows.filter(
        (row) => row.decision === "accept",
    ).length;
    const rejectedCount = aiRows.filter(
        (row) => row.decision === "reject",
    ).length;
    const estimatedAiReviewCount = aiRows.length;
    const skippedBeforeAiCount = rows.length - estimatedAiReviewCount;

    const estimatedUsage = estimateUsageCost(estimatedAiReviewCount, pricing);

    return {
        savedReviewCount: rows.length,
        estimatedAiReviewCount,
        skippedBeforeAiCount,
        acceptedCount,
        rejectedCount,
        acceptanceRate:
            estimatedAiReviewCount === 0
                ? 0
                : Math.round((acceptedCount / estimatedAiReviewCount) * 100),
        rejectionRate:
            estimatedAiReviewCount === 0
                ? 0
                : Math.round((rejectedCount / estimatedAiReviewCount) * 100),
        ...estimatedUsage,
    };
}

function filterRowsSince(rows: ArticleAiReviewRow[], since: Date) {
    const sinceTime = since.getTime();

    return rows.filter((row) => {
        const reviewedTime = new Date(row.reviewed_at).getTime();

        if (Number.isNaN(reviewedTime)) {
            return false;
        }

        return reviewedTime >= sinceTime;
    });
}

function buildDailyPoints(
    rows: ArticleAiReviewRow[],
    pricing: AiUsagePricingConfig,
): AiUsageDailyPoint[] {
    const dateKeys = getLastUtcDateKeys(7);

    return dateKeys.map((dateKey) => {
        const dateRows = rows.filter((row) => {
            if (!row.reviewed_at) {
                return false;
            }

            return row.reviewed_at.slice(0, 10) === dateKey;
        });

        const summary = summarizeRows(dateRows, pricing);

        return {
            date: dateKey,
            savedReviewCount: summary.savedReviewCount,
            estimatedAiReviewCount: summary.estimatedAiReviewCount,
            acceptedCount: summary.acceptedCount,
            rejectedCount: summary.rejectedCount,
            skippedBeforeAiCount: summary.skippedBeforeAiCount,
            estimatedCostUsd: summary.estimatedCostUsd,
        };
    });
}

function buildLatestAiReviews(
    rows: ArticleAiReviewRow[],
    pricing: AiUsagePricingConfig,
): AiUsageLatestReview[] {
    const singleReviewCost = estimateUsageCost(1, pricing).estimatedCostUsd;

    return rows
        .filter((row) => !isSkippedBeforeAiReview(row))
        .slice(0, 12)
        .map((row) => ({
            reviewedAt: row.reviewed_at,
            source: row.source,
            title: row.title,
            decision: row.decision,
            category: row.category,
            positivityScore: row.positivity_score,
            estimatedCostUsd: singleReviewCost,
        }));
}

function getSupabaseAdminConfig() {
    const supabaseUrl =
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    return {
        supabaseUrl,
        supabaseServiceRoleKey,
    };
}

async function loadReviewRowsSince(since: Date) {
    const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseAdminConfig();

    if (!supabaseUrl) {
        throw new Error(
            "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable.",
        );
    }

    if (!supabaseServiceRoleKey) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    const { data, error } = await supabase
        .from("article_ai_reviews")
        .select(
            "original_url, source, title, decision, category, positivity_score, summary, reason, reviewed_at",
        )
        .gte("reviewed_at", since.toISOString())
        .order("reviewed_at", { ascending: false })
        .limit(MAX_REVIEW_ROWS_TO_LOAD);

    if (error) {
        throw new Error(error.message);
    }

    return (data ?? []) as ArticleAiReviewRow[];
}

export async function getAdminAiUsageDashboardData(): Promise<AiUsageDashboardData> {
    const pricing = getPricingConfig();
    const generatedAt = new Date().toISOString();

    try {
        const rows = await loadReviewRowsSince(dateDaysAgo(30));

        const last24HourRows = filterRowsSince(rows, dateHoursAgo(24));
        const last7DayRows = filterRowsSince(rows, dateDaysAgo(7));
        const last30DayRows = filterRowsSince(rows, dateDaysAgo(30));

        return {
            isConfigured: true,
            errorMessage: null,
            generatedAt,
            pricing,
            last24Hours: summarizeRows(last24HourRows, pricing),
            last7Days: summarizeRows(last7DayRows, pricing),
            last30Days: summarizeRows(last30DayRows, pricing),
            daily: buildDailyPoints(last7DayRows, pricing),
            latestAiReviews: buildLatestAiReviews(rows, pricing),
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
            pricing,
            last24Hours: emptySummary(),
            last7Days: emptySummary(),
            last30Days: emptySummary(),
            daily: buildDailyPoints([], pricing),
            latestAiReviews: [],
        };
    }
}1