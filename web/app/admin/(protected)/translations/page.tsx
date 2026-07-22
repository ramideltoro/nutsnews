import Link from "next/link";
import { getTranslationQualityDashboardData } from "@/lib/adminTranslationQuality";

export const metadata = {
  title: "Translation Quality | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function ResultPill({ result }: { result: "pass" | "warn" | "fail" | "missing" | "critical" | "warning" }) {
  const classes = {
    pass: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    warn: "border-orange-300/25 bg-orange-400/10 text-orange-100",
    fail: "border-red-300/35 bg-red-500/15 text-red-100",
    missing: "border-orange-300/25 bg-orange-400/10 text-orange-100",
    critical: "border-red-300/35 bg-red-500/15 text-red-100",
    warning: "border-amber-300/25 bg-amber-400/10 text-amber-100",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${classes[result]}`}>
      {result}
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
  tone?: "default" | "good" | "warning" | "danger";
}) {
  const toneClasses = {
    default: "from-black/45 via-neutral-950/85 to-amber-950/25",
    good: "from-black/45 via-neutral-950/85 to-emerald-950/20",
    warning: "from-black/45 via-neutral-950/85 to-orange-950/25",
    danger: "from-black/45 via-neutral-950/85 to-red-950/20",
  };

  return (
    <div className={`rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br ${toneClasses[tone]} p-5 shadow-xl shadow-amber-950/20`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
        {label}
      </p>
      <h3 className="mt-3 text-3xl font-black text-amber-50">{value}</h3>
      <p className="mt-2 text-sm leading-6 text-amber-100/60">{helper}</p>
    </div>
  );
}

export default async function TranslationQualityPage() {
  const data = await getTranslationQualityDashboardData();
  const summaryTone =
    data.overallStatus === "fail"
      ? "danger"
      : data.overallStatus === "warn"
        ? "warning"
        : "good";

  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] px-4 py-6 text-amber-50 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.22),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.14),_transparent_34%),linear-gradient(135deg,_#0a0a0a,_#171717_52%,_#451a03)]" />
        <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl">
        <nav className="mb-5">
          <Link
            href="/admin"
            className="inline-flex rounded-full border border-amber-300/25 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/10"
          >
            ← Admin
          </Link>
        </nav>

        <header className="mb-5 rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/55 via-neutral-950/85 to-amber-950/25 p-5 shadow-2xl shadow-amber-950/30 backdrop-blur sm:p-7">
          <p className="mb-4 inline-flex rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
            Translation Quality
          </p>
          <h1 className="text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">
            Multilingual Quality Dashboard
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
            Track article summary translation coverage, language-code quality,
            English-text leakage, length warnings, and fallback behavior for the
            public feed. This mirrors the daily translation coverage report.
          </p>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-amber-200/70">
            Source: {data.source} · Limit: {data.auditLimit} · Generated: {data.generatedAt}
          </p>
        </header>

        {data.errorMessage ? (
          <section className="mb-5 rounded-[1.5rem] border border-red-300/25 bg-red-500/10 p-5 text-sm leading-6 text-red-100/85 shadow-xl shadow-red-950/20">
            <p className="font-black">Translation Quality dashboard data is unavailable.</p>
            <p className="mt-2">{data.errorMessage}</p>
          </section>
        ) : null}

        <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Overall"
            value={data.overallStatus.toUpperCase()}
            helper="Fail means at least one stored translation has a critical quality issue."
            tone={summaryTone}
          />
          <MetricCard
            label="Coverage"
            value={`${data.availableTranslationCount}/${data.expectedTranslationCount}`}
            helper={`${data.missingTranslationCount} missing rows across checked languages.`}
            tone={data.missingTranslationCount > 0 ? "warning" : "good"}
          />
          <MetricCard
            label="Warnings"
            value={String(data.qualityWarningCount)}
            helper="Length and likely-English warnings that should be reviewed."
            tone={data.qualityWarningCount > 0 ? "warning" : "good"}
          />
          <MetricCard
            label="Critical"
            value={String(data.criticalIssueCount)}
            helper="Critical rows are not safe for public localization."
            tone={data.criticalIssueCount > 0 ? "danger" : "good"}
          />
        </section>

        <section className="mb-5 rounded-[2rem] border border-amber-300/20 bg-black/35 p-5 shadow-xl shadow-amber-950/20 sm:p-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                Fallback Policy
              </p>
              <h2 className="mt-2 text-2xl font-black text-amber-50">
                Missing translations never break the public feed
              </h2>
            </div>
            <ResultPill result={data.overallStatus} />
          </div>
          <p className="text-sm leading-6 text-amber-100/65">{data.fallbackPolicy}</p>
        </section>

        <section className="mb-5 rounded-[2rem] border border-amber-300/20 bg-black/35 p-5 shadow-xl shadow-amber-950/20 sm:p-6">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
              Language Matrix
            </p>
            <h2 className="mt-2 text-2xl font-black text-amber-50">Coverage and quality by language</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-amber-300/10 text-left text-sm">
              <thead className="text-[10px] uppercase tracking-[0.16em] text-amber-300/75">
                <tr>
                  <th className="py-3 pr-4">Language</th>
                  <th className="py-3 pr-4">Coverage</th>
                  <th className="py-3 pr-4">Missing</th>
                  <th className="py-3 pr-4">Warnings</th>
                  <th className="py-3 pr-4">Critical</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-300/10 text-amber-50/85">
                {data.languageSummaries.map((language) => (
                  <tr key={language.languageCode}>
                    <td className="py-3 pr-4 font-bold">
                      {language.label} <span className="text-amber-200/55">({language.languageCode})</span>
                    </td>
                    <td className="py-3 pr-4">{formatPercent(language.coveragePercent)}</td>
                    <td className="py-3 pr-4">{language.missingCount}</td>
                    <td className="py-3 pr-4">{language.warningCount}</td>
                    <td className="py-3 pr-4">{language.criticalCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[2rem] border border-amber-300/20 bg-black/35 p-5 shadow-xl shadow-amber-950/20 sm:p-6">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
              Latest Findings
            </p>
            <h2 className="mt-2 text-2xl font-black text-amber-50">Missing rows and quality warnings</h2>
            <p className="mt-2 text-sm leading-6 text-amber-100/60">
              Showing the first {data.issueRows.length} findings from the latest public feed sample.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-amber-300/10 text-left text-sm">
              <thead className="text-[10px] uppercase tracking-[0.16em] text-amber-300/75">
                <tr>
                  <th className="py-3 pr-4">Result</th>
                  <th className="py-3 pr-4">Language</th>
                  <th className="py-3 pr-4">Article</th>
                  <th className="py-3 pr-4">Issue</th>
                  <th className="py-3 pr-4">Provider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-300/10 text-amber-50/85">
                {data.issueRows.length === 0 ? (
                  <tr>
                    <td className="py-6 pr-4 text-amber-100/65" colSpan={5}>
                      No missing translations or quality warnings found in the checked sample.
                    </td>
                  </tr>
                ) : (
                  data.issueRows.map((issue) => (
                    <tr key={`${issue.languageCode}-${issue.issueCode}-${issue.originalUrl}`}>
                      <td className="py-3 pr-4"><ResultPill result={issue.severity} /></td>
                      <td className="py-3 pr-4 font-bold">{issue.languageCode}</td>
                      <td className="max-w-md py-3 pr-4">
                        <p className="font-bold text-amber-50">{issue.articleTitle}</p>
                        <p className="mt-1 text-xs text-amber-100/50">{issue.source}</p>
                        <a className="mt-1 block truncate text-xs text-amber-200/70 hover:text-amber-100" href={issue.originalUrl}>
                          {issue.originalUrl}
                        </a>
                      </td>
                      <td className="max-w-lg py-3 pr-4">
                        <p className="font-bold text-amber-100">{issue.issueCode}</p>
                        <p className="mt-1 text-amber-100/60">{issue.message}</p>
                      </td>
                      <td className="py-3 pr-4 text-amber-100/60">
                        {issue.provider}<br />
                        <span className="text-xs">{issue.model}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
