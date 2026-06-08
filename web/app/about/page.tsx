const techStack = [
  {
    name: "Next.js",
    role: "Mobile-friendly website and article feed",
  },
  {
    name: "GitHub → Vercel CI/CD",
    role: "Every push to the main branch triggers an automatic Vercel build and production deployment.",
  },
  {
    name: "Vercel",
    role: "Frontend hosting, HTTPS, custom domain, and production deployment",
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
  {
    title: "RSS feeds",
    description: "BBC, NPR, and other trusted RSS sources provide story candidates.",
  },
  {
    title: "Cloudflare Worker",
    description: "A scheduled Worker runs every hour and fetches the latest feed items.",
  },
  {
    title: "AI filter",
    description: "OpenAI filters out politics, war, money, crime, fear, and stressful topics.",
  },
  {
    title: "AI summary",
    description: "Accepted articles receive a short calm summary without copying the full article.",
  },
  {
    title: "Supabase",
    description: "Approved stories are stored in a Postgres database.",
  },
  {
    title: "NutsNews website",
    description: "The mobile website displays the latest uplifting stories.",
  },
];

const costItems = [
  {
    name: "Domain",
    cost: "$11.95",
    description: "The only paid cost so far is the nutsnews.com domain registration.",
  },
  {
    name: "Vercel",
    cost: "$0",
    description: "The Next.js website is hosted on Vercel using the free tier.",
  },
  {
    name: "Supabase",
    cost: "$0",
    description: "Article storage uses Supabase on the free tier.",
  },
  {
    name: "Cloudflare Workers",
    cost: "$0",
    description: "Scheduled RSS automation runs on the Cloudflare free tier.",
  },
];

const projectBenefits = [
  {
    title: "Fully automated news agency",
    description:
      "The platform can discover, filter, summarize, store, and publish stories automatically without a traditional editorial production team.",
  },
  {
    title: "Low operating cost",
    description:
      "Using free-tier cloud services keeps the project inexpensive to launch and easy to experiment with.",
  },
  {
    title: "Always-fresh content",
    description:
      "The scheduled worker refreshes the article queue throughout the day, keeping the feed active with no manual work.",
  },
  {
    title: "Focused editorial voice",
    description:
      "AI filtering helps keep the product aligned with a peaceful, uplifting, and positive content strategy.",
  },
  {
    title: "Mobile-first experience",
    description:
      "The site is designed around a simple scrolling feed that feels natural on phones.",
  },
  {
    title: "Scalable architecture",
    description:
      "The system separates the frontend, database, AI workflow, and scheduled worker so each part can grow independently.",
  },
  {
    title: "Fast experimentation",
    description:
      "New RSS sources, categories, prompts, and layout ideas can be tested quickly without rebuilding the whole platform.",
  },
  {
    title: "Source-friendly publishing",
    description:
      "The site avoids republishing full articles and links readers back to the original publishers.",
  },
];

export default function AboutPage() {
  const currentYear = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-neutral-950 text-amber-50">
      <section className="mx-auto min-h-screen w-full max-w-md px-5 pb-28 pt-8">
        <header className="mb-6">
          <div className="relative overflow-hidden rounded-[2rem] border border-amber-400/20 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.24),_transparent_34%),linear-gradient(135deg,_#171717,_#0a0a0a_55%,_#451a03)] p-6 shadow-2xl shadow-black/40">
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

              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-200">
                  Editor-in-Chief: OpenAI
                </p>
                <p className="text-sm font-semibold text-amber-200">
                  Managing Editor: OpenAI
                </p>
              </div>

              <p className="mt-4 max-w-sm text-base leading-7 text-neutral-300">
                NutsNews is a calm, uplifting news experience that collects
                positive stories from trusted RSS feeds, filters out stressful
                topics, and presents short cheerful summaries in a mobile-first
                format.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href="/"
                  className="inline-flex items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500 hover:text-neutral-950"
                >
                  Home
                </a>

                                <a
                  href="#project-benefits"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:border-amber-400/30 hover:text-amber-200"
                >
                  Project Benefits
                </a>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:border-amber-400/30 hover:text-amber-200"
                >
                  How it works
                </a>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-amber-500/20 bg-neutral-900 p-4 shadow-lg shadow-black/20">
            <p className="text-2xl font-black text-amber-300">100</p>
            <p className="mt-1 text-xs leading-5 text-neutral-400">
              Article queue target
            </p>
          </div>

          <div className="rounded-3xl border border-amber-500/20 bg-neutral-900 p-4 shadow-lg shadow-black/20">
            <p className="text-2xl font-black text-amber-300">60 minute</p>
            <p className="mt-1 text-xs leading-5 text-neutral-400">
              Scheduled refresh
            </p>
          </div>

          <div className="rounded-3xl border border-amber-500/20 bg-neutral-900 p-4 shadow-lg shadow-black/20">
            <p className="text-2xl font-black text-amber-300">$11.95</p>
            <p className="mt-1 text-xs leading-5 text-neutral-400">
              Current platform cost
            </p>
          </div>

          <div className="rounded-3xl border border-amber-500/20 bg-neutral-900 p-4 shadow-lg shadow-black/20">
            <p className="text-2xl font-black text-amber-300">A.I.</p>
            <p className="mt-1 text-xs leading-5 text-neutral-400">
              Article selection & summary
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-white">Project Summary</h2>
            <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200 ring-1 ring-amber-400/20">
              MVP
            </span>
          </div>

          <p className="text-sm leading-6 text-neutral-300">
            The goal of NutsNews is to create a peaceful daily feed of
            uplifting, inspiring, human-interest, science, culture, travel,
            wellness, community, animal, and achievement stories.
          </p>

          <p className="mt-3 text-sm leading-6 text-neutral-300">
            The platform avoids politics, war, money, crime, and fear-driven
            content. Articles are discovered through RSS feeds, reviewed by AI,
            rewritten only as short original summaries, stored in Supabase, and
            displayed through a mobile-friendly Next.js website.
          </p>
        </section>

        <section id="project-benefits" className="mb-6 rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20">
  <div className="mb-4 flex items-center justify-between gap-4">
    <h2 className="text-2xl font-bold text-white">Project Benefits</h2>
    <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200 ring-1 ring-amber-400/20">
      Why it matters
    </span>
  </div>

  <p className="text-sm leading-6 text-neutral-300">
    A project like NutsNews shows how to use automation, AI, and
    cloud platforms to build a focused media product with very low overhead.
  </p>

  <div className="mt-5 grid gap-3">
    {projectBenefits.map((benefit) => (
      <div
        key={benefit.title}
        className="rounded-2xl border border-white/10 bg-black/20 p-4"
      >
        <p className="font-bold text-amber-200">{benefit.title}</p>
        <p className="mt-1 text-sm leading-6 text-neutral-400">
          {benefit.description}
        </p>
      </div>
    ))}
  </div>
</section>

        <section
          id="how-it-works"
          className="mb-6 rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20"
        >
          <h2 className="text-2xl font-bold text-white">How It Works</h2>

          <div className="mt-5 space-y-3">
            {pipelineSteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-black text-neutral-950">
                    {index + 1}
                  </div>

                  <div>
                    <p className="font-bold text-amber-200">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-neutral-400">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20">
          <h2 className="text-2xl font-bold text-white">
            Flow Diagram
          </h2>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="space-y-3 text-sm">
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-center">
                <p className="font-bold text-amber-200">Content Sources</p>
                <p className="mt-1 text-xs text-neutral-400">
                  BBC / NPR / RSS Feeds
                </p>
              </div>

              <div className="flex justify-center text-amber-400">↓</div>

              <div className="rounded-2xl border border-white/10 bg-neutral-800 p-4 text-center">
                <p className="font-bold text-white">Automation Layer</p>
                <p className="mt-1 text-xs text-neutral-400">
                  Cloudflare Worker runs hourly
                </p>
              </div>

              <div className="flex justify-center text-amber-400">↓</div>

              <div className="rounded-2xl border border-white/10 bg-neutral-800 p-4 text-center">
                <p className="font-bold text-white">AI Curation Layer</p>
                <p className="mt-1 text-xs text-neutral-400">
                  Filter, classify, summarize
                </p>
              </div>

              <div className="flex justify-center text-amber-400">↓</div>

              <div className="rounded-2xl border border-white/10 bg-neutral-800 p-4 text-center">
                <p className="font-bold text-white">Data Layer</p>
                <p className="mt-1 text-xs text-neutral-400">
                  Supabase Postgres article queue
                </p>
              </div>

              <div className="flex justify-center text-amber-400">↓</div>

              <div className="rounded-2xl bg-amber-500 p-4 text-center">
                <p className="font-black text-neutral-950">
                  NutsNews Mobile Website
                </p>
                <p className="mt-1 text-xs text-neutral-900">
                  Next.js hosted on Vercel
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20">
          <h2 className="text-2xl font-bold text-white">Tech Stack</h2>

          <div className="mt-5 grid gap-3">
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

        <section className="mb-6 rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20">
          <h2 className="text-2xl font-bold text-white">
            Production Deployment
          </h2>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-bold text-amber-200">1. Code commit</p>
              <p className="mt-1 text-sm leading-6 text-neutral-400">
                Changes are committed locally and pushed to GitHub on the main
                branch.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-bold text-amber-200">2. Vercel build</p>
              <p className="mt-1 text-sm leading-6 text-neutral-400">
                Vercel detects the push, installs dependencies, runs the Next.js
                build, and prepares the production deployment.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
              <p className="font-bold text-amber-200">3. Production release</p>
              <p className="mt-1 text-sm leading-6 text-neutral-300">
                If the build succeeds, Vercel automatically publishes the latest
                version to the production NutsNews domain.
              </p>
            </div>
          </div>
        </section>

        <section
          id="cost"
          className="mb-6 rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20"
        >
          <h2 className="text-2xl font-bold text-white">Platform Cost</h2>

          <p className="mt-3 text-sm leading-6 text-neutral-300">
            NutsNews was built to keep startup costs extremely low by using
            free-tier cloud services wherever possible.
          </p>

          <div className="mt-5 space-y-3">
            {costItems.map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-bold text-amber-200">{item.name}</p>
                  <p className="font-bold text-white">{item.cost}</p>
                </div>
                <p className="mt-1 text-sm leading-6 text-neutral-400">
                  {item.description}
                </p>
              </div>
            ))}

            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-bold text-amber-200">Total current cost</p>
                <p className="text-xl font-black text-white">$11.95</p>
              </div>
              <p className="mt-1 text-sm leading-6 text-neutral-300">
                Everything except the domain is currently running on free-tier
                services.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20">
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