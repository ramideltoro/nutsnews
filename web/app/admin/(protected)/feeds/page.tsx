import type { ReactNode } from "react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type FeedManagementStatus,
  type FeedQualityGrade,
  type ManagedFeed,
  formatFeedManagementDateTime,
  getAdminFeedManagementDashboardData,
  setAdminRssFeedActiveStatus,
} from "@/lib/adminFeedManagement";

export const metadata = {
  title: "Feed Management | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FeedManagementPageProps = {
  searchParams?: Promise<{
    updated?: string | string[];
    error?: string | string[];
  }>;
};

function getSingleSearchValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function toggleFeedAction(formData: FormData) {
  "use server";

  const feedUrl = String(formData.get("feedUrl") ?? "");
  const nextActive = String(formData.get("nextActive") ?? "false") === "true";

  if (!feedUrl) {
    redirect("/admin/feeds?error=Missing%20feed%20URL");
  }

  const result = await setAdminRssFeedActiveStatus({
    feedUrl,
    isActive: nextActive,
  });

  revalidatePath("/admin/feeds");
  revalidatePath("/admin/feed-health");

  if (!result.ok) {
    redirect(`/admin/feeds?error=${encodeURIComponent(result.message)}`);
  }

  redirect(`/admin/feeds?updated=${encodeURIComponent(result.message)}`);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatPercent(value: number) {
  return `${formatNumber(value)}%`;
}

function truncate(value: string, maxLength = 110) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
}

function statusClasses(status: FeedManagementStatus) {
  if (status === "active") {
    return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  }

  if (status === "inactive") {
    return "border-neutral-300/20 bg-neutral-400/10 text-neutral-100";
  }

  if (status === "failing") {
    return "border-red-300/35 bg-red-500/15 text-red-100";
  }

  if (status === "weak") {
    return "border-orange-300/25 bg-orange-400/10 text-orange-100";
  }

  return "border-violet-300/25 bg-violet-400/10 text-violet-100";
}

function qualityClasses(grade: FeedQualityGrade) {
  if (grade === "excellent") {
    return "border-emerald-300/30 bg-emerald-400/15 text-emerald-100";
  }

  if (grade === "good") {
    return "border-lime-300/25 bg-lime-400/10 text-lime-100";
  }

  if (grade === "review") {
    return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  }

  if (grade === "poor") {
    return "border-red-300/35 bg-red-500/15 text-red-100";
  }

  if (grade === "inactive") {
    return "border-neutral-300/20 bg-neutral-400/10 text-neutral-100";
  }

  return "border-violet-300/25 bg-violet-400/10 text-violet-100";
}

