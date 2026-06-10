import type { Metadata } from "next";

import { SiteFooter } from "../components/SiteFooter";

export const metadata: Metadata = {
  title: "About NutsNews",
  description:
    "Learn how NutsNews uses RSS feeds, Cloudflare Workers, Supabase, and AI to create a calm feed of uplifting stories.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About NutsNews",
    description:
      "How NutsNews automatically discovers, filters, summarizes, and publishes uplifting stories.",
    url: "/about",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About NutsNews",
    description:
      "Learn how NutsNews uses automation and AI to curate positive stories from trusted sources.",
  },
};

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
    description:
      "A scheduled Worker runs every hour and fetches the latest feed items.",
  },
  {
    title: "AI filter",
    description:
      "OpenAI filters out politics, war, money, crime, fear, and stressful topics.",
  },
  {
    title: "AI summary",
    description:
      "Accepted articles receive a short calm summary without copying the full article.",
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
    description:
      "The only paid cost so far is the nutsnews.com domain registration.",
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
    description:
      "Scheduled RSS automation runs on the Cloudflare free tier.",
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

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300/80">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-amber-50">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-sm leading-7 text-neutral-300">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_34%),linear-gradient(180deg,_#0a0a0a_0%,_#17120a_45%,_#0a0a0a_100%)] text-neutral-50">
      <section className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/25 p-5 shadow-2xl shadow-amber-950/25 ring-1 ring-amber-300/5">
          <div className="rounded-[1.5rem] border border-amber-300/15 bg-gradient-to-br from-black/35 via-neutral-950/80 to-amber-950/25 p-5 shadow-inner shadow-amber-950/10">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-300/80">
              About the project
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-amber-50">
              NutsNews
            </h1>

            <div className="mt-5 space-y-3 text-sm font-semibold text-amber-200/85">
              <p className="rounded-2xl border border-amber-300/15 bg-black/20 p-3">
                Media Owner: Rami Del Toro
              </p>
              <p className="rounded-2xl border border-amber-300/15 bg-black/20 p-3">
                Editor-in-Chief: OpenAI
              </p>
              <p className="rounded-2xl border border-amber-300/15 bg-black/20 p-3">
                Managing Editor: OpenAI
              </p>
            </div>

            <p className="mt-6 text-base leading-8 text-neutral-300">
              NutsNews is a calm, uplifting news experience that collects positive
              stories from trusted RSS feeds, filters out stressful topics, and
              presents short cheerful summaries in a mobile-first format.
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            {[
              ["1000", "Candidate articles scanned per refresh"],
              ["60 minute", "Scheduled refresh"],
              ["$11.95", "Current platform cost"],
              ["A.I.", "Article selection & summary"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-3xl border border-amber-300/15 bg-black/25 p-4 shadow-lg shadow-amber-950/10"
              >
                <p className="text-3xl font-black text-amber-300">{value}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-neutral-900/80 p-5 shadow-xl shadow-black/25">
          <SectionHeading eyebrow="MVP" title="Project Summary" />

          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <p className="text-sm leading-7 text-neutral-300">
              The goal of NutsNews is to create a peaceful daily feed of
              uplifting, inspiring, human-interest, science, culture, travel,
              wellness, community, animal, and achievement stories.
            </p>
            <p className="mt-4 text-sm leading-7 text-neutral-300">
              The platform avoids politics, war, money, crime, and fear-driven
              content. Articles are discovered through RSS feeds, reviewed by AI,
              rewritten only as short original summaries, stored in Supabase, and
              displayed through a mobile-friendly Next.js website.
            </p>
          </div>
        </section>

        <section
          id="benefits"
          className="mt-6 rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15"
        >
          <SectionHeading
            eyebrow="Why it matters"
            title="Project Benefits"
            description="A project like NutsNews shows how to use automation, AI, and cloud platforms to build a focused media product with very low overhead."
          />

          <div className="grid gap-3">
            {projectBenefits.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-3xl border border-amber-300/15 bg-black/25 p-5 transition hover:border-amber-300/30"
              >
                <h3 className="text-base font-black text-amber-100">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-300">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="how-it-works"
          className="mt-6 rounded-[2rem] border border-amber-300/15 bg-neutral-900/80 p-5 shadow-xl shadow-black/25"
        >
          <SectionHeading eyebrow="Pipeline" title="How It Works" />

          <div className="grid gap-3">
            {pipelineSteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-3xl border border-white/10 bg-black/20 p-5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/30 bg-amber-400/15 text-sm font-black text-amber-200">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-base font-black text-amber-50">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-300">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15">
          <SectionHeading eyebrow="System view" title="Flow Diagram" />

          <div className="grid gap-3">
            {[
              ["Content Sources", "BBC / NPR / RSS Feeds"],
              ["Automation Layer", "Cloudflare Worker runs hourly"],
              ["AI Curation Layer", "Filter, classify, summarize"],
              ["Data Layer", "Supabase Postgres article queue"],
              ["NutsNews Mobile Website", "Next.js hosted on Vercel"],
            ].map(([title, description], index) => (
              <div key={title}>
                <div className="rounded-3xl border border-amber-300/15 bg-black/25 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300/75">
                    {title}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-neutral-200">
                    {description}
                  </p>
                </div>

                {index < 4 ? (
                  <div className="flex justify-center py-2 text-xl font-black text-amber-400/70">
                    ↓
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-neutral-900/80 p-5 shadow-xl shadow-black/25">
          <SectionHeading eyebrow="Infrastructure" title="Tech Stack" />

          <div className="grid gap-3">
            {techStack.map((item) => (
              <div
                key={item.name}
                className="rounded-3xl border border-white/10 bg-black/20 p-5"
              >
                <h3 className="text-base font-black text-amber-200">
                  {item.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-300">
                  {item.role}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15">
          <SectionHeading eyebrow="Shipping" title="Production Deployment" />

          <div className="grid gap-3">
            {[
              [
                "1. Code commit",
                "Changes are committed locally and pushed to GitHub on the main branch.",
              ],
              [
                "2. Vercel build",
                "Vercel detects the push, installs dependencies, runs the Next.js build, and prepares the production deployment.",
              ],
              [
                "3. Production release",
                "If the build succeeds, Vercel automatically publishes the latest version to the production NutsNews domain.",
              ],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-3xl border border-amber-300/15 bg-black/25 p-5"
              >
                <h3 className="text-base font-black text-amber-100">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-300">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-neutral-900/80 p-5 shadow-xl shadow-black/25">
          <SectionHeading
            eyebrow="Lean startup"
            title="Platform Cost"
            description="NutsNews was built to keep startup costs extremely low by using free-tier cloud services wherever possible."
          />

          <div className="grid gap-3">
            {costItems.map((item) => (
              <div
                key={item.name}
                className="rounded-3xl border border-white/10 bg-black/20 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-base font-black text-amber-200">
                    {item.name}
                  </h3>
                  <p className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-sm font-black text-amber-200">
                    {item.cost}
                  </p>
                </div>
                <p className="mt-3 text-sm leading-6 text-neutral-300">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-3xl border border-amber-300/20 bg-gradient-to-r from-amber-400/15 to-orange-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300/80">
              Total current cost
            </p>
            <p className="mt-2 text-4xl font-black text-amber-200">$11.95</p>
            <p className="mt-2 text-sm leading-6 text-neutral-300">
              Everything except the domain is currently running on free-tier
              services.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15">
          <SectionHeading eyebrow="Publishing policy" title="Content Safety" />

          <div className="rounded-3xl border border-amber-300/15 bg-black/25 p-5">
            <p className="text-sm leading-7 text-neutral-300">
              NutsNews does not republish full copyrighted articles. It stores
              the source title, original link, article metadata, and a short
              AI-written summary. Every story links back to the original
              publisher.
            </p>
          </div>
        </section>
      </section>

      <SiteFooter />
    </main>
  );
}