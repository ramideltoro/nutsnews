import { auth, signOut } from "@/auth";

export const metadata = {
    title: "Admin | NutsNews",
};

export default async function AdminPage() {
    const session = await auth();

    return (
        <main className="min-h-screen overflow-hidden bg-[#0a0a0a] px-4 py-6 text-amber-50 sm:px-6 lg:px-8">
            <div className="pointer-events-none fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.22),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.14),_transparent_34%),linear-gradient(135deg,_#0a0a0a,_#171717_52%,_#451a03)]" />
                <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/10 blur-3xl" />
                <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
            </div>

            <div className="mx-auto max-w-6xl">
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

                            <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-100/70">
                                Internal dashboards and future controls for AI usage, worker
                                shards, RSS feeds, observability, and platform operations.
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
                            Admin Status
                        </p>
                        <h2 className="mt-3 text-2xl font-black text-amber-50">Active</h2>
                        <p className="mt-2 text-sm leading-6 text-amber-100/60">
                            Google login is enabled and access is restricted to the approved
                            admin account.
                        </p>
                    </div>

                    <div className="rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                            AI Cost Protection
                        </p>
                        <h2 className="mt-3 text-2xl font-black text-amber-50">
                            Coming Soon
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-amber-100/60">
                            Track OpenAI review counts, token usage, estimated cost, and
                            spikes by shard.
                        </p>
                    </div>

                    <div className="rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                            Worker Shards
                        </p>
                        <h2 className="mt-3 text-2xl font-black text-amber-50">
                            Coming Soon
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-amber-100/60">
                            Monitor shard runs, feed counts, failed fetches, runtime, and
                            latest refresh status.
                        </p>
                    </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 sm:p-6">
                        <div className="mb-5 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                                    Dashboard Roadmap
                                </p>
                                <h2 className="mt-2 text-2xl font-black text-amber-50">
                                    What this admin area will manage
                                </h2>
                            </div>
                        </div>

                        <div className="grid gap-3">
                            {[
                                "AI usage and estimated OpenAI cost",
                                "Accepted vs rejected article decisions",
                                "Shard health and latest worker runs",
                                "RSS feed health and failed feeds",
                                "Manual refresh and pause controls",
                                "Backup and restore status",
                            ].map((item) => (
                                <div
                                    key={item}
                                    className="flex items-center gap-3 rounded-[1.35rem] border border-amber-300/15 bg-black/30 px-4 py-3 text-sm text-amber-100/80"
                                >
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.95)]" />
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 sm:p-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                            Access Rule
                        </p>
                        <h2 className="mt-2 text-2xl font-black text-amber-50">
                            Only one Google account can enter
                        </h2>

                        <div className="mt-5 rounded-[1.45rem] border border-amber-300/15 bg-black/30 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300/75">
                                Allowed email
                            </p>
                            <p className="mt-2 break-all text-lg font-black text-amber-50">
                                rami.deltoro@gmail.com
                            </p>
                        </div>

                        <p className="mt-5 text-sm leading-6 text-amber-100/65">
                            Any other Google account is redirected to the access denied page.
                            This keeps the admin console private while still giving you a
                            clean Google login flow.
                        </p>
                    </div>
                </section>
            </div>
        </main>
    );
}