function StatusPill({ status, label }: { status: FeedManagementStatus; label: string }) {
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

function QualityScorePill({ feed }: { feed: ManagedFeed }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${qualityClasses(
        feed.qualityGrade,
      )}`}
      title={feed.qualityReason}
    >
      Quality {formatNumber(feed.qualityScore)}/100 · {feed.qualityLabel}
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
    ["Quality", "#quality-review"],
    ["Best", "#best-quality"],
    ["Manage", "#manage-feeds"],
    ["Disable", "#recommended-disable"],
    ["Inactive", "#inactive-feeds"],
    ["SQL", "#quality-sql"],
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

function Alert({ type, message }: { type: "success" | "error"; message: string }) {
  const classes =
    type === "success"
      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
      : "border-red-300/25 bg-red-500/10 text-red-100";

  return (
    <div className={`mb-5 rounded-[1.5rem] border p-4 text-sm leading-6 ${classes}`}>
      {message}
    </div>
  );
}

function ToggleFeedButton({ feed }: { feed: ManagedFeed }) {
  return (
    <form action={toggleFeedAction}>
      <input type="hidden" name="feedUrl" value={feed.url} />
      <input type="hidden" name="nextActive" value={feed.isActive ? "false" : "true"} />
      <button
        type="submit"
        className={`rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
          feed.isActive
            ? "border-red-300/25 bg-red-500/10 text-red-100 hover:border-red-300/50"
            : "border-emerald-300/25 bg-emerald-400/10 text-emerald-100 hover:border-emerald-300/50"
        }`}
      >
        {feed.isActive ? "Disable" : "Enable"}
      </button>
    </form>
  );
}

function FeedManagementCard({ feed }: { feed: ManagedFeed }) {
  return (
    <article className="rounded-[1.6rem] border border-amber-300/15 bg-black/30 p-4 shadow-lg shadow-amber-950/10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusPill status={feed.status} label={feed.statusLabel} />
            <QualityScorePill feed={feed} />
            <span className="rounded-full border border-amber-300/15 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100/75">
              DB is_active: {feed.rawIsActiveValue}
            </span>
            <span className="rounded-full border border-sky-300/15 bg-sky-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-sky-100/85">
              {feed.isPositiveSource ? "Positive source" : "General source"}
            </span>
          </div>

          <h3 className="break-words text-lg font-black text-amber-50">{feed.source}</h3>
          <p className="mt-1 break-all text-xs leading-5 text-amber-100/45">{feed.url}</p>
          <p className="mt-3 text-sm leading-6 text-amber-100/65">{feed.reason}</p>
          <p className="mt-2 text-xs leading-5 text-amber-100/50">
            Quality reason: <span className="text-amber-50">{feed.qualityReason}</span>
          </p>

          {feed.lastErrorMessage ? (
            <p className="mt-2 rounded-2xl border border-red-300/15 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100/80">
              {truncate(feed.lastErrorMessage, 220)}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-3 lg:items-end">
          <ToggleFeedButton feed={feed} />
          <Link
            href="/admin/feed-health"
            className="rounded-full border border-amber-300/20 bg-black/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/10"
          >
            Health Details
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-2 border-t border-amber-300/10 pt-4 text-xs text-amber-100/55 sm:grid-cols-2 lg:grid-cols-4">
        <p>Quality: <span className="text-amber-50">{formatNumber(feed.qualityScore)}/100</span></p>
        <p>Grade: <span className="text-amber-50">{feed.qualityLabel}</span></p>
        <p>Success: <span className="text-amber-50">{formatPercent(feed.successRate)}</span></p>
        <p>Images: <span className="text-amber-50">{formatPercent(feed.imageRate)}</span></p>
        <p>Accepted rate: <span className="text-amber-50">{formatPercent(feed.acceptanceRate)}</span></p>
        <p>Failure rate: <span className="text-amber-50">{formatPercent(feed.failureRate)}</span></p>
        <p>Duplicate rate: <span className="text-amber-50">{formatPercent(feed.duplicateRate)}</span></p>
        <p>Accepted: <span className="text-amber-50">{formatNumber(feed.totalAcceptedCount)}</span></p>
        <p>Rejected: <span className="text-amber-50">{formatNumber(feed.totalRejectedCount)}</span></p>
        <p>Unique reviewed: <span className="text-amber-50">{formatNumber(feed.uniqueReviewedUrlCount)}</span></p>
        <p>Last checked: <span className="text-amber-50">{formatFeedManagementDateTime(feed.lastCheckedAt)}</span></p>
        <p>Last status: <span className="text-amber-50">{feed.lastStatus ?? "n/a"}</span></p>
        <p>Last articles: <span className="text-amber-50">{formatNumber(feed.lastArticleCount)}</span></p>
        <p>Failures: <span className="text-amber-50">{formatNumber(feed.consecutiveFailureCount)}</span></p>
        <p>DB active flag: <span className="text-amber-50">{feed.rawIsActiveValue}</span></p>
        <p>DB positive flag: <span className="text-amber-50">{feed.rawIsPositiveSourceValue}</span></p>
      </div>
    </article>
  );
}

function FeedList({ feeds, emptyMessage }: { feeds: ManagedFeed[]; emptyMessage: string }) {
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
        <FeedManagementCard key={feed.url} feed={feed} />
      ))}
    </div>
  );
}

export default async function FeedManagementPage({ searchParams }: FeedManagementPageProps) {
  const resolvedSearchParams = await searchParams;
  const updatedMessage = getSingleSearchValue(resolvedSearchParams?.updated);
  const errorMessage = getSingleSearchValue(resolvedSearchParams?.error);
  const data = await getAdminFeedManagementDashboardData();

  if (!data.isConfigured) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] px-4 py-6 text-amber-50 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-red-300/25 bg-red-500/10 p-6 shadow-xl shadow-red-950/20">
          <h1 className="text-3xl font-black text-red-100">Feed Management Unavailable</h1>
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
                Feed Management
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                Manage RSS sources without a code deploy. Review active status, positive-source flags, health metrics, quality scores, and safely enable or disable feeds from the private admin portal.
              </p>
            </div>

            <div className="rounded-[1.45rem] border border-amber-300/15 bg-black/30 p-4 text-left md:min-w-72">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/80">
                Generated
              </p>
              <p className="mt-2 text-sm font-semibold text-amber-50">
                {formatFeedManagementDateTime(data.generatedAt)}
              </p>
              <p className="mt-2 text-xs leading-5 text-amber-100/55">
                Quality scores come from Supabase `feed_quality_scores` and rank feeds from 0 to 100.
              </p>
            </div>
          </div>
        </header>

        {updatedMessage ? <Alert type="success" message={updatedMessage} /> : null}
        {errorMessage ? <Alert type="error" message={errorMessage} /> : null}

        <QuickNav />

        <section id="summary" className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Feeds" value={formatNumber(data.summary.totalFeeds)} helper={`${formatNumber(data.summary.activeFeeds)} active · ${formatNumber(data.summary.inactiveFeeds)} inactive`} />
          <MetricCard label="Avg Quality" value={`${formatNumber(data.summary.averageQualityScore)}/100`} helper={`${formatNumber(data.summary.excellentFeeds + data.summary.goodFeeds)} excellent/good feeds · ${formatNumber(data.summary.poorFeeds)} poor feeds.`} />
          <MetricCard label="Weak or Failing" value={formatNumber(data.summary.failingFeeds + data.summary.weakFeeds)} helper="Feeds that may need disabling or replacement." />
          <MetricCard label="Accepted Articles" value={formatNumber(data.summary.totalAcceptedCount)} helper={`${formatPercent(data.summary.acceptanceRate)} acceptance rate · ${formatPercent(data.summary.duplicateRate)} duplicate/already-seen rate.`} />
        </section>

        <div className="grid gap-5">
          <Section id="quality-review" eyebrow="Source Quality" title="Lowest Quality Scores" description="Feeds listed here have poor or review-level quality scores based on success, thumbnails, accepted output, failures, and duplicate or already-seen signals.">
            <FeedList feeds={data.lowQualityFeeds} emptyMessage="No low-quality active feeds detected right now." />
          </Section>

          <Section id="best-quality" eyebrow="Best Sources" title="Highest Quality Scores" description="These active feeds have the strongest source quality signals and are the safest sources to prioritize when expanding shards.">
            <FeedList feeds={data.bestQualityFeeds} emptyMessage="No scored feeds yet. Run the Worker after applying the quality score migration." />
          </Section>

          <Section id="manage-feeds" eyebrow="Source Controls" title="Manage All RSS Feeds" description="Enable or disable feeds safely from Supabase-backed admin controls. Disabled feeds are skipped by Worker shards without changing code.">
            <FeedList feeds={data.feeds} emptyMessage="No RSS feeds found." />
          </Section>

          <Section id="recommended-disable" eyebrow="Recommended Review" title="Feeds to Consider Disabling" description="These active feeds are repeatedly failing or have poor source quality scores. Disable only after reviewing whether the source is still useful.">
            <FeedList feeds={data.recommendedDisableFeeds} emptyMessage="No active weak feeds are currently recommended for disabling." />
          </Section>

          <Section id="inactive-feeds" eyebrow="Inactive Sources" title="Currently Disabled Feeds" description="Feeds listed here are inactive in Supabase and will not be used by Worker shards unless re-enabled.">
            <FeedList feeds={data.inactiveFeeds} emptyMessage="No feeds are currently disabled." />
          </Section>

          <Section id="quality-sql" eyebrow="Supabase Query" title="Rank Feeds by Quality" description="Use this query in Supabase SQL Editor to rank sources by quality score and quickly find the best or weakest feeds.">
            <pre className="overflow-x-auto rounded-[1.5rem] border border-amber-300/15 bg-black/45 p-4 text-xs leading-6 text-amber-100/75">
              <code>{data.rankingSql}</code>
            </pre>
          </Section>
        </div>
      </div>
    </main>
  );
}
