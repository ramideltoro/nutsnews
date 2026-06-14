import Link from "next/link";
import { auth, signOut } from "@/auth";
import {
    type AiUsageDailyPoint,
    type AiUsageSummary,
    getAdminAiUsageDashboardData,
} from "@/lib/adminAiUsage";

export const metadata = {
    title: "AI Usage | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatCurrency(value: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: value > 0 && value < 1 ? 4 : 2,
        maximumFractionDigits: value > 0 && value < 1 ? 4 : 2,
    }).format(value);
}

function formatNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatCompactNumber(value: number) {
    return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(Math.round(value));
}

function formatDateTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Unknown";
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

function formatDateLabel(value: string) {
    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    }).format(date);
}

function StatCard({
                      label,
                      value,
                      helper,
                  }: {
    label: string;
    value: string;
    helper: string;
}) {
    return (
        <div className="rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                {label}
            </p>
            <h2 className="mt-3 text-3xl font-black text-amber-50">{value}</h2>
            <p className="mt-2 text-sm leading-6 text-amber-100/60">{helper}</p>
        </div>
    );
}

function SummaryCards({
                          summary,
                          windowLabel,
                      }: {
    summary: AiUsageSummary;
    windowLabel: string;
}) {
    return (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
                label="Estimated OpenAI Cost"
                value={formatCurrency(summary.estimatedCostUsd)}
                helper={`${windowLabel}. Estimated from AI review count and configured token assumptions.`}
            />
            <StatCard
                label="Estimated AI Reviews"
                value={formatNumber(summary.estimatedAiReviewCount)}
                helper="Rows that appear to have reached OpenAI. Local skipped rows are excluded."
            />
            <StatCard
                label="Accepted"
                value={formatNumber(summary.acceptedCount)}
                helper={`${summary.acceptanceRate}% acceptance rate from estimated AI-reviewed articles.`}
            />
            <StatCard
                label="Rejected"
                value={formatNumber(summary.rejectedCount)}
                helper={`${summary.rejectionRate}% rejection rate from estimated AI-reviewed articles.`}
            />
        </section>
    );
}

