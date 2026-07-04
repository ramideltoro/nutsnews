import Link from "next/link";
import { auth, signOut } from "@/auth";

export const metadata = {
  title: "Admin | NutsNews",
};

type DashboardStatus = "Live" | "Coming Soon";

type DashboardCardProps = {
  title: string;
  description: string;
  href?: string;
  status: DashboardStatus;
  eyebrow: string;
};

function DashboardCard({
  title,
  description,
  href,
  status,
  eyebrow,
}: DashboardCardProps) {
  const isLive = status === "Live";

  const card = (
    <div className="group h-full rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 transition hover:border-amber-300/45 hover:bg-amber-400/10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
          {eyebrow}
        </p>

        <span
          className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
            isLive
              ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
              : "border-amber-300/20 bg-black/30 text-amber-100/65"
          }`}
        >
          {status}
        </span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-amber-50">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-amber-100/65">
            {description}
          </p>
        </div>

        {isLive ? (
          <span className="mt-1 text-lg text-amber-200 transition group-hover:translate-x-1">
            →
          </span>
        ) : null}
      </div>
    </div>
  );

  if (!href) {
    return card;
  }

  return (
    <Link href={href} className="block h-full">
      {card}
    </Link>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-black text-amber-50">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-100/60">
        {description}
      </p>
    </div>
  );
}

export default async function AdminPage() {
  const session = await auth();

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
              <p className="mb-4 inline-flex rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
                NutsNews Admin
              </p>

              <h1 className="text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">
                Admin Landing Page
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                Choose a focused dashboard below. This page is only the landing
                page and dashboard directory, so detailed operations stay on
                their own admin routes.
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

        <section className="mb-5 rounded-[2rem] border border-amber-300/20 bg-black/25 p-5 shadow-xl shadow-amber-950/10 sm:p-6">
          <SectionHeader
            eyebrow="Live Dashboards"
            title="Operations"
            description="Use these dashboards for day-to-day monitoring. Each dashboard has its own route so /admin stays clean and easy to navigate."
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DashboardCard
              eyebrow="Readiness"
              title="Production Readiness"
              description="See a green/yellow/red launch scorecard for public API health, Worker freshness, database growth, translations, images, backups, and CI."
              href="/admin/readiness"
              status="Live"
            />

            <DashboardCard
              eyebrow="Content"
              title="Article Reviews"
              description="Review accepted and rejected stories, filter by decision, source, category, positivity score, and investigate why the AI made each decision."
              href="/admin/articles"
              status="Live"
            />

            <DashboardCard
              eyebrow="AI Cost"
              title="AI Usage"
              description="Track OpenAI calls, prompt tokens, completion tokens, estimated cost, accepted decisions, rejected decisions, cost protection hits, and spike warnings."
              href="/admin/ai-usage"
              status="Live"
            />

            <DashboardCard
              eyebrow="Translations"
              title="Translation Quality"
              description="Monitor multilingual summary coverage, missing rows, language-code mismatches, likely English leakage, and fallback behavior for public article cards."
              href="/admin/translations"
              status="Live"
            />

            <DashboardCard
              eyebrow="Free Tiers"
              title="Guardrails"
              description="Forecast database growth, AI spend, Worker invocations, email sends, Redis/KV usage, egress, and API pressure before free-tier limits are hit."
              href="/admin/guardrails"
              status="Live"
            />

            <DashboardCard
              eyebrow="CDN Cache"
              title="Cache Observability"
              description="Compare expected and actual Cloudflare/Vercel cache headers for the homepage, article pages, articles API, sitemap, robots, and static assets."
              href="/admin/cache"
              status="Live"
            />

            <DashboardCard
              eyebrow="Resiliency"
              title="Edge Snapshot"
              description="Check the Cloudflare KV last-known-good public feed fallback, snapshot age, article count, and endpoint readiness."
              href="/admin/edge-snapshot"
              status="Live"
            />

            <DashboardCard
              eyebrow="Home AI"
              title="Local AI"
              description="Monitor the home-server Ollama model, qwen/local AI article decisions, fallback OpenAI calls, review latency, and model-level quality signals."
              href="/admin/local-ai"
              status="Live"
            />

            <DashboardCard
              eyebrow="Instance"
              title="Home Server"
              description="View live home-server instance stats including uptime, CPU load, memory, disk, Ollama, local AI service, and Cloudflare Tunnel status."
              href="/admin/home-server"
              status="Live"
            />

            <DashboardCard
              eyebrow="Worker Health"
              title="Worker Shards"
              description="Monitor Worker refreshes, failed shard executions, latest error messages, consecutive failures, stale shards, feed counts, fetch volume, image hydration, and duration by shard."
              href="/admin/shards"
              status="Live"
            />

            <DashboardCard
              eyebrow="Sources"
              title="RSS Feed Health"
              description="Review RSS feed quality, repeated failures, image coverage, accepted article output, weak feeds, best feeds, quality scores, and Supabase disable actions."
              href="/admin/feed-health"
              status="Live"
            />

            <DashboardCard
              eyebrow="Source Controls"
              title="Feed Management"
              description="List RSS feeds, see active and inactive status, view positive-source flags, inspect 0-100 quality scores, and safely enable or disable feeds."
              href="/admin/feeds"
              status="Live"
            />
          </div>
        </section>

        <section className="mb-5 rounded-[2rem] border border-amber-300/20 bg-black/25 p-5 shadow-xl shadow-amber-950/10 sm:p-6">
          <SectionHeader
            eyebrow="Future Dashboards"
            title="Planned Admin Areas"
            description="These cards reserve space for future dashboards without crowding the landing page with detailed operational data."
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              eyebrow="Recovery"
              title="Backups"
              description="View backup freshness, restore readiness, Supabase export status, and future scheduled backup automation."
              status="Coming Soon"
            />

            <DashboardCard
              eyebrow="Actions"
              title="Controls"
              description="Future operational controls for manual refresh, pause mode, maintenance mode, feed toggles, and safe admin actions."
              status="Coming Soon"
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
              Page Role
            </p>
            <h2 className="mt-2 text-2xl font-black text-amber-50">
              Landing Page Only
            </h2>
            <p className="mt-3 text-sm leading-6 text-amber-100/65">
              The `/admin` route should stay lightweight. It links to focused
              dashboards, while detailed monitoring lives under dedicated admin
              routes like `/admin/readiness`, `/admin/articles`,
              `/admin/ai-usage`, `/admin/local-ai`, `/admin/shards`,
              `/admin/feed-health`, and `/admin/feeds`.
            </p>
          </div>

          <div className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
              Access Rule
            </p>
            <h2 className="mt-2 text-2xl font-black text-amber-50">
              Owner Only
            </h2>
            <p className="mt-3 text-sm leading-6 text-amber-100/65">
              Only the configured Google admin account can enter protected admin
              pages. Any other Google account is redirected to the access denied
              page.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
