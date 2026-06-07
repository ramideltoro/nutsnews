import { ArticleFeed } from "./components/ArticleFeed";

export default function Home() {
  const currentYear = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-neutral-950 text-amber-50">
      <section className="mx-auto min-h-screen w-full max-w-md px-5 pb-28 pt-8">
       <header className="mb-8">
  <div className="relative overflow-hidden rounded-[2rem] border border-amber-400/20 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.22),_transparent_34%),linear-gradient(135deg,_#171717,_#0a0a0a_55%,_#451a03)] p-6 shadow-2xl shadow-black/40">
    <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-amber-400/20 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />

    <div className="relative z-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200">
              Uplifting stories
            </span>
          </div>

          <h1 className="text-5xl font-black tracking-tight text-white">
            Nuts<span className="text-amber-300">News</span>
          </h1>
        </div>

        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-black/25 text-3xl shadow-lg shadow-black/30">
          🌰
        </div>
      </div>

      <p className="max-w-sm text-base leading-7 text-neutral-300">
        A calm, feel-good feed of inspiring stories from around the world.
      </p>

    </div>
  </div>
</header> {/* Keep your existing banner/header here */}

        <ArticleFeed />

        <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-amber-500/20 bg-neutral-950/95 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <a
                href="https://www.linkedin.com/in/ramideltoro"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/20 bg-neutral-900 text-sm font-bold text-amber-300 transition hover:bg-amber-500 hover:text-neutral-950"
              >
                in
              </a>

              <a
                href="https://www.youtube.com/channel/UCJGCyP50Jy6o6AfMdchVOww"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/20 bg-neutral-900 text-sm font-bold text-amber-300 transition hover:bg-amber-500 hover:text-neutral-950"
              >
                ▶
              </a>

              <a
                href="https://www.facebook.com/rami.del.toro.2025"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/20 bg-neutral-900 text-sm font-bold text-amber-300 transition hover:bg-amber-500 hover:text-neutral-950"
              >
                f
              </a>
            </div>

            <p className="text-right text-[11px] leading-4 text-neutral-500">
              © {currentYear} Rami Del Toro, All Rights Reserved.
            </p>
          </div>
        </footer>
      </section>
    </main>
  );
}