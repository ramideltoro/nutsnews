import type { ReactNode } from "react";
import Link from "next/link";
import { formatAdminDateLabel, formatAdminDateTime } from "@/lib/adminTime";
import { auth, signOut } from "@/auth";
import {
    type AiUsageDailyPoint,
    type AiUsageLatestRun,
    type AiUsageShardPoint,
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

function formatDuration(value: number) {
    if (!value) {
        return "0ms";
    }

    if (value < 1000) {
        return `${formatNumber(value)}ms`;
    }

    return `${(value / 1000).toFixed(1)}s`;
}

function formatDateTime(value: string | null) {
    return formatAdminDateTime(value, "No runs yet");
}

function formatDateLabel(value: string) {
    return formatAdminDateLabel(value);
}

function StatusPill({
                        status,
                        variant,
                    }: {
    status: string;
    variant: "ok" | "watch" | "neutral";
}) {
    const classes = {
        ok: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
        watch: "border-orange-300/25 bg-orange-400/10 text-orange-100",
        neutral: "border-amber-300/20 bg-black/30 text-amber-100/70",
    };

    return (
        <span
            className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${classes[variant]}`}
        >
      {status}
    </span>
    );
}

function MetricCard({
                        label,
                        value,
                        helper,
                        tone = "default",
                    }: {
    label: string;
    value: string;
    helper: string;
    tone?: "default" | "good" | "warning";
}) {
    const toneClasses = {
        default: "from-black/45 via-neutral-950/85 to-amber-950/25",
        good: "from-black/45 via-neutral-950/85 to-emerald-950/20",
        warning: "from-black/45 via-neutral-950/85 to-orange-950/25",
    };

    return (
        <div
            className={`rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br ${toneClasses[tone]} p-5 shadow-xl shadow-amber-950/20`}
        >
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                {label}
            </p>
            <h3 className="mt-3 text-3xl font-black text-amber-50">{value}</h3>
            <p className="mt-2 text-sm leading-6 text-amber-100/60">{helper}</p>
        </div>
    );
}

function DashboardSection({
                              id,
                              eyebrow,
                              title,
                              description,
                              children,
                          }: {
    id: string;
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section
            id={id}
            className="scroll-mt-6 rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 sm:p-6"
        >
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                        {eyebrow}
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-amber-50">{title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-100/60">
                        {description}
                    </p>
                </div>
            </div>

            {children}
        </section>
    );
}

function QuickNav() {
    const links = [
        ["Cost", "#cost"],
        ["Tokens", "#tokens"],
        ["Activity Breakdown", "#activity-breakdown"],
        ["Daily Usage", "#daily-usage"],
        ["Shard Usage", "#shard-usage"],
        ["Latest Runs", "#latest-worker-runs"],
    ];

    return (
        <nav className="mb-5 rounded-[1.75rem] border border-amber-300/20 bg-black/30 p-3 shadow-xl shadow-amber-950/10">
            <div className="flex flex-wrap gap-2">
                {links.map(([label, href]) => (
                    <a
                        key={href}
                        href={href}
                        className="rounded-full border border-amber-300/20 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/10"
                    >
                        {label}
                    </a>
                ))}
            </div>
        </nav>
    );
}

function CostSection({
                         last24Hours,
                         last7Days,
                         last30Days,
                     }: {
    last24Hours: AiUsageSummary;
    last7Days: AiUsageSummary;
    last30Days: AiUsageSummary;
}) {
    return (
        <DashboardSection
            id="cost"
            eyebrow="Cost"
            title="Cost Overview"
            description="Track total estimated OpenAI cost, including review and translation activity, plus the estimated cost avoided by using local AI."
        >
            <div className="grid gap-4 md:grid-cols-4">
                <MetricCard
                    label="OpenAI Cost, 24h"
                    value={formatCurrency(last24Hours.estimatedCostUsd)}
                    helper={`${formatNumber(last24Hours.openAiCallCount)} OpenAI activities · ${formatNumber(last24Hours.aiReviewedCount)} reviews.`}
                />
                <MetricCard
                    label="OpenAI Cost, 7d"
                    value={formatCurrency(last7Days.estimatedCostUsd)}
                    helper={`${formatNumber(last7Days.costProtectionHitCount)} cost protection hits · ${formatNumber(last7Days.spikeWarningCount)} spike warnings.`}
                    tone={last7Days.costProtectionHitCount > 0 || last7Days.spikeWarningCount > 0 ? "warning" : "default"}
                />
                <MetricCard
                    label="OpenAI Cost, 30d"
                    value={formatCurrency(last30Days.estimatedCostUsd)}
                    helper={`${formatNumber(last30Days.runCount)} Worker runs across ${formatNumber(last30Days.shardCount)} shards.`}
                />
                <MetricCard
                    label="Local AI Savings, 30d"
                    value={formatCurrency(last30Days.estimatedLocalAiSavingsUsd)}
                    helper="Estimated OpenAI cost avoided by using local AI for reviews and translations."
                    tone="good"
                />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard
                    label="Accepted"
                    value={formatNumber(last30Days.acceptedCount)}
                    helper={`${last30Days.acceptanceRate}% acceptance rate over the last 30 days.`}
                    tone="good"
                />
                <MetricCard
                    label="Rejected"
                    value={formatNumber(last30Days.rejectedCount)}
                    helper={`${last30Days.rejectionRate}% rejection rate over the last 30 days.`}
                />
                <MetricCard
                    label="OpenAI Activities"
                    value={formatNumber(last30Days.openAiCallCount)}
                    helper={`${formatNumber(last30Days.openAiReviewCount)} reviews · ${formatNumber(last30Days.openAiTranslationCount)} translations.`}
                />
                <MetricCard
                    label="Local AI Activities"
                    value={formatNumber(last30Days.localAiCallCount)}
                    helper={`${formatNumber(last30Days.localAiReviewCount)} reviews · ${formatNumber(last30Days.localAiTranslationCount)} translations.`}
                    tone="good"
                />
                <MetricCard
                    label="Average Run Time"
                    value={formatDuration(last30Days.averageDurationMs)}
                    helper="Average Worker duration for captured usage runs."
                />
            </div>
        </DashboardSection>
    );
}

function TokenSection({
                          last24Hours,
                          last7Days,
                          last30Days,
                          latestModel,
                      }: {
    last24Hours: AiUsageSummary;
    last7Days: AiUsageSummary;
    last30Days: AiUsageSummary;
    latestModel: string;
}) {
    return (
        <DashboardSection
            id="tokens"
            eyebrow="Tokens"
            title="Token Usage"
            description="Separate prompt/input tokens from completion/output tokens so OpenAI cost can be calculated more accurately."
        >
            <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                    label="Prompt Tokens"
                    value={formatCompactNumber(last30Days.promptTokens)}
                    helper="Last 30 days of OpenAI prompt/input tokens."
                />
                <MetricCard
                    label="Completion Tokens"
                    value={formatCompactNumber(last30Days.completionTokens)}
                    helper="Last 30 days of OpenAI completion/output tokens."
                />
                <MetricCard
                    label="Total Tokens"
                    value={formatCompactNumber(last30Days.totalTokens)}
                    helper="Prompt plus completion tokens over the last 30 days."
                />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
                <MetricCard
                    label="Local AI Tokens"
                    value={formatCompactNumber(last30Days.localAiReviewTokens + last30Days.localAiTranslationTokens)}
                    helper={`${formatCompactNumber(last30Days.localAiReviewTokens)} review/summary · ${formatCompactNumber(last30Days.localAiTranslationTokens)} translation tokens.`}
                    tone="good"
                />
                <MetricCard
                    label="Last 24 Hours"
                    value={formatCompactNumber(last24Hours.totalTokens)}
                    helper={`${formatCompactNumber(
                        last24Hours.promptTokens,
                    )} prompt · ${formatCompactNumber(
                        last24Hours.completionTokens,
                    )} completion tokens.`}
                />
                <MetricCard
                    label="Last 7 Days"
                    value={formatCompactNumber(last7Days.totalTokens)}
                    helper={`${formatCompactNumber(
                        last7Days.promptTokens,
                    )} prompt · ${formatCompactNumber(
                        last7Days.completionTokens,
                    )} completion tokens.`}
                />
                <MetricCard
                    label="Latest Model"
                    value={latestModel}
                    helper="Model name from the latest saved Worker AI usage run."
                />
            </div>
        </DashboardSection>
    );
}

function ActivityBreakdownSection({ last30Days }: { last30Days: AiUsageSummary }) {
    const rows = [
        {
            activity: "Review + English summary",
            openAiCount: last30Days.openAiReviewCount,
            localAiCount: last30Days.localAiReviewCount,
            openAiTokens: last30Days.openAiReviewTokens,
            localAiTokens: last30Days.localAiReviewTokens,
            openAiCost: last30Days.estimatedOpenAiReviewCostUsd,
        },
        {
            activity: "Summary translations",
            openAiCount: last30Days.openAiTranslationCount,
            localAiCount: last30Days.localAiTranslationCount,
            openAiTokens: last30Days.openAiTranslationTokens,
            localAiTokens: last30Days.localAiTranslationTokens,
            openAiCost: last30Days.estimatedOpenAiTranslationCostUsd,
        },
    ];

    return (
        <DashboardSection
            id="activity-breakdown"
            eyebrow="AI Activity"
            title="OpenAI vs Local AI Breakdown"
            description="Compare what each provider handled across article review, English summaries, and summary translations over the last 30 days."
        >
            <div className="mb-4 grid gap-4 md:grid-cols-3">
                <MetricCard
                    label="Total AI Activities"
                    value={formatNumber(last30Days.totalAiActivityCount)}
                    helper={`${formatNumber(last30Days.openAiCallCount)} OpenAI · ${formatNumber(last30Days.localAiCallCount)} local AI.`}
                />
                <MetricCard
                    label="OpenAI Breakdown"
                    value={formatNumber(last30Days.openAiCallCount)}
                    helper={`${formatNumber(last30Days.openAiReviewCount)} review/summary · ${formatNumber(last30Days.openAiTranslationCount)} translations.`}
                />
                <MetricCard
                    label="Local AI Breakdown"
                    value={formatNumber(last30Days.localAiCallCount)}
                    helper={`${formatNumber(last30Days.localAiReviewCount)} review/summary · ${formatNumber(last30Days.localAiTranslationCount)} translations.`}
                    tone="good"
                />
            </div>

            <div className="overflow-hidden rounded-[1.35rem] border border-amber-300/15">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-amber-300/10 text-left text-sm">
                        <thead className="bg-black/40 text-[10px] uppercase tracking-[0.16em] text-amber-300/75">
                        <tr>
                            <th className="px-4 py-3 font-black">Activity</th>
                            <th className="px-4 py-3 font-black">OpenAI Count</th>
                            <th className="px-4 py-3 font-black">Local AI Count</th>
                            <th className="px-4 py-3 font-black">OpenAI Tokens</th>
                            <th className="px-4 py-3 font-black">Local AI Tokens</th>
                            <th className="px-4 py-3 font-black">OpenAI Cost</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-300/10 bg-black/20">
                        {rows.map((row) => (
                            <tr key={row.activity}>
                                <td className="whitespace-nowrap px-4 py-3 font-black text-amber-50">{row.activity}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">{formatNumber(row.openAiCount)}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-emerald-100/80">{formatNumber(row.localAiCount)}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">{formatCompactNumber(row.openAiTokens)}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-emerald-100/80">{formatCompactNumber(row.localAiTokens)}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">{formatCurrency(row.openAiCost)}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardSection>
    );
}

function DailyUsageSection({ daily }: { daily: AiUsageDailyPoint[] }) {
    const maxReviews = Math.max(1, ...daily.map((point) => point.aiReviewedCount));

    return (
        <DashboardSection
            id="daily-usage"
            eyebrow="Daily Usage"
            title="Daily Usage"
            description="A 7-day view of AI reviews, token use, cost, accepted decisions, rejected decisions, and cap hits."
        >
            <div className="grid gap-3">
                {daily.map((point) => {
                    const widthPercent = Math.max(
                        4,
                        Math.round((point.aiReviewedCount / maxReviews) * 100),
                    );

                    return (
                        <div
                            key={point.date}
                            className="rounded-[1.35rem] border border-amber-300/15 bg-black/30 p-4"
                        >
                            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-sm font-black text-amber-50">
                                        {formatDateLabel(point.date)}
                                    </p>
                                    <p className="mt-1 text-xs text-amber-100/55">
                                        {formatCurrency(point.estimatedCostUsd)} ·{" "}
                                        {formatCompactNumber(point.totalTokens)} tokens
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2 text-xs text-amber-100/60">
                  <span className="rounded-full border border-amber-300/15 bg-black/30 px-3 py-1">
                    Runs: {formatNumber(point.runCount)}
                  </span>
                                    <span className="rounded-full border border-amber-300/15 bg-black/30 px-3 py-1">
                    Calls: {formatNumber(point.openAiCallCount)}
                  </span>
                                    <span className="rounded-full border border-amber-300/15 bg-black/30 px-3 py-1">
                    Reviews: {formatNumber(point.aiReviewedCount)}
                  </span>
                                    <span className="rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-emerald-100/80">
                    Accepted: {formatNumber(point.acceptedCount)}
                  </span>
                                    <span className="rounded-full border border-red-300/15 bg-red-400/10 px-3 py-1 text-red-100/80">
                    Rejected: {formatNumber(point.rejectedCount)}
                  </span>
                                    <span className="rounded-full border border-orange-300/15 bg-orange-400/10 px-3 py-1 text-orange-100/80">
                    Cap hits: {formatNumber(point.costProtectionHitCount)}
                  </span>
                                </div>
                            </div>

                            <div className="h-3 overflow-hidden rounded-full bg-amber-950/60">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 shadow-[0_0_18px_rgba(251,191,36,0.35)]"
                                    style={{ width: `${widthPercent}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </DashboardSection>
    );
}

function ShardUsageSection({ shards }: { shards: AiUsageShardPoint[] }) {
    return (
        <DashboardSection
            id="shard-usage"
            eyebrow="Shard Usage"
            title="Shard Usage"
            description="See which Worker shards are using OpenAI and whether any shard is hitting cost protection or spike thresholds."
        >
            <div className="mb-4 flex flex-wrap gap-3">
                <StatusPill status={`${formatNumber(shards.length)} shard rows`} variant="neutral" />
                {shards.some(
                    (shard) => shard.costProtectionHitCount > 0 || shard.spikeWarningCount > 0,
                ) ? (
                    <StatusPill status="Watch items found" variant="watch" />
                ) : (
                    <StatusPill status="All shards OK" variant="ok" />
                )}
            </div>

            <div className="overflow-hidden rounded-[1.35rem] border border-amber-300/15">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-amber-300/10 text-left text-sm">
                        <thead className="bg-black/40 text-[10px] uppercase tracking-[0.16em] text-amber-300/75">
                        <tr>
                            <th className="px-4 py-3 font-black">Shard</th>
                            <th className="px-4 py-3 font-black">Runs</th>
                            <th className="px-4 py-3 font-black">Calls</th>
                            <th className="px-4 py-3 font-black">Reviews</th>
                            <th className="px-4 py-3 font-black">Accepted</th>
                            <th className="px-4 py-3 font-black">Rejected</th>
                            <th className="px-4 py-3 font-black">Tokens</th>
                            <th className="px-4 py-3 font-black">Cost</th>
                            <th className="px-4 py-3 font-black">Latest</th>
                            <th className="px-4 py-3 font-black">Status</th>
                        </tr>
                        </thead>

                        <tbody className="divide-y divide-amber-300/10 bg-black/20">
                        {shards.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={10}
                                    className="px-4 py-5 text-center text-amber-100/65"
                                >
                                    No shard usage rows found yet.
                                </td>
                            </tr>
                        ) : (
                            shards.map((shard) => {
                                const needsWatch =
                                    shard.costProtectionHitCount > 0 || shard.spikeWarningCount > 0;

                                return (
                                    <tr key={shard.shardIndex}>
                                        <td className="whitespace-nowrap px-4 py-3 font-black text-amber-50">
                                            {shard.shardIndex}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                            {formatNumber(shard.runCount)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                            {formatNumber(shard.openAiCallCount)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                            {formatNumber(shard.aiReviewedCount)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-emerald-100/80">
                                            {formatNumber(shard.acceptedCount)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-red-100/80">
                                            {formatNumber(shard.rejectedCount)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                            {formatCompactNumber(shard.totalTokens)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                            {formatCurrency(shard.estimatedCostUsd)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                            {formatDateTime(shard.latestRunAt)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <StatusPill
                                                status={needsWatch ? "Watch" : "OK"}
                                                variant={needsWatch ? "watch" : "ok"}
                                            />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardSection>
    );
}

function LatestWorkerRunsSection({ runs }: { runs: AiUsageLatestRun[] }) {
    return (
        <DashboardSection
            id="latest-worker-runs"
            eyebrow="Latest Worker Runs"
            title="Latest Worker Runs"
            description="Review the most recent Worker usage rows saved into the ai_usage_runs table."
        >
            <div className="mb-4 flex flex-wrap gap-3">
                <StatusPill status={`${formatNumber(runs.length)} latest rows`} variant="neutral" />
                {runs.some((run) => run.spikeWarningTriggered || run.costProtectionLimitReached) ? (
                    <StatusPill status="Watch items found" variant="watch" />
                ) : (
                    <StatusPill status="Latest runs OK" variant="ok" />
                )}
            </div>

            <div className="overflow-hidden rounded-[1.35rem] border border-amber-300/15">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-amber-300/10 text-left text-sm">
                        <thead className="bg-black/40 text-[10px] uppercase tracking-[0.16em] text-amber-300/75">
                        <tr>
                            <th className="px-4 py-3 font-black">Time</th>
                            <th className="px-4 py-3 font-black">Source</th>
                            <th className="px-4 py-3 font-black">Shard</th>
                            <th className="px-4 py-3 font-black">Model</th>
                            <th className="px-4 py-3 font-black">Calls</th>
                            <th className="px-4 py-3 font-black">Reviews</th>
                            <th className="px-4 py-3 font-black">Accepted</th>
                            <th className="px-4 py-3 font-black">Rejected</th>
                            <th className="px-4 py-3 font-black">Tokens</th>
                            <th className="px-4 py-3 font-black">Cost</th>
                            <th className="px-4 py-3 font-black">Duration</th>
                            <th className="px-4 py-3 font-black">Status</th>
                        </tr>
                        </thead>

                        <tbody className="divide-y divide-amber-300/10 bg-black/20">
                        {runs.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={12}
                                    className="px-4 py-5 text-center text-amber-100/65"
                                >
                                    No Worker run rows found yet.
                                </td>
                            </tr>
                        ) : (
                            runs.map((run) => {
                                const needsWatch =
                                    run.spikeWarningTriggered || run.costProtectionLimitReached;

                                return (
                                    <tr key={run.id}>
                                        <td className="whitespace-nowrap px-4 py-3 text-amber-100/65">
                                            {formatDateTime(run.runStartedAt)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                            {run.runSource}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 font-black text-amber-50">
                                            {run.shardIndex}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                            {run.openAiModel}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                            {formatNumber(run.openAiCallCount)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                            {formatNumber(run.aiReviewedCount)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-emerald-100/80">
                                            {formatNumber(run.acceptedCount)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-red-100/80">
                                            {formatNumber(run.rejectedCount)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                            {formatCompactNumber(run.totalTokens)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                            {formatCurrency(run.estimatedCostUsd)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                            {formatDuration(run.durationMs)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <StatusPill
                                                status={needsWatch ? "Watch" : "OK"}
                                                variant={needsWatch ? "watch" : "ok"}
                                            />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardSection>
    );
}

export default async function AdminAiUsagePage() {
    const session = await auth();
    const dashboardData = await getAdminAiUsageDashboardData();
    const latestModel = dashboardData.latestRuns[0]?.openAiModel ?? "No runs yet";

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
                                A clear operational view of OpenAI cost, local AI savings,
                                provider activity, shard usage, and latest Worker runs.
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

                <QuickNav />

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

                <div className="grid gap-5">
                    <CostSection
                        last24Hours={dashboardData.last24Hours}
                        last7Days={dashboardData.last7Days}
                        last30Days={dashboardData.last30Days}
                    />

                    <TokenSection
                        last24Hours={dashboardData.last24Hours}
                        last7Days={dashboardData.last7Days}
                        last30Days={dashboardData.last30Days}
                        latestModel={latestModel}
                    />

                    <ActivityBreakdownSection last30Days={dashboardData.last30Days} />

                    <DailyUsageSection daily={dashboardData.daily} />

                    <ShardUsageSection shards={dashboardData.shards} />

                    <LatestWorkerRunsSection runs={dashboardData.latestRuns} />
                </div>
            </div>
        </main>
    );
}