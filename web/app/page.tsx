import { ArticleFeed } from "./components/ArticleFeed";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-amber-50">
      <section className="mx-auto min-h-screen w-full max-w-md px-5 py-8">
<header className="mb-8">
  <div className="relative overflow-hidden rounded-[2rem] border border-amber-400/20 bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950 p-6 shadow-2xl shadow-black/30">
    <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-orange-500/10 blur-3xl" />

    <div className="relative z-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
            Feel-good daily feed
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
            Nuts News
          </h1>
        </div>

        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-2xl shadow-lg shadow-black/20">
          🌰
        </div>
      </div>

      <p className="max-w-sm text-base leading-7 text-neutral-300">
        A calm, uplifting stream of inspiring stories from around the world —
        refreshed throughout the day.
      </p>
    </div>
  </div>
</header>

        <ArticleFeed />
      </section>
    </main>
  );
}