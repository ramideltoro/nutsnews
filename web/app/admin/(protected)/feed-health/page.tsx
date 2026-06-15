import type { ReactNode } from "react";
import Link from "next/link";
import {
    type FeedHealthRow,
    type FeedHealthStatus,
    formatFeedDateTime,
    getAdminFeedHealthDashboardData,
} from "@/lib/adminFeedHealth";

export const metadata = {
    title: "RSS Feed Health | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatPercent(value: number) {
    return `${formatNumber(value)}%`;
}

function truncate(value: string, maxLength = 120) {
    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength)}…`;
}

function statusClasses(status: FeedHealthStatus) {
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
        return "border-yellow-300/25 bg-yellow-400/10 text-yellow-100";
    }

    if (status === "disabled") {
        return "border-neutral-300/20 bg-neutral-400/10 text-neutral-100";
    }

    return "border-violet-300/25 bg-violet-400/10 text-violet-100";
}

function StatusPill({ status, label }: { status: FeedHealthStatus; label: string }) {
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
        ["Summary", "#summary"],
        ["Weak", "#weak-feeds"],
        ["Best", "#best-feeds"],
        ["All", "#all-feeds"],
        ["Disable SQL", "#disable-sql"],
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

function FeedCard({ feed, compact = false }: { feed: FeedHealthRow; compact?: boolean }) {
    return (
        <article className="rounded-[1.6rem] border border-amber-300/15 bg-black/30 p-4 shadow-lg shadow-amber-950/10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                        <StatusPill status={feed.status} label={feed.statusLabel} />
                        <span className="rounded-full border border-amber-300/15 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100/75">
              {feed.isActive ? "Active" : "Inactive"}
            </span>
                    </div>
                    <h3 className="break-words text-lg font-black text-amber-50">
                        {feed.source}
                    </h3>
                    <p className="mt-1 break-all text-xs leading-5 text-amber-100/45">
                        {feed.feedUrl}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-amber-100/65">
                        {feed.reason}
                    </p>
                    {feed.lastErrorMessage ? (
                        <p className="mt-2 rounded-2xl border border-red-300/15 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100/80">
                            {truncate(feed.lastErrorMessage, compact ? 110 : 220)}
                        </p>
                    ) : null}
                </div>

                <div className="grid min-w-64 grid-cols-2 gap-2 text-xs text-amber-100/65 sm:grid-cols-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-amber-300/10 bg-black/25 p-3">
                        <p className="text-amber-300/60">Success</p>
                        <p className="mt-1 font-black text-amber-50">{formatPercent(feed.successRate)}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-300/10 bg-black/25 p-3">
                        <p className="text-amber-300/60">Images</p>
                        <p className="mt-1 font-black text-amber-50">{formatPercent(feed.imageRate)}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-300/10 bg-black/25 p-3">
                        <p className="text-amber-300/60">Accepted</p>
                        <p className="mt-1 font-black text-amber-50">{formatNumber(feed.totalAcceptedCount)}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-300/10 bg-black/25 p-3">
                        <p className="text-amber-300/60">Failures</p>
                        <p className="mt-1 font-black text-amber-50">{formatNumber(feed.consecutiveFailureCount)}</p>
                    </div>
                </div>
            </div>

            {!compact ? (
                <div className="mt-4 grid gap-2 border-t border-amber-300/10 pt-4 text-xs text-amber-100/55 sm:grid-cols-2 lg:grid-cols-4">
                    <p>Last checked: <span className="text-amber-50">{formatFeedDateTime(feed.lastCheckedAt)}</span></p>
                    <p>Last success: <span className="text-amber-50">{formatFeedDateTime(feed.lastSuccessAt)}</span></p>
                    <p>Last status: <span className="text-amber-50">{feed.lastStatus ?? "n/a"}</span></p>
                    <p>Total checks: <span className="text-amber-50">{formatNumber(feed.totalFetchCount)}</span></p>
                    <p>Last articles: <span className="text-amber-50">{formatNumber(feed.lastArticleCount)}</span></p>
                    <p>Last images: <span className="text-amber-50">{formatNumber(feed.lastImageCount)}</span></p>
                    <p>Total articles: <span className="text-amber-50">{formatNumber(feed.totalArticleCount)}</span></p>
                    <p>Total rejected: <span className="text-amber-50">{formatNumber(feed.totalRejectedCount)}</span></p>
                </div>
            ) : null}
        </article>
    );
}

function FeedList({ feeds, emptyMessage, compact = false }: { feeds: FeedHealthRow[]; emptyMessage: string; compact?: boolean }) {
    if (feeds.length === 0) {
        return (
            <div className="rounded-[1.5rem] border border-emerald-300/20 bg-emerald-400/10 p-5 text-sm leading-6 text-emerald-100/80">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="grid gap-3">
            {feeds.map((feed) => (
                <FeedCard key={feed.feedUrl} feed={feed} compact={compact} />
            ))}
        </div>
    );
}

export default async function FeedHealthPage() {
    const data = await getAdminFeedHealthDashboardData();

    if (!data.isConfigured) {
        return (
            <main className="min-h-screen bg-[#0a0a0a] px-4 py-6 text-amber-50 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-5xl rounded-[2rem] border border-red-300/25 bg-red-500/10 p-6 shadow-xl shadow-red-950/20">
                    <h1 className="text-3xl font-black text-red-100">RSS Feed Health Unavailable</h1>
                    <p className="mt-3 text-sm leading-6 text-red-100/75">{data.errorMessage}</p>
                    <Link href="/admin" className="mt-5 inline-flex rounded-full border border-amber-300/25 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-100">
                        Back to admin
                    </Link>
                </div>
            </main>
        );
    }

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
                            <Link href="/admin" className="mb-4 inline-flex rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100 transition hover:border-amber-300/50">
                                ← Admin
                            </Link>
                            <h1 className="text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">
                                RSS Feed Health
                            </h1>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                                Track which RSS feeds fetch successfully, produce thumbnails, generate accepted articles, repeatedly fail, or should be disabled directly from Supabase without code changes.
                            </p>
                        </div>

                        <div className="rounded-[1.45rem] border border-amber-300/15 bg-black/30 p-4 text-left md:min-w-72">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/80">
                                Generated
                            </p>
                            <p className="mt-2 text-sm font-semibold text-amber-50">
                                {formatFeedDateTime(data.generatedAt)}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-amber-100/55">
                                Feeds are considered stale after {data.staleAfterHours} hours without a Worker check.
                            </p>
                        </div>
                    </div>
                </header>

                <QuickNav />

                <section id="summary" className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Total Feeds" value={formatNumber(data.summary.totalFeeds)} helper={`${formatNumber(data.summary.activeFeeds)} active · ${formatNumber(data.summary.disabledFeeds)} disabled`} />
                    <MetricCard label="Weak Feeds" value={formatNumber(data.weakFeeds.length)} helper="Failing, stale, untracked, or low-quality feeds needing review." />
                    <MetricCard label="Success Rate" value={formatPercent(data.summary.successRate)} helper={`${formatNumber(data.summary.totalSuccessCount)} successful checks out of ${formatNumber(data.summary.totalFetchCount)} total checks.`} />
                    <MetricCard label="Accepted Articles" value={formatNumber(data.summary.totalAcceptedCount)} helper={`${formatPercent(data.summary.acceptanceRate)} acceptance rate from reviewed feed outcomes.`} />
                </section>

                <div className="grid gap-5">
                    <Section id="weak-feeds" eyebrow="Feed Quality" title="Weak Feeds to Review" description="Feeds listed here are repeatedly failing, stale, untracked, low image quality, or not producing accepted stories. Disable the worst ones in Supabase by setting rss_feeds.is_active=false.">
                        <FeedList feeds={data.weakFeeds} emptyMessage="No weak feeds detected right now." />
                    </Section>

                    <Section id="best-feeds" eyebrow="Best Sources" title="Best Performing Feeds" description="Feeds ranked by accepted articles, image coverage, success rate, and overall source quality. These are the feeds worth prioritizing when expanding shards.">
                        <FeedList feeds={data.bestFeeds} emptyMessage="No tracked feed performance yet. Run the Worker after applying the migration." compact />
                    </Section>

                    <Section id="all-feeds" eyebrow="All Sources" title="Full Feed Health Table" description="Complete operational view of every active or inactive RSS feed, including checks, failures, images, accepted articles, and current status.">
                        <div className="overflow-hidden rounded-[1.5rem] border border-amber-300/15">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-amber-300/10 text-left text-xs">
                                    <thead className="bg-black/40 text-amber-300/80">
                                    <tr>
                                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Feed</th>
                                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Status</th>
                                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Success</th>
                                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Images</th>
                                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Accepted</th>
                                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Failures</th>
                                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Last Check</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-amber-300/10 bg-black/20 text-amber-100/65">
                                    {data.feeds.map((feed) => (
                                        <tr key={feed.feedUrl} className="align-top">
                                            <td className="px-4 py-3">
                                                <p className="font-black text-amber-50">{feed.source}</p>
                                                <p className="mt-1 max-w-80 break-all text-amber-100/40">{feed.feedUrl}</p>
                                            </td>
                                            <td className="px-4 py-3"><StatusPill status={feed.status} label={feed.statusLabel} /></td>
                                            <td className="px-4 py-3 text-amber-50">{formatPercent(feed.successRate)}</td>
                                            <td className="px-4 py-3 text-amber-50">{formatPercent(feed.imageRate)}</td>
                                            <td className="px-4 py-3 text-amber-50">{formatNumber(feed.totalAcceptedCount)}</td>
                                            <td className="px-4 py-3 text-amber-50">{formatNumber(feed.consecutiveFailureCount)}</td>
                                            <td className="px-4 py-3 text-amber-50">{formatFeedDateTime(feed.lastCheckedAt)}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Section>

                    <Section id="disable-sql" eyebrow="Supabase Action" title="Disable Weak Feeds Without Code Changes" description="Copy this SQL into Supabase SQL Editor to deactivate weak active feeds. The Worker already filters rss_feeds where is_active=true, so no deploy is required after this update.">
                        <pre className="overflow-x-auto rounded-[1.5rem] border border-amber-300/15 bg-black/45 p-4 text-xs leading-6 text-amber-100/75">
                            <code>{data.disableWeakFeedsSql}</code>
                        </pre>
                    </Section>
                </div>
            </div>
        </main>
    );
}
