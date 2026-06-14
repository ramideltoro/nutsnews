import type { ReactNode } from "react";
import Link from "next/link";
import { formatAdminDateLabel, formatAdminDateTime } from "@/lib/adminTime";
import { auth, signOut } from "@/auth";
import {
    type RecentShardRun,
    type ShardHealthRow,
    type ShardHealthStatus,
    type WorkerHealthDailyPoint,
    getAdminShardHealthDashboardData,
} from "@/lib/adminShardHealth";

export const metadata = {
    title: "Worker Health | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatPercent(value: number) {
    return `${formatNumber(value)}%`;
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
    return formatAdminDateTime(value, "Never");
}

function formatDateLabel(value: string) {
    return formatAdminDateLabel(value);
}

function statusClasses(status: ShardHealthStatus) {
    if (status === "healthy") {
        return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
    }

    if (status === "warning") {
        return "border-orange-300/25 bg-orange-400/10 text-orange-100";
    }

    if (status === "failed") {
        return "border-red-300/35 bg-red-500/15 text-red-100";
    }

    if (status === "stale") {
        return "border-red-300/25 bg-red-400/10 text-red-100";
    }

    if (status === "no-feeds") {
        return "border-violet-300/25 bg-violet-400/10 text-violet-100";
    }

    return "border-neutral-300/20 bg-neutral-400/10 text-neutral-100";
}

