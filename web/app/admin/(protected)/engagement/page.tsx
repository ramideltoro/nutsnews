import type { ReactNode } from "react";
import Link from "next/link";
import {
  type ArticleEngagementArticleRow,
  type ArticleEngagementRollupRow,
  type ArticleEngagementSourceCategoryRow,
  getAdminArticleEngagementDashboardData,
} from "@/lib/adminArticleEngagement";

export const metadata = {
  title: "Article Engagement | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function truncate(value: string, maxLength = 120) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
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
    <div className="rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-emerald-950/20 p-5 shadow-xl shadow-amber-950/20">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
        {label}
      </p>
      <h3 className="mt-3 break-words text-3xl font-black text-amber-50">
        {value}
      </h3>
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
    ["Sources", "#sources"],
    ["Categories", "#categories"],
    ["Articles", "#articles"],
    ["SQL", "#sql"],
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

function RollupList({
  rows,
  emptyMessage,
}: {
  rows: ArticleEngagementRollupRow[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-5 text-sm leading-6 text-amber-100/65">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {rows.slice(0, 12).map((row) => (
        <article
          key={row.label}
          className="rounded-[1.5rem] border border-amber-300/15 bg-black/30 p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="break-words text-lg font-black text-amber-50">
                {row.label}
              </h3>
              <p className="mt-1 text-xs text-amber-100/50">
                Latest: {row.latestEventLabel}
              </p>
            </div>
            <div className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">
              {formatNumber(row.totalEngagementCount)} total
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-xs text-amber-100/60 sm:grid-cols-2">
            <p>
              Outbound clicks:{" "}
              <span className="font-black text-amber-50">
                {formatNumber(row.outboundClickCount)}
              </span>
            </p>
            <p>
              Category interest:{" "}
              <span className="font-black text-amber-50">
                {formatNumber(row.categoryInterestCount)}
              </span>
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function SourceCategoryTable({
  rows,
}: {
  rows: ArticleEngagementSourceCategoryRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-5 text-sm leading-6 text-amber-100/65">
        No source/category engagement rows are available yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[1.5rem] border border-amber-300/15 bg-black/25">
      <table className="min-w-full divide-y divide-amber-300/10 text-left text-sm">
        <thead className="bg-amber-400/5 text-[10px] uppercase tracking-[0.14em] text-amber-300/75">
          <tr>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Outbound</th>
            <th className="px-4 py-3">Interest</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Latest</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-300/10 text-amber-100/70">
          {rows.slice(0, 24).map((row) => (
            <tr key={`${row.source}:${row.category}`}>
              <td className="max-w-64 break-words px-4 py-3 font-semibold text-amber-50">
                {row.source}
              </td>
              <td className="max-w-56 break-words px-4 py-3">{row.category}</td>
              <td className="px-4 py-3">
                {formatNumber(row.outboundClickCount)}
              </td>
              <td className="px-4 py-3">
                {formatNumber(row.categoryInterestCount)}
              </td>
              <td className="px-4 py-3 font-black text-amber-50">
                {formatNumber(row.totalEngagementCount)}
              </td>
              <td className="px-4 py-3">{row.latestEventLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArticleList({
  rows,
  errorMessage,
}: {
  rows: ArticleEngagementArticleRow[];
  errorMessage: string | null;
}) {
  if (errorMessage) {
    return (
      <div className="rounded-[1.5rem] border border-orange-300/20 bg-orange-400/10 p-5 text-sm leading-6 text-orange-100/80">
        Article engagement details are unavailable: {errorMessage}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-5 text-sm leading-6 text-amber-100/65">
        No outbound article clicks are available yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <article
          key={`${row.articleId}:${row.source}:${row.category}`}
          className="rounded-[1.5rem] border border-amber-300/15 bg-black/30 p-4"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h3 className="break-words text-lg font-black text-amber-50">
                {truncate(row.title, 140)}
              </h3>
              <p className="mt-2 break-words text-xs text-amber-100/50">
                {row.source} - {row.category}
              </p>
              {row.originalUrl ? (
                <a
                  href={row.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block break-all text-xs font-semibold text-amber-200 underline decoration-amber-300/30 underline-offset-4"
                >
                  {truncate(row.originalUrl, 150)}
                </a>
              ) : null}
            </div>
            <div className="rounded-[1.2rem] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              <p className="text-[10px] font-black uppercase tracking-[0.14em]">
                Clicks
              </p>
              <p className="mt-1 text-2xl font-black">
                {formatNumber(row.outboundClickCount)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-amber-100/45">
            Latest click: {row.latestEventLabel}
          </p>
        </article>
      ))}
    </div>
  );
}

export default async function AdminEngagementPage() {
  const data = await getAdminArticleEngagementDashboardData();
  const summary = data.summary;

  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] px-4 py-6 text-amber-50 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(245,158,11,0.12),_transparent_34%),linear-gradient(135deg,_#0a0a0a,_#171717_52%,_#064e3b)]" />
      </div>

      <div className="mx-auto max-w-7xl">
        <header className="mb-5 rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/55 via-neutral-950/85 to-emerald-950/25 p-5 shadow-2xl shadow-amber-950/30 backdrop-blur sm:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100">
                Reader Signals
              </p>
              <h1 className="text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">
                Article Engagement
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                Aggregate outbound clicks and category interest by source and
                category. Counts come from consenting website readers and avoid
                visitor identifiers.
              </p>
            </div>

            <Link
              href="/admin"
              className="rounded-full border border-amber-300/25 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/10"
            >
              Admin Home
            </Link>
          </div>
        </header>

        <QuickNav />

        {data.errorMessage ? (
          <div className="mb-5 rounded-[1.5rem] border border-orange-300/20 bg-orange-400/10 p-5 text-sm leading-6 text-orange-100/80">
            Engagement data is unavailable: {data.errorMessage}
          </div>
        ) : null}

        <div className="grid gap-5">
          <Section
            id="summary"
            eyebrow="Summary"
            title="Source And Category Performance"
            description="Top-level counts show which publishers and topics are drawing outbound reader action."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Outbound Clicks"
                value={formatNumber(summary.totalOutboundClicks)}
                helper="Publisher-link opens from article cards."
              />
              <MetricCard
                label="Category Interest"
                value={formatNumber(summary.totalCategoryInterest)}
                helper="Category-level interest inferred from article clicks."
              />
              <MetricCard
                label="Top Source"
                value={summary.topSource}
                helper={`${formatNumber(summary.sourceCount)} sources have engagement rows.`}
              />
              <MetricCard
                label="Top Category"
                value={summary.topCategory}
                helper={`Latest event: ${summary.latestEventLabel}`}
              />
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100/80">
              Privacy scope: aggregate counters only. The browser payload omits
              raw URLs, article titles, names, emails, account IDs, cookies,
              referrers, IP addresses, user agents, and precise location.
            </div>
          </Section>

          <Section
            id="sources"
            eyebrow="Sources"
            title="Top Sources"
            description="Publisher rollups combine outbound clicks and category interest across all categories."
          >
            <RollupList
              rows={data.topSources}
              emptyMessage="No source engagement has been recorded yet."
            />
          </Section>

          <Section
            id="categories"
            eyebrow="Categories"
            title="Top Categories"
            description="Category rollups show which topics receive the strongest reader action."
          >
            <RollupList
              rows={data.topCategories}
              emptyMessage="No category engagement has been recorded yet."
            />
          </Section>

          <Section
            id="articles"
            eyebrow="Articles"
            title="Top Outbound Articles"
            description="Article rows show publisher-link clicks joined back to existing article metadata."
          >
            <ArticleList
              rows={data.topArticles}
              errorMessage={data.articleErrorMessage}
            />
          </Section>

          <Section
            id="source-category"
            eyebrow="Matrix"
            title="Source And Category Rows"
            description="Detailed source/category pairs preserve the reporting grain used by the aggregate table."
          >
            <SourceCategoryTable rows={data.sourceCategoryRows} />
          </Section>

          <Section
            id="sql"
            eyebrow="SQL"
            title="Read-Only Queries"
            description="Use these service-role-only views for ad hoc analysis or dashboard export checks."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <pre className="overflow-x-auto rounded-[1.5rem] border border-amber-300/15 bg-black/40 p-4 text-xs leading-5 text-amber-100/75">
                <code>{data.sourceCategorySql}</code>
              </pre>
              <pre className="overflow-x-auto rounded-[1.5rem] border border-amber-300/15 bg-black/40 p-4 text-xs leading-5 text-amber-100/75">
                <code>{data.articleSql}</code>
              </pre>
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
