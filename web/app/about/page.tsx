const techStack = [
  {
    name: "Next.js",
    role: "Mobile-friendly website and article feed",
  },
  {
    name: "Vercel",
    role: "Frontend hosting and deployment",
  },
  {
    name: "Supabase",
    role: "Postgres database for article storage",
  },
  {
    name: "Cloudflare Workers",
    role: "Scheduled RSS ingestion and automation",
  },
  {
    name: "OpenAI",
    role: "Article filtering and cheerful summary generation",
  },
  {
    name: "RSS Feeds",
    role: "Story sources from trusted publishers",
  },
];

const pipelineSteps = [
  "RSS feeds",
  "Cloudflare Worker",
  "AI filter",
  "AI summary",
  "Supabase",
  "NutsNews website",
];

export default function AboutPage() {
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
                      About the project
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

              <p className="text-sm font-semibold text-amber-200">
                Editor-in-Chief: OpenAI
              </p>

             <p className="text-sm font-semibold text-amber-200">
                Managing Editor: OpenAI
              </p>

              <p className="mt-4 max-w-sm text-base leading-7 text-neutral-300">
                NutsNews is a calm, uplifting news experience that collects
                positive stories from trusted RSS feeds, filters out stressful
                topics, and presents short cheerful summaries in a mobile-first
                format.
              </p>
                <div className="mt-5">
                <a
                    href="/"
                    className="inline-flex items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500 hover:text-neutral-950"
                >
                    Home
                </a>
                </div>
            </div>
          </div>
        </header>

        <section className="mb-8 rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20">
          <h2 className="text-2xl font-bold text-white">Project Summary</h2>

          <p className="mt-3 text-sm leading-6 text-neutral-300">
            The goal of NutsNews is to create a peaceful daily feed of
            uplifting, inspiring, human-interest, science, culture, travel,
            wellness, community, animal, and achievement stories. The platform
            avoids politics, war, money, crime, and fear-driven content.
          </p>

          <p className="mt-3 text-sm leading-6 text-neutral-300">
            Articles are discovered through RSS feeds, reviewed by AI, rewritten
            only as short original summaries, stored in Supabase, and displayed
            through a mobile-friendly Next.js website.
          </p>
        </section>

        <section className="mb-8 rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20">
          <h2 className="text-2xl font-bold text-white">How It Works</h2>

          <div className="mt-5 space-y-3">
            {pipelineSteps.map((step, index) => (
              <div key={step}>
                <div className="rounded-2xl border border-amber-400/20 bg-black/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Step {index + 1}
                  </p>
                  <p className="mt-1 text-lg font-bold text-amber-200">
                    {step}
                  </p>
                </div>

                {index < pipelineSteps.length - 1 && (
                  <div className="flex justify-center py-1 text-amber-400">
                    ↓
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20">
          <h2 className="text-2xl font-bold text-white">
            Architecture Diagram
          </h2>

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="space-y-4 text-sm">
              <div className="rounded-xl bg-amber-400/10 p-3 text-center font-semibold text-amber-200">
                BBC / NPR / RSS Sources
              </div>

              <div className="text-center text-amber-400">↓</div>

              <div className="rounded-xl bg-neutral-800 p-3 text-center font-semibold text-neutral-100">
                Cloudflare Worker runs every hour
              </div>

              <div className="text-center text-amber-400">↓</div>

              <div className="rounded-xl bg-neutral-800 p-3 text-center font-semibold text-neutral-100">
                AI filters + creates short summary
              </div>

              <div className="text-center text-amber-400">↓</div>

              <div className="rounded-xl bg-neutral-800 p-3 text-center font-semibold text-neutral-100">
                Supabase stores approved articles
              </div>

              <div className="text-center text-amber-400">↓</div>

              <div className="rounded-xl bg-amber-500 p-3 text-center font-bold text-neutral-950">
                NutsNews mobile website
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20">
          <h2 className="text-2xl font-bold text-white">Tech Stack</h2>

          <div className="mt-5 space-y-3">
            {techStack.map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <p className="text-base font-bold text-amber-200">
                  {item.name}
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-400">
                  {item.role}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20">
          <h2 className="text-2xl font-bold text-white">Content Safety</h2>

          <p className="mt-3 text-sm leading-6 text-neutral-300">
            NutsNews does not republish full copyrighted articles. It stores the
            source title, original link, article metadata, and a short AI-written
            summary. Every story links back to the original publisher.
          </p>
        </section>
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

              <a
                href="https://github.com/ramideltoro"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/20 bg-neutral-900 text-sm font-bold text-amber-300 transition hover:bg-amber-500 hover:text-neutral-950"
              >
                GH
            </a>
            </div>

            <p className="text-right text-[11px] leading-4 text-neutral-500">
              © {currentYear}{" "}
              <a
                href="https://www.ramideltoro.com"
                target="_blank"
                rel="noreferrer"
                className="text-amber-300 transition hover:text-amber-200"
              >
                Rami Del Toro
              </a>
              , All Rights Reserved.
            </p>
          </div>
        </footer>
      </section>
    </main>
  );
}