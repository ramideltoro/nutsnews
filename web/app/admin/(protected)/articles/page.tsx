import type { ReactNode } from "react";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import {
  type ArticleReviewDashboardData,
  type ArticleReviewDecision,
  type ArticleReviewFilters,
  type ArticleReviewRow,
  type ArticleReviewSearchParams,
  getAdminArticleReviewDashboardData,
  parseArticleReviewFilters,
} from "@/lib/adminArticleReviews";
import { formatAdminDateTime } from "@/lib/adminTime";

export const metadata = {
  title: "Article Reviews | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminArticlesPageProps = {
  searchParams?: Promise<ArticleReviewSearchParams> | ArticleReviewSearchParams;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateTime(value: string | null) {
  return formatAdminDateTime(value, "Not published");
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

function QuickNav() {
  const links = [
    ["Summary", "#summary"],
    ["Filters", "#filters"],
    ["Reviews", "#reviews"],
    ["SQL", "#review-sql"],
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

function DecisionPill({ decision }: { decision: ArticleReviewDecision }) {
  const classes =
    decision === "accept"
      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
      : "border-red-300/25 bg-red-500/10 text-red-100";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${classes}`}
    >
      {decision === "accept" ? "Accepted" : "Rejected"}
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  const classes =
    score >= 8
      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
      : score >= 5
        ? "border-amber-300/20 bg-amber-400/10 text-amber-100"
        : "border-red-300/25 bg-red-500/10 text-red-100";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${classes}`}
    >
      Score {formatDecimal(score)}
    </span>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "watch" | "neutral";
}) {
  const classes = {
    ok: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    watch: "border-orange-300/25 bg-orange-400/10 text-orange-100",
    neutral: "border-amber-300/20 bg-black/30 text-amber-100/70",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${classes[tone]}`}
    >
      {label}
    </span>
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/75">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-amber-300/20 bg-black/40 px-4 py-3 text-sm font-semibold text-amber-50 outline-none transition focus:border-amber-300/55"
      >
        {children}
      </select>
    </label>
  );
}

function FilterInput({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/75">
        {label}
      </span>
      <input
        name={name}
        type="number"
        min={0}
        max={10}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-amber-300/20 bg-black/40 px-4 py-3 text-sm font-semibold text-amber-50 outline-none transition placeholder:text-amber-100/25 focus:border-amber-300/55"
      />
    </label>
  );
}

function ReviewFilters({ data }: { data: ArticleReviewDashboardData }) {
  const filters = data.filters;

  return (
    <DashboardSection
      id="filters"
      eyebrow="Filters"
      title="Review Filters"
      description="Filter accepted and rejected article decisions by source, category, positivity score, and review time order."
    >
      <form action="/admin/articles" className="grid gap-4 lg:grid-cols-6">
        <FilterSelect
          name="decision"
          label="Decision"
          defaultValue={filters.decision}
        >
          <option value="all">All decisions</option>
          <option value="accept">Accepted</option>
          <option value="reject">Rejected</option>
        </FilterSelect>

        <FilterSelect
          name="source"
          label="Source"
          defaultValue={filters.source}
        >
          <option value="">All sources</option>
          {data.sourceOptions.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          name="category"
          label="Category"
          defaultValue={filters.category}
        >
          <option value="">All categories</option>
          {data.categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </FilterSelect>

        <FilterInput
          name="minScore"
          label="Min Score"
          defaultValue={
            filters.minScore === null ? "" : String(filters.minScore)
          }
          placeholder="0"
        />

        <FilterInput
          name="maxScore"
          label="Max Score"
          defaultValue={
            filters.maxScore === null ? "" : String(filters.maxScore)
          }
          placeholder="10"
        />

        <FilterSelect name="sort" label="Time Sort" defaultValue={filters.sort}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </FilterSelect>

        <div className="flex flex-col gap-3 lg:col-span-6 lg:flex-row">
          <button
            type="submit"
            className="rounded-full border border-amber-300/25 bg-amber-400/10 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/15"
          >
            Apply Filters
          </button>

          <Link
            href="/admin/articles"
            className="rounded-full border border-amber-300/20 bg-black/30 px-5 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-amber-100/75 transition hover:border-amber-300/50 hover:bg-amber-400/10"
          >
            Reset
          </Link>
        </div>
      </form>
    </DashboardSection>
  );
}

function SummarySection({ data }: { data: ArticleReviewDashboardData }) {
  const summary = data.summary;

  return (
    <DashboardSection
      id="summary"
      eyebrow="Review Summary"
      title="Article Review Overview"
      description="A quick view of the filtered review set. Rows are sorted by review time so operators can inspect the newest or oldest decisions first."
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <StatusPill label={summary.sortLabel} tone="neutral" />
        <StatusPill
          label={`Page ${formatNumber(summary.page + 1)}`}
          tone="neutral"
        />
        <StatusPill
          label={`${formatNumber(summary.pageSize)} per page`}
          tone="neutral"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Matching Reviews"
          value={formatNumber(summary.totalMatchingReviews)}
          helper="Total reviews matching the active filter set."
        />
        <MetricCard
          label="Visible Rows"
          value={formatNumber(summary.visibleReviews)}
          helper="Rows loaded on the current page."
        />
        <MetricCard
          label="Accepted"
          value={formatNumber(summary.acceptedVisibleReviews)}
          helper="Accepted decisions visible on this page."
          tone="good"
        />
        <MetricCard
          label="Rejected"
          value={formatNumber(summary.rejectedVisibleReviews)}
          helper="Rejected decisions visible on this page."
          tone={summary.rejectedVisibleReviews > 0 ? "danger" : "default"}
        />
        <MetricCard
          label="Avg Score"
          value={formatDecimal(summary.averageVisibleScore)}
          helper="Average positivity score for visible rows."
          tone={summary.averageVisibleScore >= 7 ? "good" : "warning"}
        />
      </div>
    </DashboardSection>
  );
}

function ArticleReviewCard({ review }: { review: ArticleReviewRow }) {
  return (
    <article className="rounded-[1.75rem] border border-amber-300/15 bg-black/30 p-4 shadow-lg shadow-amber-950/10 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <DecisionPill decision={review.decision} />
            <ScorePill score={review.positivityScore} />
            <StatusPill
              label={review.aiProviderLabel}
              tone={review.aiProvider === "openai" ? "watch" : "ok"}
            />
            <StatusPill label={review.aiModel} tone="neutral" />
            <StatusPill
              label={review.isPublished ? "Published" : "Not Published"}
              tone={review.isPublished ? "ok" : "neutral"}
            />
          </div>

          <h3 className="text-xl font-black leading-snug text-amber-50">
            {review.title}
          </h3>

          <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-amber-300/70">
            {review.source} • {review.category} • {review.aiProviderLabel} /{" "}
            {review.aiModel} • Reviewed {review.reviewedAtLabel}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={review.originalUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-amber-300/25 bg-black/30 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/10"
          >
            Original
          </a>

          {review.publishedArticle ? (
            <Link
              href={`/articles/${review.publishedArticle.id}`}
              className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100 transition hover:border-emerald-300/50"
            >
              Site Story
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.25rem] border border-amber-300/10 bg-black/25 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/70">
            AI Summary
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/70">
            {review.summary}
          </p>
        </div>

        <div className="rounded-[1.25rem] border border-amber-300/10 bg-black/25 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/70">
            Decision Reason
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/70">
            {review.reason}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-xs text-amber-100/55 md:grid-cols-4">
        <p>
          <span className="font-black uppercase tracking-[0.12em] text-amber-300/70">
            Reviewed:
          </span>{" "}
          {review.reviewedAtLabel}
        </p>
        <p>
          <span className="font-black uppercase tracking-[0.12em] text-amber-300/70">
            Published:
          </span>{" "}
          {formatDateTime(review.publishedArticle?.publishedOnSiteAt ?? null)}
        </p>
        <p>
          <span className="font-black uppercase tracking-[0.12em] text-amber-300/70">
            AI:
          </span>{" "}
          {review.aiProviderLabel} · {review.aiModel} ·{" "}
          {formatDuration(review.reviewDurationMs)}
        </p>
        <p className="truncate">
          <span className="font-black uppercase tracking-[0.12em] text-amber-300/70">
            URL:
          </span>{" "}
          {review.originalUrl}
        </p>
      </div>
    </article>
  );
}

function ReviewsSection({ data }: { data: ArticleReviewDashboardData }) {
  return (
    <DashboardSection
      id="reviews"
      eyebrow="Article Decisions"
      title="Accepted and Rejected Story Reviews"
      description="Inspect why each story was accepted or rejected, then open the original article or published NutsNews story for manual investigation."
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <StatusPill
            label={`${formatNumber(data.summary.totalMatchingReviews)} matching`}
            tone="neutral"
          />
          <StatusPill label={data.summary.sortLabel} tone="neutral" />
        </div>

        <div className="flex flex-wrap gap-2">
          {data.hasPreviousPage ? (
            <Link
              href={data.previousPageHref}
              className="rounded-full border border-amber-300/20 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/10"
            >
              ← Previous
            </Link>
          ) : null}

          {data.hasNextPage ? (
            <Link
              href={data.nextPageHref}
              className="rounded-full border border-amber-300/20 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/10"
            >
              Next →
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4">
        {data.reviews.length === 0 ? (
          <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-5 text-center text-sm text-amber-100/65">
            No reviewed articles match the current filters.
          </div>
        ) : (
          data.reviews.map((review) => (
            <ArticleReviewCard key={review.id} review={review} />
          ))
        )}
      </div>
    </DashboardSection>
  );
}

function ReviewSqlSection({ data }: { data: ArticleReviewDashboardData }) {
  return (
    <DashboardSection
      id="review-sql"
      eyebrow="Supabase Query"
      title="Review SQL"
      description="Use this query in Supabase SQL Editor to reproduce the current article-review view."
    >
      <pre className="overflow-x-auto rounded-[1.5rem] border border-amber-300/15 bg-black/45 p-4 text-xs leading-6 text-amber-100/75">
        <code>{data.reviewSql}</code>
      </pre>
    </DashboardSection>
  );
}

export default async function AdminArticlesPage({
  searchParams = {},
}: AdminArticlesPageProps) {
  const session = await auth();
  const resolvedSearchParams = await searchParams;
  const filters: ArticleReviewFilters =
    parseArticleReviewFilters(resolvedSearchParams);
  const data = await getAdminArticleReviewDashboardData(filters);

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
                Article Review Dashboard
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                Review accepted and rejected stories, filter by
                decision/source/category/score, see whether OpenAI or the local
                Qwen/Ollama model made the decision, and investigate why an
                article was accepted or rejected.
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

        {!data.isConfigured ? (
          <section className="mb-5 rounded-[2rem] border border-red-300/20 bg-red-500/10 p-5 shadow-xl shadow-red-950/20 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-200">
              Dashboard Setup Needed
            </p>
            <h2 className="mt-2 text-2xl font-black text-red-50">
              Article review data could not be loaded.
            </h2>
            <p className="mt-3 text-sm leading-6 text-red-100/75">
              {data.errorMessage}
            </p>
          </section>
        ) : null}

        <div className="grid gap-5">
          <SummarySection data={data} />
          <ReviewFilters data={data} />
          <ReviewsSection data={data} />
          <ReviewSqlSection data={data} />
        </div>
      </div>
    </main>
  );
}
