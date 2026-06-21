import type { ReactNode } from "react";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { formatAdminDateLabel, formatAdminDateTime } from "@/lib/adminTime";
import {
  type LocalAiDailyPoint,
  type LocalAiLatestRun,
  type LocalAiModelSummary,
  type LocalAiRecentReview,
  type LocalAiSummary,
  getAdminLocalAiDashboardData,
} from "@/lib/adminLocalAi";

export const metadata = {
  title: "Local AI | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  return formatAdminDateTime(value, "No local AI runs yet");
}

function formatDateLabel(value: string) {
  return formatAdminDateLabel(value);
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

function MetricCard({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "default" | "good" | "warning" | "danger";
}) {
  const toneClasses = {
    default: "from-black/45 via-neutral-950/85 to-amber-950/25",
    good: "from-black/45 via-neutral-950/85 to-emerald-950/20",
    warning: "from-black/45 via-neutral-950/85 to-orange-950/25",
    danger: "from-black/45 via-neutral-950/85 to-red-950/20",
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

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "watch" | "neutral" | "danger";
}) {
  const classes = {
    ok: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    watch: "border-orange-300/25 bg-orange-400/10 text-orange-100",
    neutral: "border-amber-300/20 bg-black/30 text-amber-100/70",
    danger: "border-red-300/25 bg-red-500/10 text-red-100",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${classes[tone]}`}
    >
      {label}
    </span>
  );
}

function QuickNav() {
  const links = [
    ["Overview", "#overview"],
    ["Models", "#models"],
    ["Daily", "#daily"],
    ["Runs", "#runs"],
    ["Reviews", "#reviews"],
    ["Setup", "#setup"],
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

function OverviewSection({
  last24Hours,
  last7Days,
  last30Days,
}: {
  last24Hours: LocalAiSummary;
  last7Days: LocalAiSummary;
  last30Days: LocalAiSummary;
}) {
  const fallbackTone =
    last7Days.fallbackOpenAiCallCount > 0 ? "warning" : "good";

  return (
    <DashboardSection
      id="overview"
      eyebrow="Oracle AI"
      title="Local AI Overview"
      description="Watch how the Oracle-hosted local model is reviewing articles, how often it falls back to OpenAI, and how long reviews take."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Last 24 Hours"
          value={formatNumber(last24Hours.localAiCallCount)}
          helper={`${formatNumber(last24Hours.acceptedCount)} accepted · ${formatNumber(
            last24Hours.rejectedCount,
          )} rejected · ${last24Hours.acceptanceRate}% acceptance.`}
          tone="good"
        />
        <MetricCard
          label="Last 7 Days"
          value={formatNumber(last7Days.localAiCallCount)}
          helper={`${formatNumber(last7Days.runCount)} local AI runs across ${formatNumber(
            last7Days.shardCount,
          )} shards.`}
        />
        <MetricCard
          label="Last 30 Days"
          value={formatNumber(last30Days.localAiCallCount)}
          helper={`${formatNumber(last30Days.totalTokens)} local tokens recorded from Ollama responses.`}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Current Model"
          value={last30Days.latestModel}
          helper={`Latest local model used at ${formatDateTime(last30Days.latestRunAt)}.`}
        />
        <MetricCard
          label="Avg Review Time"
          value={formatDuration(last7Days.averageReviewDurationMs)}
          helper="Average local-model time per reviewed article over the last 7 days."
        />
        <MetricCard
          label="OpenAI Fallback"
          value={formatNumber(last7Days.fallbackOpenAiCallCount)}
          helper="OpenAI calls made while the worker was in local AI mode."
          tone={fallbackTone}
        />
        <MetricCard
          label="Avg Run Time"
          value={formatDuration(last7Days.averageRunDurationMs)}
          helper="Average full worker duration for local AI runs."
        />
      </div>
    </DashboardSection>
  );
}

function ModelsSection({ models }: { models: LocalAiModelSummary[] }) {
  return (
    <DashboardSection
      id="models"
      eyebrow="Models"
      title="Local Model Breakdown"
      description="Compare qwen, llama, or any other local model you test by calls, acceptance rate, token usage, and speed."
    >
      {models.length === 0 ? (
        <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-5 text-sm text-amber-100/60">
          No local AI model runs have been recorded yet. After the worker runs
          with AI_PROVIDER=local, this section will show qwen or other local
          models.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[1.5rem] border border-amber-300/15">
          <table className="min-w-full divide-y divide-amber-300/10 text-sm">
            <thead className="bg-black/30 text-left text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/75">
              <tr>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Calls</th>
                <th className="px-4 py-3">Accepted</th>
                <th className="px-4 py-3">Rejected</th>
                <th className="px-4 py-3">Acceptance</th>
                <th className="px-4 py-3">Avg Time</th>
                <th className="px-4 py-3">Tokens</th>
                <th className="px-4 py-3">Latest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-300/10 bg-black/15">
              {models.map((model) => (
                <tr key={model.model}>
                  <td className="px-4 py-3 font-black text-amber-50">
                    {model.model}
                  </td>
                  <td className="px-4 py-3 text-amber-100/75">
                    {formatNumber(model.callCount)}
                  </td>
                  <td className="px-4 py-3 text-emerald-100/85">
                    {formatNumber(model.acceptedCount)}
                  </td>
                  <td className="px-4 py-3 text-red-100/80">
                    {formatNumber(model.rejectedCount)}
                  </td>
                  <td className="px-4 py-3 text-amber-100/75">
                    {model.acceptanceRate}%
                  </td>
                  <td className="px-4 py-3 text-amber-100/75">
                    {formatDuration(model.averageReviewDurationMs)}
                  </td>
                  <td className="px-4 py-3 text-amber-100/75">
                    {formatCompactNumber(model.totalTokens)}
                  </td>
                  <td className="px-4 py-3 text-amber-100/60">
                    {formatDateTime(model.latestRunAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardSection>
  );
}

function DailySection({ daily }: { daily: LocalAiDailyPoint[] }) {
  return (
    <DashboardSection
      id="daily"
      eyebrow="Trend"
      title="Daily Local AI Activity"
      description="A simple seven-day view of local model calls, accepted/rejected decisions, fallback usage, and average review latency."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        {daily.map((point) => (
          <div
            key={point.date}
            className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-4"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/75">
              {formatDateLabel(point.date)}
            </p>
            <p className="mt-3 text-2xl font-black text-amber-50">
              {formatNumber(point.callCount)}
            </p>
            <p className="mt-1 text-xs text-amber-100/60">local calls</p>
            <div className="mt-4 space-y-1 text-xs text-amber-100/65">
              <p>{formatNumber(point.acceptedCount)} accepted</p>
              <p>{formatNumber(point.rejectedCount)} rejected</p>
              <p>{formatNumber(point.fallbackOpenAiCallCount)} fallback</p>
              <p>{formatDuration(point.averageReviewDurationMs)} avg</p>
            </div>
          </div>
        ))}
      </div>
    </DashboardSection>
  );
}

function LatestRunsSection({ runs }: { runs: LocalAiLatestRun[] }) {
  return (
    <DashboardSection
      id="runs"
      eyebrow="Worker Runs"
      title="Latest Local AI Worker Runs"
      description="Use this to confirm which shards are using the local model and whether any fallback OpenAI calls happened."
    >
      {runs.length === 0 ? (
        <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-5 text-sm text-amber-100/60">
          No local AI worker runs have been saved yet.
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <article
              key={run.id}
              className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill
                      label={`Shard ${run.shardIndex}`}
                      tone="neutral"
                    />
                    <StatusPill label={run.model} tone="ok" />
                    {run.fallbackOpenAiCallCount > 0 ? (
                      <StatusPill label="OpenAI fallback" tone="watch" />
                    ) : (
                      <StatusPill label="No fallback" tone="ok" />
                    )}
                  </div>
                  <h3 className="mt-3 text-lg font-black text-amber-50">
                    {formatDateTime(run.runStartedAt)}
                  </h3>
                  <p className="mt-1 text-sm text-amber-100/60">
                    {run.runSource} run · {formatNumber(run.localAiCallCount)}{" "}
                    local calls · {formatNumber(run.acceptedCount)} accepted ·{" "}
                    {formatNumber(run.rejectedCount)} rejected
                  </p>
                </div>
                <div className="text-sm text-amber-100/65 lg:text-right">
                  <p>
                    {formatDuration(run.averageReviewDurationMs)} avg review
                  </p>
                  <p>{formatDuration(run.durationMs)} full run</p>
                  <p>{formatCompactNumber(run.totalTokens)} tokens</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

function RecentReviewsSection({ reviews }: { reviews: LocalAiRecentReview[] }) {
  return (
    <DashboardSection
      id="reviews"
      eyebrow="Article Reviews"
      title="Recent Local AI Article Decisions"
      description="Each review now records the provider and model, so you can see whether qwen/local AI or OpenAI processed the article."
    >
      {reviews.length === 0 ? (
        <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-5 text-sm text-amber-100/60">
          No local AI article reviews have been saved yet.
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill
                      label={
                        review.decision === "accept" ? "Accepted" : "Rejected"
                      }
                      tone={review.decision === "accept" ? "ok" : "danger"}
                    />
                    <StatusPill
                      label={`Score ${review.positivityScore}`}
                      tone="neutral"
                    />
                    <StatusPill label={review.model} tone="ok" />
                  </div>
                  <h3 className="mt-3 text-lg font-black text-amber-50">
                    <a
                      href={review.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="transition hover:text-amber-200"
                    >
                      {review.title}
                    </a>
                  </h3>
                  <p className="mt-1 text-sm text-amber-100/60">
                    {review.source} · {review.category} ·{" "}
                    {formatDateTime(review.reviewedAt)}
                  </p>
                  {review.summary ? (
                    <p className="mt-3 text-sm leading-6 text-amber-100/75">
                      {review.summary}
                    </p>
                  ) : null}
                  {review.reason ? (
                    <p className="mt-2 text-xs leading-5 text-amber-100/45">
                      {review.reason}
                    </p>
                  ) : null}
                </div>
                <div className="text-sm text-amber-100/65 lg:text-right">
                  <p>{review.provider}</p>
                  <p>{formatDuration(review.reviewDurationMs)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

function SetupSection() {
  return (
    <DashboardSection
      id="setup"
      eyebrow="Setup"
      title="Local AI Rollout Checklist"
      description="These are the production switches that keep the Oracle model simple, safe, and easy to roll back."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/75">
            Worker Variables
          </p>
          <pre className="mt-3 overflow-x-auto rounded-2xl border border-amber-300/10 bg-black/40 p-4 text-xs leading-6 text-amber-100/80">
            {`AI_PROVIDER=local
LOCAL_AI_URL=https://ai.nutsnews.com
LOCAL_AI_MODEL=qwen2.5:3b
AI_REVIEW_CONCURRENCY=1
AI_PROVIDER_FALLBACK_TO_OPENAI=true`}
          </pre>
        </div>
        <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/75">
            Oracle Health
          </p>
          <p className="mt-3 text-sm leading-6 text-amber-100/65">
            Keep Ollama bound to localhost, expose only the small NutsNews local
            AI service through Caddy, protect /review with LOCAL_AI_API_KEY, and
            monitor /health with Better Stack.
          </p>
        </div>
      </div>
    </DashboardSection>
  );
}

export default async function LocalAiAdminPage() {
  const session = await auth();
  const data = await getAdminLocalAiDashboardData();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_34%),linear-gradient(135deg,#090805_0%,#16100a_44%,#221505_100%)] px-5 py-8 text-amber-50 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href="/admin"
              className="text-xs font-black uppercase tracking-[0.16em] text-amber-300/75 transition hover:text-amber-200"
            >
              ← Admin Home
            </Link>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300/80">
              NutsNews Admin
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-amber-50 md:text-5xl">
              Local AI Dashboard
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/65 md:text-base">
              Monitor your Oracle-hosted Ollama model, local AI article
              decisions, fallback usage, latency, and model quality signals.
            </p>
            <p className="mt-2 text-xs text-amber-100/45">
              Generated {formatDateTime(data.generatedAt)}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-300/15 bg-black/25 p-4 text-sm text-amber-100/70 shadow-lg shadow-amber-950/10">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-300/75">
              Signed in
            </p>
            <p className="mt-2 font-semibold text-amber-50">
              {session?.user?.email ?? "Admin"}
            </p>
            <form
              className="mt-3"
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/admin/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-full border border-amber-300/20 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/10"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>

        <QuickNav />

        {!data.isConfigured ? (
          <div className="mb-5 rounded-[1.5rem] border border-red-300/20 bg-red-950/20 p-5 text-sm leading-6 text-red-100">
            <p className="font-black">Local AI dashboard is not configured.</p>
            <p className="mt-2">{data.errorMessage}</p>
          </div>
        ) : null}

        <div className="space-y-5">
          <OverviewSection
            last24Hours={data.last24Hours}
            last7Days={data.last7Days}
            last30Days={data.last30Days}
          />
          <ModelsSection models={data.modelSummaries} />
          <DailySection daily={data.daily} />
          <LatestRunsSection runs={data.latestRuns} />
          <RecentReviewsSection reviews={data.recentReviews} />
          <SetupSection />
        </div>
      </div>
    </main>
  );
}
