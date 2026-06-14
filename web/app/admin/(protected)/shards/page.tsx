import Link from "next/link";
import { auth, signOut } from "@/auth";
import {
    type RecentShardRun,
    type ShardHealthRow,
    type ShardHealthStatus,
    getAdminShardHealthDashboardData,
} from "@/lib/adminShardHealth";

export const metadata = {
    title: "Worker Shards | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(Math.round(value));
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
    if (!value) {
        return "Never";
    }

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

function statusClasses(status: ShardHealthStatus) {
    if (status === "healthy") {
        return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
    }

    if (status === "warning") {
        return "border-orange-300/25 bg-orange-400/10 text-orange-100";
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
    children: React.ReactNode;
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
        ["Fleet Health", "#fleet-health"],
        ["Problem Shards", "#problem-shards"],
        ["Shard Table", "#shard-table"],
        ["Recent Runs", "#recent-runs"],
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

function ProblemShards({ shards }: { shards: ShardHealthRow[] }) {
    const problemShards = shards.filter((shard) => shard.status !== "healthy");

    return (
        <Section
            id="problem-shards"
            eyebrow="Problem Shards"
            title="Problem Shards"
            description="These are shards that are stale, missing, slow, not saving correctly, fetching zero articles, or have no feeds."
        >
            {problemShards.length === 0 ? (
                <div className="rounded-[1.35rem] border border-emerald-300/20 bg-emerald-400/10 p-5 text-sm text-emerald-100/85">
                    All shards look healthy right now.
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {problemShards.map((shard) => (
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
            description="One row per shard, showing freshness, feed coverage, fetch volume, publishing results, duration, and save status."
        >
            <div className="overflow-hidden rounded-[1.35rem] border border-amber-300/15">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-amber-300/10 text-left text-sm">
                        <thead className="bg-black/40 text-[10px] uppercase tracking-[0.16em] text-amber-300/75">
                        <tr>
                            <th className="px-4 py-3 font-black">Shard</th>
                            <th className="px-4 py-3 font-black">Status</th>
                            <th className="px-4 py-3 font-black">Last Run</th>
                            <th className="px-4 py-3 font-black">Age</th>
                            <th className="px-4 py-3 font-black">Runs</th>
                            <th className="px-4 py-3 font-black">Feeds</th>
                            <th className="px-4 py-3 font-black">Fetched</th>
                            <th className="px-4 py-3 font-black">Candidates</th>
                            <th className="px-4 py-3 font-black">Accepted</th>
                            <th className="px-4 py-3 font-black">Rejected</th>
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
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {formatDateTime(shard.lastRunAt)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {shard.minutesSinceLastRun === null
                                        ? "Never"
                                        : `${formatNumber(shard.minutesSinceLastRun)}m`}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {formatNumber(shard.runCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {formatNumber(shard.feedCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {formatNumber(shard.fetchedCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                    {formatNumber(shard.candidateCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-emerald-100/80">
                                    {formatNumber(shard.acceptedCount)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-red-100/80">
                                    {formatNumber(shard.rejectedCount)}
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
            title="Recent Worker Runs"
            description="The latest saved Worker run records across all shards."
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
                            <th className="px-4 py-3 font-black">Feeds</th>
                            <th className="px-4 py-3 font-black">Fetched</th>
                            <th className="px-4 py-3 font-black">Accepted</th>
                            <th className="px-4 py-3 font-black">Rejected</th>
                            <th className="px-4 py-3 font-black">AI Reviews</th>
                            <th className="px-4 py-3 font-black">Duration</th>
                            <th className="px-4 py-3 font-black">Saves</th>
                        </tr>
                        </thead>

                        <tbody className="divide-y divide-amber-300/10 bg-black/20">
                        {runs.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={11}
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
                                    <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                        {formatNumber(run.feedCount)}
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
                                    <td className="whitespace-nowrap px-4 py-3 text-amber-100/75">
                                        {formatNumber(run.aiReviewedCount)}
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
                                Worker Shard Health
                            </h1>

                            <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                                Monitor each Cloudflare Worker shard, including freshness, feed
                                coverage, fetch volume, accepted/rejected counts, run duration,
                                and problem shards.
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
                            Shard health data could not be loaded.
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-red-100/75">
                            {dashboardData.errorMessage}
                        </p>
                    </section>
                ) : null}

                <section
                    id="fleet-health"
                    className="mb-5 scroll-mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6"
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
                        helper="Slow, empty fetch, or save-warning shards."
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

                <section className="mb-5 grid gap-4 md:grid-cols-4">
                    <MetricCard
                        label="Latest Run"
                        value={formatDateTime(dashboardData.summary.latestRunAt)}
                        helper="Most recent saved Worker run."
                    />
                    <MetricCard
                        label="Total Fetched"
                        value={formatNumber(dashboardData.summary.totalFetched)}
                        helper="Fetched articles from latest shard rows."
                    />
                    <MetricCard
                        label="Accepted"
                        value={formatNumber(dashboardData.summary.totalAccepted)}
                        helper="Published accepted count from latest shard rows."
                    />
                    <MetricCard
                        label="Average Duration"
                        value={formatDuration(dashboardData.summary.averageDurationMs)}
                        helper="Average duration from saved runs."
                    />
                </section>

                <div className="grid gap-5">
                    <ProblemShards shards={dashboardData.shards} />
                    <ShardTable shards={dashboardData.shards} />
                    <RecentRunsTable runs={dashboardData.recentRuns} />
                </div>
            </div>
        </main>
    );
}