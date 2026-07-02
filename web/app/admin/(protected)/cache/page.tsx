import Link from "next/link";
import { headers } from "next/headers";
import { getCacheObservabilityDashboardData } from "@/lib/cacheObservability";

export const metadata = {
  title: "Cache Observability | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatPercent(value: number | null) {
  if (typeof value !== "number") {
    return "n/a";
  }

  return `${Math.round(value * 100)}%`;
}

function ResultPill({ result }: { result: "pass" | "warn" | "fail" }) {
  const classes = {
    pass: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    warn: "border-orange-300/25 bg-orange-400/10 text-orange-100",
    fail: "border-red-300/35 bg-red-500/15 text-red-100",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${classes[result]}`}
    >
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

async function getDefaultBaseUrl() {
  if (process.env.NUTSNEWS_CACHE_OBSERVABILITY_URL) {
    return process.env.NUTSNEWS_CACHE_OBSERVABILITY_URL;
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";

  return host ? `${protocol}://${host}` : "https://www.nutsnews.com";
}

export default async function CacheObservabilityPage() {
  const data = await getCacheObservabilityDashboardData({
    baseUrl: await getDefaultBaseUrl(),
    articlePath: process.env.NUTSNEWS_CACHE_ARTICLE_PATH,
  });

  const summaryTone =
    data.summary.status === "fail"
      ? "danger"
      : data.summary.status === "warn"
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
            Cache Observability
          </p>
          <h1 className="text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">
            Cloudflare Cache Dashboard
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
            Compare expected cache policy against live response headers for the
            public routes that protect Supabase and keep the reader experience
            fast. This dashboard checks the configured base URL and mirrors the
            scheduled GitHub Actions report.
          </p>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-amber-200/70">
            Base URL: {data.baseUrl} · Generated: {data.generatedAt}
          </p>
        </header>

        <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Overall"
            value={data.summary.status.toUpperCase()}
            helper="Pass means all required cache headers and policies matched."
            tone={summaryTone}
          />
          <MetricCard
            label="Routes"
            value={`${data.summary.passedCount}/${data.summary.routeCount}`}
            helper={`${data.summary.failedCount} failing, ${data.summary.warningCount} warning.`}
            tone={data.summary.failedCount > 0 ? "danger" : data.summary.warningCount > 0 ? "warning" : "good"}
          />
          <MetricCard
            label="Cloudflare HIT rate"
            value={formatPercent(data.summary.cloudflareHitRate)}
            helper="Shown when the request path is actually behind Cloudflare."
            tone={data.summary.cloudflareHitRate === 0 ? "warning" : "default"}
          />
          <MetricCard
            label="Article sample"
            value={data.discoveredArticlePath ? "Found" : "Not found"}
            helper={data.discoveredArticlePath || "Set NUTSNEWS_CACHE_ARTICLE_PATH if discovery cannot find one."}
            tone={data.discoveredArticlePath ? "good" : "warning"}
          />
        </section>

        <section className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 sm:p-6">
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
              Expected vs Actual
            </p>
            <h2 className="mt-2 text-2xl font-black text-amber-50">
              Public cache policy matrix
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-100/60">
              Failures mean a route lost cacheability, changed its NutsNews
              policy marker, or stopped sending the CDN headers needed by
              Cloudflare and Vercel.
            </p>
          </div>

          <div className="overflow-x-auto rounded-[1.5rem] border border-amber-300/15">
            <table className="min-w-full divide-y divide-amber-300/10 text-left text-sm">
              <thead className="bg-black/35 text-[10px] uppercase tracking-[0.14em] text-amber-200/70">
                <tr>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">HTTP</th>
                  <th className="px-4 py-3">Expected Policy</th>
                  <th className="px-4 py-3">Actual Policy</th>
                  <th className="px-4 py-3">Cache-Control</th>
                  <th className="px-4 py-3">CF Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-300/10 text-amber-100/75">
                {data.routes.map((route) => (
                  <tr key={route.key} className="align-top">
                    <td className="px-4 py-4">
                      <ResultPill result={route.result} />
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-amber-50">{route.label}</p>
                      <a
                        href={route.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block break-all text-xs text-amber-300/80 underline decoration-amber-300/30 underline-offset-4"
                      >
                        {route.urlPath}
                      </a>
                      <p className="mt-2 max-w-xs text-xs leading-5 text-amber-100/50">
                        {route.description}
                      </p>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">{route.status || "—"}</td>
                    <td className="px-4 py-4 font-mono text-xs">{route.expectedPolicy}</td>
                    <td className="px-4 py-4 font-mono text-xs">
                      {route.headers["x-nutsnews-cache-policy"] || "missing"}
                    </td>
                    <td className="max-w-sm px-4 py-4 font-mono text-xs">
                      {route.headers["cache-control"] || "missing"}
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">
                      {route.cloudflareStatuses.join(", ") || "not observed"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          {data.routes
            .filter((route) => route.failures.length > 0 || route.warnings.length > 0)
            .map((route) => (
              <div
                key={route.key}
                className="rounded-[2rem] border border-amber-300/20 bg-black/30 p-5 shadow-xl shadow-amber-950/10"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black text-amber-50">{route.label}</h3>
                  <ResultPill result={route.result} />
                </div>
                <ul className="space-y-2 text-sm leading-6 text-amber-100/70">
                  {route.failures.map((failure) => (
                    <li key={failure}>❌ {failure}</li>
                  ))}
                  {route.warnings.map((warning) => (
                    <li key={warning}>⚠️ {warning}</li>
                  ))}
                </ul>
              </div>
            ))}
        </section>
      </div>
    </main>
  );
}
