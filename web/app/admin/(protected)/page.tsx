import Link from "next/link";
import { auth, signOut } from "@/auth";

export const metadata = {
    title: "Admin | NutsNews",
};

const dashboards = [
    {
        title: "AI Usage",
        description:
            "Track estimated OpenAI usage, cost, accepted stories, rejected stories, and local filter savings.",
        href: "/admin/ai-usage",
        status: "Live",
        accent: "from-amber-300 via-amber-400 to-orange-400",
    },
    {
        title: "Worker Shards",
        description:
            "Monitor shard runs, durations, failed runs, feed processing counts, and latest refresh status.",
        href: null,
        status: "Coming Soon",
        accent: "from-orange-300 via-amber-400 to-yellow-300",
    },
    {
        title: "RSS Feeds",
        description:
            "View active feeds, failed feeds, source health, disabled feeds, and feed freshness.",
        href: null,
        status: "Coming Soon",
        accent: "from-yellow-300 via-amber-400 to-orange-300",
    },
    {
        title: "Articles",
        description:
            "Review accepted articles, rejected articles, categories, scores, and publishing freshness.",
        href: null,
        status: "Coming Soon",
        accent: "from-amber-200 via-amber-400 to-orange-500",
    },
    {
        title: "Backups",
        description:
            "Track backup status, restore readiness, database snapshots, and recovery health.",
        href: null,
        status: "Coming Soon",
        accent: "from-orange-400 via-amber-400 to-yellow-200",
    },
    {
        title: "Controls",
        description:
            "Future controls for pausing AI review, disabling feeds, running shards, and maintenance mode.",
        href: null,
        status: "Coming Soon",
        accent: "from-amber-400 via-orange-400 to-yellow-300",
    },
];

function DashboardCard({
                           title,
                           description,
                           href,
                           status,
                           accent,
                       }: {
    title: string;
    description: string;
    href: string | null;
    status: string;
    accent: string;
}) {
    const card = (
        <div className="group h-full rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 transition hover:-translate-y-1 hover:border-amber-300/45 hover:shadow-2xl hover:shadow-amber-950/35 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div
                    className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${accent} shadow-lg shadow-amber-950/35`}
                />
                <span
                    className={
                        status === "Live"
                            ? "rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100"
                            : "rounded-full border border-amber-300/20 bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100/70"
                    }
                >
          {status}
        </span>
            </div>

            <h2 className="text-2xl font-black tracking-tight text-amber-50">
                {title}
            </h2>

            <p className="mt-3 text-sm leading-6 text-amber-100/65">
                {description}
            </p>

            <div className="mt-6 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-amber-200">
                {href ? "Open dashboard" : "Planned dashboard"}
                <span className="transition group-hover:translate-x-1">→</span>
            </div>
        </div>
    );

    if (!href) {
        return <div>{card}</div>;
    }

    return (
        <Link href={href} className="block h-full">
            {card}
        </Link>
    );
}

export default async function AdminHomePage() {
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
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
                                <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.95)]" />
                                NutsNews Admin
                            </div>

                            <h1 className="text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">
                                Control Center
                            </h1>

                            <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                                Your private operations home for NutsNews dashboards, platform
                                health, cost visibility, automation status, and future controls.
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

                <section className="mb-5 grid gap-4 md:grid-cols-3">
                    <div className="rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                            Admin Access
                        </p>
                        <h2 className="mt-3 text-2xl font-black text-amber-50">
                            Google Protected
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-amber-100/60">
                            Admin pages are protected by Google login and your approved email
                            allowlist.
                        </p>
                    </div>

                    <div className="rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                            Dashboards
                        </p>
                        <h2 className="mt-3 text-2xl font-black text-amber-50">
                            Expandable
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-amber-100/60">
                            Each dashboard can live on its own page while this page acts as
                            the admin homepage.
                        </p>
                    </div>

                    <div className="rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                            Future Controls
                        </p>
                        <h2 className="mt-3 text-2xl font-black text-amber-50">
                            Ready Later
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-amber-100/60">
                            Controls for feeds, workers, backups, and AI limits can be added
                            behind the same protection.
                        </p>
                    </div>
                </section>

                <section className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 sm:p-6">
                    <div className="mb-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                            Admin Dashboards
                        </p>
                        <h2 className="mt-2 text-2xl font-black text-amber-50">
                            Choose a dashboard
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-amber-100/60">
                            Start with AI usage. More operational dashboards can be added as
                            separate pages under the admin area.
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {dashboards.map((dashboard) => (
                            <DashboardCard
                                key={dashboard.title}
                                title={dashboard.title}
                                description={dashboard.description}
                                href={dashboard.href}
                                status={dashboard.status}
                                accent={dashboard.accent}
                            />
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}