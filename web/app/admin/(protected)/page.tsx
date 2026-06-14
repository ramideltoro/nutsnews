import Link from "next/link";
import { auth, signOut } from "@/auth";

export const metadata = {
    title: "Admin | NutsNews",
};

function DashboardCard({
                           title,
                           description,
                           href,
                           status,
                       }: {
    title: string;
    description: string;
    href?: string;
    status: "Live" | "Coming Soon";
}) {
    const isLive = status === "Live";

    const card = (
        <div className="group h-full rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 transition hover:border-amber-300/45 hover:bg-amber-400/10">
            <div className="mb-4 flex items-center justify-between gap-3">
        <span
            className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                isLive
                    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                    : "border-amber-300/20 bg-black/30 text-amber-100/65"
            }`}
        >
          {status}
        </span>

                {isLive ? (
                    <span className="text-lg text-amber-200 transition group-hover:translate-x-1">
            →
          </span>
                ) : null}
            </div>

            <h2 className="text-2xl font-black text-amber-50">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-amber-100/65">{description}</p>
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
                                Control Center
                            </h1>

                            <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                                Internal dashboards and future controls for AI usage, worker
                                shards, RSS feeds, observability, backups, and platform
                                operations.
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

                <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <DashboardCard
                        title="AI Usage"
                        description="Track OpenAI calls, tokens, estimated cost, accepted decisions, rejected decisions, cost protection hits, and spike warnings."
                        href="/admin/ai-usage"
                        status="Live"
                    />

                    <DashboardCard
                        title="Worker Shards"
                        description="Monitor shard freshness, feed counts, fetch volume, accepted/rejected counts, run duration, stale shards, and problem shards."
                        href="/admin/shards"
                        status="Live"
                    />

                    <DashboardCard
                        title="RSS Feeds"
                        description="Review feed coverage, failing sources, direct publisher feeds, active feeds, inactive feeds, and future feed maintenance actions."
                        status="Coming Soon"
                    />

                    <DashboardCard
                        title="Articles"
                        description="Inspect article queue health, accepted articles, rejected articles, thumbnail availability, categories, and source mix."
                        status="Coming Soon"
                    />

                    <DashboardCard
                        title="Backups"
                        description="View backup freshness, restore readiness, Supabase export status, and future scheduled backup automation."
                        status="Coming Soon"
                    />

                    <DashboardCard
                        title="Controls"
                        description="Future operational controls for manual refresh, pause mode, maintenance mode, feed toggles, and safe admin actions."
                        status="Coming Soon"
                    />
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 sm:p-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                            Admin Status
                        </p>
                        <h2 className="mt-2 text-2xl font-black text-amber-50">Active</h2>
                        <p className="mt-3 text-sm leading-6 text-amber-100/65">
                            Google login is enabled and access is restricted to the approved
                            admin account.
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