function DailyUsageChart({ daily }: { daily: AiUsageDailyPoint[] }) {
    const maxReviews = Math.max(
        1,
        ...daily.map((point) => point.estimatedAiReviewCount),
    );

    return (
        <div className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 sm:p-6">
            <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                    7 Day Usage
                </p>
                <h2 className="mt-2 text-2xl font-black text-amber-50">
                    AI reviews and estimated cost
                </h2>
                <p className="mt-2 text-sm leading-6 text-amber-100/60">
                    Daily buckets use UTC dates and exclude reviews skipped before AI.
                </p>
            </div>

            <div className="grid gap-3">
                {daily.map((point) => {
                    const widthPercent = Math.max(
                        4,
                        Math.round((point.estimatedAiReviewCount / maxReviews) * 100),
                    );

                    return (
                        <div
                            key={point.date}
                            className="rounded-[1.35rem] border border-amber-300/15 bg-black/30 p-4"
                        >
                            <div className="mb-3 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-black text-amber-50">
                                        {formatDateLabel(point.date)}
                                    </p>
                                    <p className="mt-1 text-xs text-amber-100/55">
                                        {formatCurrency(point.estimatedCostUsd)} estimated
                                    </p>
                                </div>

                                <div className="text-right">
                                    <p className="text-sm font-black text-amber-50">
                                        {formatNumber(point.estimatedAiReviewCount)}
                                    </p>
                                    <p className="mt-1 text-xs text-amber-100/55">AI reviews</p>
                                </div>
                            </div>

                            <div className="h-3 overflow-hidden rounded-full bg-amber-950/60">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 shadow-[0_0_18px_rgba(251,191,36,0.35)]"
                                    style={{ width: `${widthPercent}%` }}
                                />
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-amber-100/60">
                <span className="rounded-full border border-amber-300/15 bg-black/30 px-3 py-1">
                  Accepted: {formatNumber(point.acceptedCount)}
                </span>
                                <span className="rounded-full border border-amber-300/15 bg-black/30 px-3 py-1">
                  Rejected: {formatNumber(point.rejectedCount)}
                </span>
                                <span className="rounded-full border border-amber-300/15 bg-black/30 px-3 py-1">
                  Skipped before AI: {formatNumber(point.skippedBeforeAiCount)}
                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CostMethodologyCard({
                                 summary,
                                 inputTokensPerReviewEstimate,
                                 outputTokensPerReviewEstimate,
                                 inputCostPerOneMillionTokens,
                                 outputCostPerOneMillionTokens,
                             }: {
    summary: AiUsageSummary;
    inputTokensPerReviewEstimate: number;
    outputTokensPerReviewEstimate: number;
    inputCostPerOneMillionTokens: number;
    outputCostPerOneMillionTokens: number;
}) {
    return (
        <div className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 sm:p-6">
            <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                    Cost Method
                </p>
                <h2 className="mt-2 text-2xl font-black text-amber-50">
                    How this estimate is calculated
                </h2>
                <p className="mt-2 text-sm leading-6 text-amber-100/60">
                    This dashboard estimates cost until exact token usage is saved by the
                    worker. You can tune the assumptions through environment variables.
                </p>
            </div>

            <div className="grid gap-3">
                <div className="rounded-[1.35rem] border border-amber-300/15 bg-black/30 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300/70">
                        Estimated tokens
                    </p>
                    <p className="mt-2 text-sm leading-6 text-amber-100/70">
                        {formatCompactNumber(inputTokensPerReviewEstimate)} input tokens +{" "}
                        {formatCompactNumber(outputTokensPerReviewEstimate)} output tokens
                        per AI-reviewed article.
                    </p>
                </div>

                <div className="rounded-[1.35rem] border border-amber-300/15 bg-black/30 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300/70">
                        Pricing assumptions
                    </p>
                    <p className="mt-2 text-sm leading-6 text-amber-100/70">
                        {formatCurrency(inputCostPerOneMillionTokens)} per 1M input tokens
                        and {formatCurrency(outputCostPerOneMillionTokens)} per 1M output
                        tokens.
                    </p>
                </div>

                <div className="rounded-[1.35rem] border border-amber-300/15 bg-black/30 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300/70">
                        Last 30 day estimated tokens
                    </p>
                    <p className="mt-2 text-sm leading-6 text-amber-100/70">
                        {formatCompactNumber(summary.estimatedTotalTokens)} total tokens:{" "}
                        {formatCompactNumber(summary.estimatedInputTokens)} input and{" "}
                        {formatCompactNumber(summary.estimatedOutputTokens)} output.
                    </p>
                </div>
            </div>
        </div>
    );
}

function LatestReviewsTable({
                                reviews,
                            }: {
    reviews: {
        reviewedAt: string;
        source: string;
        title: string;
        decision: "accept" | "reject";
        category: string;
        positivityScore: number;
        estimatedCostUsd: number;
    }[];
}) {
    return (
        <div className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 sm:p-6">
            <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                    Recent AI Decisions
                </p>
                <h2 className="mt-2 text-2xl font-black text-amber-50">
                    Latest estimated OpenAI reviews
                </h2>
                <p className="mt-2 text-sm leading-6 text-amber-100/60">
                    Local prefilter skips are hidden here so this list focuses on reviews
                    that likely reached OpenAI.
                </p>
            </div>

            {reviews.length === 0 ? (
                <div className="rounded-[1.35rem] border border-amber-300/15 bg-black/30 p-4 text-sm text-amber-100/65">
                    No estimated AI-reviewed articles found yet.
                </div>
            ) : (
                <div className="overflow-hidden rounded-[1.35rem] border border-amber-300/15">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-amber-300/10 text-left text-sm">
                            <thead className="bg-black/40 text-[10px] uppercase tracking-[0.16em] text-amber-300/75">
                            <tr>
                                <th className="px-4 py-3 font-black">Time</th>
                                <th className="px-4 py-3 font-black">Decision</th>
                                <th className="px-4 py-3 font-black">Source</th>
                                <th className="px-4 py-3 font-black">Story</th>
                                <th className="px-4 py-3 font-black">Score</th>
                                <th className="px-4 py-3 font-black">Est. Cost</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-300/10 bg-black/20">
                            {reviews.map((review) => (
                                <tr key={`${review.reviewedAt}-${review.title}`}>
                                    <td className="whitespace-nowrap px-4 py-3 text-amber-100/65">
                                        {formatDateTime(review.reviewedAt)}
                                    </td>
                                    <td className="px-4 py-3">
                      <span
                          className={
                              review.decision === "accept"
                                  ? "rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-100"
                                  : "rounded-full border border-red-300/25 bg-red-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-red-100"
                          }
                      >
                        {review.decision}
                      </span>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                        {review.source}
                                    </td>
                                    <td className="max-w-lg px-4 py-3 text-amber-50">
                                        <div>{review.title}</div>
                                        <div className="mt-1 text-xs text-amber-100/45">
                                            {review.category}
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                        {review.positivityScore}/10
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                        {formatCurrency(review.estimatedCostUsd)}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default async function AdminAiUsagePage() {
    const session = await auth();
    const dashboardData = await getAdminAiUsageDashboardData();

    return (
        <main className="min-h-screen overflow-hidden bg-[#0a0a0a] px-4 py-6 text-amber-50 sm:px-6 lg:px-8">
            <div className="pointer-events-none fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.22),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.14),_transparent_34%),linear-gradient(135deg,_#0a0a0a,_#171717_52%,_#451a03)]" />
                <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/10 blur-3xl" />
                <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
            </div>

            <div className="mx-auto max-w-7xl">
                <header className="mb-5 rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/55 via-neutral-950/85 to-amber-950/25 p-5 shadow-2xl shadow-amber-950/30 backdrop-blur sm:p-7">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div>
                            <Link
                                href="/admin"
                                className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/15"
                            >
                                <span>←</span>
                                Admin Home
                            </Link>

                            <h1 className="text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">
                                AI Usage Dashboard
                            </h1>

                            <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                                Monitor estimated OpenAI usage, accepted articles, rejected
                                articles, local prefilter savings, token assumptions, and
                                estimated cost.
                            </p>
                        </div>

                        <div className="rounded-[1.45rem] border border-amber-300/15 bg-black/30 p-4 text-left md:min-w-72">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/80">
                                Signed in as
                            </p>
                            <p className="mt-2 break-all text-sm font-semibold text-amber-50">
                                {session?.user?.email}
                            </p>

                            <form
                                className="mt-4"
                                action={async () => {
                                    "use server";

                                    await signOut({
                                        redirectTo: "/",
                                    });
                                }}
                            >
                                <button
                                    type="submit"
                                    className="w-full rounded-full border border-amber-300/25 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/10"
                                >
                                    Sign out
                                </button>
                            </form>
                        </div>
                    </div>
                </header>

                {!dashboardData.isConfigured ? (
                    <section className="mb-5 rounded-[2rem] border border-red-300/20 bg-red-500/10 p-5 shadow-xl shadow-red-950/20 sm:p-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-200">
                            Dashboard Setup Needed
                        </p>
                        <h2 className="mt-2 text-2xl font-black text-red-50">
                            AI usage data could not be loaded.
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-red-100/75">
                            {dashboardData.errorMessage}
                        </p>
                    </section>
                ) : null}

                <div className="mb-5 grid gap-4 md:grid-cols-3">
                    <StatCard
                        label="Last 24 Hours"
                        value={formatCurrency(dashboardData.last24Hours.estimatedCostUsd)}
                        helper={`${formatNumber(
                            dashboardData.last24Hours.estimatedAiReviewCount,
                        )} estimated OpenAI reviews.`}
                    />
                    <StatCard
                        label="Last 7 Days"
                        value={formatCurrency(dashboardData.last7Days.estimatedCostUsd)}
                        helper={`${formatNumber(
                            dashboardData.last7Days.estimatedAiReviewCount,
                        )} estimated OpenAI reviews.`}
                    />
                    <StatCard
                        label="Last 30 Days"
                        value={formatCurrency(dashboardData.last30Days.estimatedCostUsd)}
                        helper={`${formatNumber(
                            dashboardData.last30Days.estimatedAiReviewCount,
                        )} estimated OpenAI reviews.`}
                    />
                </div>

                <div className="mb-5">
                    <SummaryCards
                        summary={dashboardData.last24Hours}
                        windowLabel="Last 24 hours"
                    />
                </div>

                <section className="mb-5 grid gap-4 md:grid-cols-3">
                    <StatCard
                        label="Local Filter Savings"
                        value={formatNumber(dashboardData.last30Days.skippedBeforeAiCount)}
                        helper="Reviews skipped before OpenAI because local rules rejected them first."
                    />
                    <StatCard
                        label="Saved Review Rows"
                        value={formatNumber(dashboardData.last30Days.savedReviewCount)}
                        helper="All review rows saved in the last 30 days, including local skips."
                    />
                    <StatCard
                        label="Generated"
                        value={formatDateTime(dashboardData.generatedAt)}
                        helper="This page is server-rendered and uses no exposed service-role key in the browser."
                    />
                </section>

                <section className="mb-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <DailyUsageChart daily={dashboardData.daily} />

                    <CostMethodologyCard
                        summary={dashboardData.last30Days}
                        inputTokensPerReviewEstimate={
                            dashboardData.pricing.inputTokensPerReviewEstimate
                        }
                        outputTokensPerReviewEstimate={
                            dashboardData.pricing.outputTokensPerReviewEstimate
                        }
                        inputCostPerOneMillionTokens={
                            dashboardData.pricing.inputCostPerOneMillionTokens
                        }
                        outputCostPerOneMillionTokens={
                            dashboardData.pricing.outputCostPerOneMillionTokens
                        }
                    />
                </section>

                <LatestReviewsTable reviews={dashboardData.latestAiReviews} />
            </div>
        </main>
    );
}