function StatusPill({
                        status,
                        label,
                    }: {
    status: ShardHealthStatus;
    label: string;
}) {
    return (
        <span
            className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusClasses(
                status,
            )}`}
        >
      {label}
    </span>
    );
}

function MetricCard({
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
            <h3 className="mt-3 text-3xl font-black text-amber-50">{value}</h3>
            <p className="mt-2 text-sm leading-6 text-amber-100/60">{helper}</p>
        </div>
    );
}

function Section({
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
            <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                    {eyebrow}
                </p>
                <h2 className="mt-2 text-2xl font-black text-amber-50">{title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-100/60">
                    {description}
                </p>
            </div>

            {children}
        </section>
    );
}

function QuickNav() {
    const links = [
        ["Fleet", "#fleet-health"],
        ["Errors", "#error-counts"],
        ["Ingestion", "#ingestion-summary"],
        ["Trends", "#ingestion-trends"],
        ["Images", "#image-hydration"],
        ["Duration", "#duration-by-shard"],
        ["Failures", "#failed-shards"],
        ["Problems", "#problem-shards"],
        ["Shards", "#shard-table"],
        ["Runs", "#recent-runs"],
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

function DailyTrend({ daily }: { daily: WorkerHealthDailyPoint[] }) {
    const maxAccepted = Math.max(1, ...daily.map((point) => point.acceptedCount));

    return (
        <Section
            id="ingestion-trends"
            eyebrow="Ingestion Trends"
            title="Accepted, Rejected, Failures, and Thumbnail Rejections Over Time"
            description="A seven-day view of Worker ingestion activity, successful runs, failed runs, and content outcomes from saved run telemetry."
        >
            <div className="grid gap-3">
                {daily.map((point) => {
                    const widthPercent = Math.max(
                        4,
                        Math.round((point.acceptedCount / maxAccepted) * 100),
                    );

                    return (
                        <div
                            key={point.date}
                            className="rounded-[1.35rem] border border-amber-300/15 bg-black/30 p-4"
                        >
                            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-sm font-black text-amber-50">
                                        {formatDateLabel(point.date)}
                                    </p>
                                    <p className="mt-1 text-xs text-amber-100/55">
                                        {formatNumber(point.runCount)} runs ·{" "}
                                        {formatDuration(point.averageDurationMs)} avg duration
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2 text-xs text-amber-100/60">
                  <span className="rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-emerald-100/80">
                    Success: {formatNumber(point.successCount)}
                  </span>
                                    <span className="rounded-full border border-red-300/15 bg-red-400/10 px-3 py-1 text-red-100/80">
                    Failed: {formatNumber(point.failureCount)}
                  </span>
                                    <span className="rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-emerald-100/80">
                    Accepted: {formatNumber(point.acceptedCount)}
                  </span>
                                    <span className="rounded-full border border-red-300/15 bg-red-400/10 px-3 py-1 text-red-100/80">
                    Rejected: {formatNumber(point.rejectedCount)}
                  </span>
                                    <span className="rounded-full border border-orange-300/15 bg-orange-400/10 px-3 py-1 text-orange-100/80">
                    No thumbnail:{" "}
                                        {formatNumber(point.noThumbnailRejectedCount)}
                  </span>
                                    <span className="rounded-full border border-amber-300/15 bg-black/30 px-3 py-1">
                    Fetched: {formatNumber(point.fetchedCount)}
                  </span>
                                    <span className="rounded-full border border-amber-300/15 bg-black/30 px-3 py-1">
                    Images: {formatNumber(point.imageHydrationFoundCount)}
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
        </Section>
    );
}

function ImageHydrationSection({
                                   summary,
                                   daily,
                               }: {
    summary: {
        totalImageHydrationLookups: number;
        totalImageHydrationFound: number;
        imageHydrationRate: number;
        totalNoThumbnailRejected: number;
    };
    daily: WorkerHealthDailyPoint[];
}) {
    return (
        <Section
            id="image-hydration"
            eyebrow="Image Hydration"
            title="Image Hydration Health"
            description="Shows whether the Worker is successfully finding article images when RSS items do not provide a usable thumbnail."
        >
            <div className="grid gap-4 md:grid-cols-4">
                <MetricCard
                    label="Lookups"
                    value={formatNumber(summary.totalImageHydrationLookups)}
                    helper="Article-page image lookups from latest shard telemetry."
                />
                <MetricCard
                    label="Images Found"
                    value={formatNumber(summary.totalImageHydrationFound)}
                    helper="Images found through hydration."
                />
                <MetricCard
                    label="Hydration Rate"
                    value={formatPercent(summary.imageHydrationRate)}
                    helper="Found images divided by image lookup attempts."
                />
                <MetricCard
                    label="No Thumbnail Rejects"
                    value={formatNumber(summary.totalNoThumbnailRejected)}
                    helper="Articles rejected because no usable thumbnail was found."
                />
            </div>

            <div className="mt-4 overflow-hidden rounded-[1.35rem] border border-amber-300/15">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-amber-300/10 text-left text-sm">
                        <thead className="bg-black/40 text-[10px] uppercase tracking-[0.16em] text-amber-300/75">
                        <tr>
                            <th className="px-4 py-3 font-black">Date</th>
                            <th className="px-4 py-3 font-black">Lookups</th>
                            <th className="px-4 py-3 font-black">Found</th>
                            <th className="px-4 py-3 font-black">Rate</th>
                            <th className="px-4 py-3 font-black">No Thumbnail Rejects</th>
                        </tr>
                        </thead>

                        <tbody className="divide-y divide-amber-300/10 bg-black/20">
                        {daily.map((point) => (
                            <tr key={point.date}>
                                <td className="whitespace-nowrap px-4 py-3 font-black text-amber-50">
                                    {formatDateLabel(point.date)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {formatNumber(point.imageHydrationLookupCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {formatNumber(point.imageHydrationFoundCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {formatPercent(point.imageHydrationRate)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-orange-100/80">
                                    {formatNumber(point.noThumbnailRejectedCount)}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Section>
    );
}

function DurationByShard({ shards }: { shards: ShardHealthRow[] }) {
    return (
        <Section
            id="duration-by-shard"
            eyebrow="Duration by Shard"
            title="Slowest Shards"
            description="Highlights shards with the highest latest duration so slow ingestion can be spotted quickly."
        >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {shards.length === 0 ? (
                    <div className="rounded-[1.35rem] border border-amber-300/15 bg-black/30 p-4 text-sm text-amber-100/65">
                        No shard duration data yet.
                    </div>
                ) : (
                    shards.map((shard) => (
                        <div
                            key={shard.shardIndex}
                            className="rounded-[1.35rem] border border-amber-300/15 bg-black/30 p-4"
                        >
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h3 className="text-lg font-black text-amber-50">
                                    Shard {shard.shardIndex}
                                </h3>
                                <StatusPill
                                    status={shard.status}
                                    label={shard.statusLabel}
                                />
                            </div>

                            <p className="text-3xl font-black text-amber-50">
                                {formatDuration(shard.durationMs)}
                            </p>
                            <p className="mt-2 text-sm text-amber-100/60">
                                Avg: {formatDuration(shard.averageDurationMs)} · Max:{" "}
                                {formatDuration(shard.maxDurationMs)}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </Section>
    );
}

function FailedShards({ shards }: { shards: ShardHealthRow[] }) {
    return (
        <Section
            id="failed-shards"
            eyebrow="Failed Shards"
            title="Failed Shards"
            description="Shows shards whose latest saved Worker execution failed, including the latest error, total error count, and consecutive failure count."
        >
            {shards.length === 0 ? (
                <div className="rounded-[1.35rem] border border-emerald-300/20 bg-emerald-400/10 p-5 text-sm text-emerald-100/85">
                    No failed shards right now.
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {shards.map((shard) => (
                        <div
                            key={shard.shardIndex}
                            className="rounded-[1.35rem] border border-red-300/20 bg-red-500/10 p-4"
                        >
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h3 className="text-lg font-black text-red-50">
                                    Shard {shard.shardIndex}
                                </h3>
                                <StatusPill status="failed" label="Failed" />
                            </div>

                            <p className="text-sm leading-6 text-red-100/80">
                                {shard.latestErrorMessage || shard.reason}
                            </p>

                            <div className="mt-4 grid gap-2 text-xs text-red-100/70">
                                <p>Latest error: {shard.latestErrorName || "Unknown"}</p>
                                <p>
                                    Consecutive failures: {formatNumber(shard.consecutiveFailureCount)}
                                </p>
                                <p>Total failures: {formatNumber(shard.failureCount)}</p>
                                <p>Last run: {formatDateTime(shard.lastRunAt)}</p>
                                <p>
                                    Last successful run: {formatDateTime(shard.lastSuccessfulRunAt)}
                                </p>
                                <p>Duration: {formatDuration(shard.durationMs)}</p>
                                <p>
                                    Consecutive failures: {formatNumber(shard.consecutiveFailureCount)}
                                </p>
                                {shard.latestErrorMessage ? (
                                    <p>Latest error: {shard.latestErrorMessage}</p>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Section>
    );
}

function ProblemShards({ shards }: { shards: ShardHealthRow[] }) {
    return (
        <Section
            id="problem-shards"
            eyebrow="Problem Shards"
            title="Problem Shards"
            description="These are shards that failed, are stale, missing, slow, not saving correctly, fetching zero articles, missing images, or have no feeds."
        >
            {shards.length === 0 ? (
                <div className="rounded-[1.35rem] border border-emerald-300/20 bg-emerald-400/10 p-5 text-sm text-emerald-100/85">
                    All shards look healthy right now.
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {shards.map((shard) => (
                        <div
                            key={shard.shardIndex}
                            className="rounded-[1.35rem] border border-amber-300/15 bg-black/30 p-4"
                        >
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h3 className="text-lg font-black text-amber-50">
                                    Shard {shard.shardIndex}
                                </h3>
                                <StatusPill
                                    status={shard.status}
                                    label={shard.statusLabel}
                                />
                            </div>

                            <p className="text-sm leading-6 text-amber-100/65">
                                {shard.reason}
                            </p>

                            <div className="mt-4 grid gap-2 text-xs text-amber-100/60">
                                <p>Last run: {formatDateTime(shard.lastRunAt)}</p>
                                <p>Feed count: {formatNumber(shard.feedCount)}</p>
                                <p>Fetched: {formatNumber(shard.fetchedCount)}</p>
                                <p>Accepted: {formatNumber(shard.acceptedCount)}</p>
                                <p>Duration: {formatDuration(shard.durationMs)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Section>
    );
}

function ShardTable({ shards }: { shards: ShardHealthRow[] }) {
    return (
        <Section
            id="shard-table"
            eyebrow="Shard Table"
            title="Shard Status Table"
            description="One row per shard, showing freshness, failures, latest error, feed coverage, fetch volume, publishing results, image hydration, duration, and save status."
        >
            <div className="overflow-hidden rounded-[1.35rem] border border-amber-300/15">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-amber-300/10 text-left text-sm">
                        <thead className="bg-black/40 text-[10px] uppercase tracking-[0.16em] text-amber-300/75">
                        <tr>
                            <th className="px-4 py-3 font-black">Shard</th>
                            <th className="px-4 py-3 font-black">Status</th>
                            <th className="px-4 py-3 font-black">Error Count</th>
                            <th className="px-4 py-3 font-black">Consecutive</th>
                            <th className="px-4 py-3 font-black">Latest Error</th>
                            <th className="px-4 py-3 font-black">Last Run</th>
                            <th className="px-4 py-3 font-black">Age</th>
                            <th className="px-4 py-3 font-black">Feeds</th>
                            <th className="px-4 py-3 font-black">Fetched</th>
                            <th className="px-4 py-3 font-black">Accepted</th>
                            <th className="px-4 py-3 font-black">Rejected</th>
                            <th className="px-4 py-3 font-black">No Thumb</th>
                            <th className="px-4 py-3 font-black">Images</th>
                            <th className="px-4 py-3 font-black">AI Reviews</th>
                            <th className="px-4 py-3 font-black">Duration</th>
                            <th className="px-4 py-3 font-black">Saves</th>
                        </tr>
                        </thead>

                        <tbody className="divide-y divide-amber-300/10 bg-black/20">
                        {shards.map((shard) => (
                            <tr key={shard.shardIndex}>
                                <td className="whitespace-nowrap px-4 py-3 font-black text-amber-50">
                                    {shard.shardIndex}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                    <StatusPill
                                        status={shard.status}
                                        label={shard.statusLabel}
                                    />
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-red-100/80">
                                    {formatNumber(shard.failureCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-red-100/80">
                                    {formatNumber(shard.consecutiveFailureCount)}
                                </td>
                                <td className="max-w-xs truncate px-4 py-3 text-amber-100/70">
                                    {shard.latestErrorMessage || "—"}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {formatDateTime(shard.lastRunAt)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {shard.minutesSinceLastRun === null
                                        ? "Never"
                                        : `${formatNumber(shard.minutesSinceLastRun)}m`}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {formatNumber(shard.feedCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {formatNumber(shard.fetchedCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-emerald-100/80">
                                    {formatNumber(shard.acceptedCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-red-100/80">
                                    {formatNumber(shard.rejectedCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-orange-100/80">
                                    {formatNumber(shard.noThumbnailRejectedCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {formatNumber(shard.imageHydrationFoundCount)} /{" "}
                                    {formatNumber(shard.imageHydrationLookupCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {formatNumber(shard.aiReviewedCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {formatDuration(shard.durationMs)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                    {shard.reviewSaveOk && shard.articleSaveOk ? (
                                        <StatusPill status="healthy" label="OK" />
                                    ) : (
                                        <StatusPill status="warning" label="Watch" />
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Section>
    );
}

function RecentRunsTable({ runs }: { runs: RecentShardRun[] }) {
    return (
        <Section
            id="recent-runs"
            eyebrow="Recent Runs"
            title="Recent Worker Refresh Events"
            description="The latest saved Worker execution rows across all shards, including successful refreshes and failed executions."
        >
            <div className="overflow-hidden rounded-[1.35rem] border border-amber-300/15">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-amber-300/10 text-left text-sm">
                        <thead className="bg-black/40 text-[10px] uppercase tracking-[0.16em] text-amber-300/75">
                        <tr>
                            <th className="px-4 py-3 font-black">Time</th>
                            <th className="px-4 py-3 font-black">Source</th>
                            <th className="px-4 py-3 font-black">Shard</th>
                            <th className="px-4 py-3 font-black">Status</th>
                            <th className="px-4 py-3 font-black">Error Message</th>
                            <th className="px-4 py-3 font-black">Fetched</th>
                            <th className="px-4 py-3 font-black">Accepted</th>
                            <th className="px-4 py-3 font-black">Rejected</th>
                            <th className="px-4 py-3 font-black">No Thumb</th>
                            <th className="px-4 py-3 font-black">Images</th>
                            <th className="px-4 py-3 font-black">Duration</th>
                            <th className="px-4 py-3 font-black">Saves</th>
                        </tr>
                        </thead>

                        <tbody className="divide-y divide-amber-300/10 bg-black/20">
                        {runs.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={12}
                                    className="px-4 py-5 text-center text-amber-100/65"
                                >
                                    No Worker runs found yet.
                                </td>
                            </tr>
                        ) : (
                            runs.map((run) => (
                                <tr key={run.id}>
                                    <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                        {formatDateTime(run.runStartedAt)}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                        {run.runSource}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 font-black text-amber-50">
                                        {run.shardIndex}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3">
                                        <StatusPill
                                            status={run.status}
                                            label={run.statusLabel}
                                        />
                                    </td>
                                    <td className="max-w-xs truncate px-4 py-3 text-amber-100/70">
                                        {run.errorMessage || run.errorName || "—"}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                        {formatNumber(run.fetchedCount)}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-emerald-100/80">
                                        {formatNumber(run.acceptedCount)}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-red-100/80">
                                        {formatNumber(run.rejectedCount)}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-orange-100/80">
                                        {formatNumber(run.noThumbnailRejectedCount)}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                        {formatNumber(run.imageHydrationFoundCount)} /{" "}
                                        {formatNumber(run.imageHydrationLookupCount)}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                        {formatDuration(run.durationMs)}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3">
                                        {run.reviewSaveOk && run.articleSaveOk ? (
                                            <StatusPill status="healthy" label="OK" />
                                        ) : (
                                            <StatusPill status="warning" label="Watch" />
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Section>
    );
}

export default async function AdminShardsPage() {
    const session = await auth();
    const dashboardData = await getAdminShardHealthDashboardData();

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
                                Worker Health
                            </h1>

                            <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                                Monitor Worker ingestion health, accepted articles, rejected
                                articles, thumbnail rejections, image hydration, shard duration,
                                failed executions, stale shards, and recent refresh events.
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
                            Worker health data could not be loaded.
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-red-100/75">
                            {dashboardData.errorMessage}
                        </p>
                    </section>
                ) : null}

                <section
                    id="fleet-health"
                    className="mb-5 scroll-mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-7"
                >
                    <MetricCard
                        label="Total Shards"
                        value={formatNumber(dashboardData.summary.totalShards)}
                        helper="Configured shard count."
                    />
                    <MetricCard
                        label="Healthy"
                        value={formatNumber(dashboardData.summary.healthyShards)}
                        helper="Recent and active shards."
                    />
                    <MetricCard
                        label="Warnings"
                        value={formatNumber(dashboardData.summary.warningShards)}
                        helper="Slow, empty fetch, image, or save-warning shards."
                    />
                    <MetricCard
                        label="Failed"
                        value={formatNumber(dashboardData.summary.failedShards)}
                        helper={`${formatNumber(dashboardData.summary.totalConsecutiveFailures)} consecutive failures.`}
                    />
                    <MetricCard
                        label="Stale"
                        value={formatNumber(dashboardData.summary.staleShards)}
                        helper={`No run in ${formatNumber(
                            dashboardData.staleAfterMinutes,
                        )}+ minutes.`}
                    />
                    <MetricCard
                        label="No Feeds"
                        value={formatNumber(dashboardData.summary.noFeedShards)}
                        helper="Shards with zero feeds."
                    />
                    <MetricCard
                        label="Missing"
                        value={formatNumber(dashboardData.summary.missingShards)}
                        helper="Shards with no saved run."
                    />
                </section>

                <Section
                    id="error-counts"
                    eyebrow="Error Counts"
                    title="Worker Error Counts"
                    description="Shows failed Worker executions as first-class records from worker_runs, including failed shards, failed runs, consecutive failures, and latest failure time."
                >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <MetricCard
                            label="Failed Shards"
                            value={formatNumber(dashboardData.summary.failedShards)}
                            helper="Shards whose latest saved run failed."
                        />
                        <MetricCard
                            label="Failed Runs"
                            value={formatNumber(dashboardData.summary.totalFailedRuns)}
                            helper="Total failed Worker executions in the loaded run window."
                        />
                        <MetricCard
                            label="Consecutive Failures"
                            value={formatNumber(dashboardData.summary.totalConsecutiveFailures)}
                            helper="Current consecutive failures across all shards."
                        />
                        <MetricCard
                            label="Successful Runs"
                            value={formatNumber(dashboardData.summary.totalSuccessfulRuns)}
                            helper="Total successful Worker executions in the loaded run window."
                        />
                        <MetricCard
                            label="Latest Failure"
                            value={formatDateTime(dashboardData.summary.latestFailureAt)}
                            helper="Most recent failed Worker execution."
                        />
                    </div>
                </Section>

                <Section
                    id="ingestion-summary"
                    eyebrow="Ingestion Summary"
                    title="Worker Ingestion Summary"
                    description="Answers whether articles are being accepted, rejected, fetched, and processed correctly."
                >
                    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-8">
                        <MetricCard
                            label="Successful Runs"
                            value={formatNumber(dashboardData.summary.totalSuccessfulRuns)}
                            helper="Saved successful Worker runs."
                        />
                        <MetricCard
                            label="Failed Runs"
                            value={formatNumber(dashboardData.summary.totalFailedRuns)}
                            helper="Saved failed Worker executions."
                        />
                        <MetricCard
                            label="Fetched"
                            value={formatNumber(dashboardData.summary.totalFetched)}
                            helper="Fetched articles from latest shard rows."
                        />
                        <MetricCard
                            label="Candidates"
                            value={formatNumber(dashboardData.summary.totalCandidates)}
                            helper="Candidate articles after fetch limits."
                        />
                        <MetricCard
                            label="Accepted"
                            value={formatNumber(dashboardData.summary.totalAccepted)}
                            helper={`${formatPercent(
                                dashboardData.summary.acceptanceRate,
                            )} acceptance rate.`}
                        />
                        <MetricCard
                            label="Rejected"
                            value={formatNumber(dashboardData.summary.totalRejected)}
                            helper="Rejected articles from latest shard rows."
                        />
                        <MetricCard
                            label="No Thumbnail"
                            value={formatNumber(
                                dashboardData.summary.totalNoThumbnailRejected,
                            )}
                            helper="Rejected due to missing usable thumbnails."
                        />
                        <MetricCard
                            label="Avg Duration"
                            value={formatDuration(dashboardData.summary.averageDurationMs)}
                            helper="Average duration from saved runs."
                        />
                    </div>
                </Section>

                <div className="mt-5 grid gap-5">
                    <DailyTrend daily={dashboardData.daily} />

                    <ImageHydrationSection
                        summary={dashboardData.summary}
                        daily={dashboardData.daily}
                    />

                    <DurationByShard shards={dashboardData.slowestShards} />

                    <FailedShards shards={dashboardData.failedShards} />

                    <ProblemShards shards={dashboardData.problemShards} />

                    <ShardTable shards={dashboardData.shards} />

                    <RecentRunsTable runs={dashboardData.recentRuns} />
                </div>
            </div>
        </main>
    );
}