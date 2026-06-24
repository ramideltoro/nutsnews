import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "../components/SiteFooter";

export const metadata: Metadata = {
  title: "About NutsNews",
  description:
    "Learn why NutsNews exists and how it brings positive, uplifting stories together through thoughtful automation, AI curation, and a calm reader experience.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About NutsNews",
    description:
      "A calmer way to follow the world: positive stories, thoughtful summaries, source-friendly links, and technology built around uplifting news.",
    url: "/about",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About NutsNews",
    description:
      "NutsNews is a positive news experience built to make the internet feel calmer, kinder, and easier to enjoy.",
  },
};

const promises = [
  {
    title: "Positive by design",
    description:
      "NutsNews looks for stories that leave readers feeling encouraged: community wins, inspiring people, helpful science, wellness, animals, travel, culture, and small moments of progress.",
  },
  {
    title: "Simple on purpose",
    description:
      "The experience is built around a clean scrolling feed, short summaries, useful categories, and a clear path back to the original publisher.",
  },
  {
    title: "Respectful of attention",
    description:
      "The goal is not to keep readers doom-scrolling. The goal is to make it easy to find something good, feel a little better, and move on with your day.",
  },
];

const builtFeatures = [
  "A mobile first NutsNews website with a calm amber visual identity",
  "Publisher RSS ingestion that discovers fresh story candidates automatically",
  "AI-assisted filtering for uplifting, non-stressful stories",
  "Short, original summaries that help readers decide what to open",
  "Article categories for browsing by mood and theme",
  "Thumbnail-first story cards with source and date context",
  "Infinite scrolling for a lightweight daily feed experience",
  "Contact and privacy pages for a more complete public site",
  "Admin dashboards for reviewing operations, AI usage, feeds, and system health",
  "Cloudflare, Vercel, and Supabase infrastructure for speed, scale, and low operating cost",
  "Better Stack and Sentry observability so issues are easier to detect and fix",
  "A native iOS companion app built around the same positive-news experience",
];

function DiscoverIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <circle cx="6" cy="18" r="1.5" />
      <path d="M5 11a8 8 0 0 1 8 8" />
      <path d="M5 5a14 14 0 0 1 14 14" />
    </svg>
  );
}

function FilterIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M4 5h16" />
      <path d="M7 11h10" />
      <path d="M10 17h4" />
    </svg>
  );
}

function SummaryIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 12h6" />
      <path d="M10 16h4" />
    </svg>
  );
}

function ExternalStoryIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M14 4h6v6" />
      <path d="M10 14 20 4" />
      <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

const workflow = [
  {
    step: "Discover",
    title: "Fresh stories come from publisher feeds",
    description:
      "NutsNews starts with RSS sources from real publishers, then continuously checks for new articles that may fit the tone of the site.",
    Icon: DiscoverIcon,
  },
  {
    step: "Filter",
    title: "AI helps protect the mood of the feed",
    description:
      "The curation layer rejects stressful topics and favors stories that are constructive, human, useful, hopeful, or simply delightful.",
    Icon: FilterIcon,
  },
  {
    step: "Summarize",
    title: "Readers get the calm version first",
    description:
      "Accepted articles are presented with short summaries, metadata, and categories so the feed stays quick, readable, and easy to explore.",
    Icon: SummaryIcon,
  },
  {
    step: "Send readers onward",
    title: "Original publishers remain the destination",
    description:
      "NutsNews does not try to replace the article. Every story points back to the original source so readers can continue with the publisher who reported it.",
    Icon: ExternalStoryIcon,
  },
];

const principles = [
  {
    title: "Calm technology",
    description:
      "The engineering behind NutsNews is meant to disappear into the background. Workers, caching, monitoring, and dashboards all support a simple reader promise: the site should feel fast, steady, and peaceful.",
  },
  {
    title: "Human centered curation",
    description:
      "AI is used as a helper, not as a replacement for taste. The product is shaped around a clear editorial direction: fewer stressful headlines, more stories worth smiling about.",
  },
  {
    title: "Lean and resilient",
    description:
      "The platform was built with practical tools that can scale gradually: Next.js for the website, Cloudflare Workers for automation, Supabase for storage, Vercel for deployment, and observability for reliability.",
  },
  {
    title: "Room to grow",
    description:
      "NutsNews is still evolving. The foundation supports more feeds, richer categories, better dashboards, smarter quality controls, and a smoother experience across web and mobile.",
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
      <h2 className="mt-2 text-2xl font-black tracking-tight text-amber-50 sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-sm leading-7 text-neutral-300 sm:text-base sm:leading-8">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_34%),linear-gradient(180deg,_#0a0a0a_0%,_#17120a_45%,_#0a0a0a_100%)] pb-28 text-neutral-50">
      <section className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-amber-300/15 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.24),_transparent_38%),linear-gradient(135deg,_#171717,_#0a0a0a_58%,_#451a03)] p-5 shadow-2xl shadow-black/40 ring-1 ring-amber-300/5 sm:p-8">
          <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/30 p-5 shadow-inner shadow-amber-950/10 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-300/80">
              About NutsNews
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tight text-amber-50 sm:text-6xl">
              A calmer way to keep up with the good happening in the world.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-neutral-300 sm:text-lg sm:leading-9">
              NutsNews exists because the internet can feel heavy. The world is
              full of kindness, progress, creativity, courage, discovery, and
              everyday people doing remarkable things, but those stories are easy
              to miss. NutsNews brings them forward in one simple place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-full border border-amber-300/30 bg-amber-300 px-5 py-2 text-sm font-black text-neutral-950 transition hover:bg-amber-200"
              >
                Read today&apos;s stories
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-amber-300/25 bg-amber-300/10 px-5 py-2 text-sm font-bold text-amber-100 transition hover:bg-amber-300/20"
              >
                Contact NutsNews
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-neutral-900/80 p-5 shadow-xl shadow-black/25 sm:p-7">
          <SectionHeading
            eyebrow="Why it exists"
            title="Good news should be easier to find"
            description="NutsNews is built for readers who want to stay connected to the world without being overwhelmed by it. The mission is to create a daily feed that feels optimistic, useful, and respectful of your attention."
          />

          <div className="grid gap-3 md:grid-cols-3">
            {promises.map((promise) => (
              <article
                key={promise.title}
                className="rounded-3xl border border-white/10 bg-black/25 p-5"
              >
                <h3 className="text-base font-black text-amber-100">
                  {promise.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-neutral-300">
                  {promise.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15 sm:p-7">
          <SectionHeading
            eyebrow="The name"
            title="Why it is called NutsNews"
            description="The name came from the same search that shaped the product: a search for something positive, memorable, and worthy of a .com home."
          />

          <div className="rounded-3xl border border-amber-300/15 bg-black/25 p-5">
            <div className="space-y-4 text-sm leading-8 text-neutral-300 sm:text-base sm:leading-8">
              <p>
                The first idea was the most obvious one: GoodNews.com. It said
                exactly what the site was meant to be. But that domain was
                already taken, and so were the clean, simple variations around
                good news. The project needed a name that could stand on its own,
                feel distinctive, and still live at a classic .com address.
              </p>
              <p>
                During that search, the name wandered from domain checkers to the
                thesaurus. While looking through synonyms for &ldquo;good,&rdquo; one word
                made itself impossible to ignore: &ldquo;nuts.&rdquo; In poker,
                the nuts means the best possible hand.
                That meaning changed the whole name from a compromise into
                simply perfect.
              </p>
              <p>
                NutsNews became more than a playful title. It became a statement
                of intent: this is a place for the best kind of news, the stories
                that feel worth keeping, sharing, and returning to. The name is
                short, memorable, a little unexpected, and quietly connected to
                the idea at the center of the site, finding the good stuff.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15 sm:p-7">
          <SectionHeading
            eyebrow="What it is trying to do"
            title="Turn the news feed into a better habit"
            description="The project is not trying to pretend hard things do not exist. It is trying to make room for the other side of the story too: the helpers, the builders, the breakthroughs, the recoveries, the tiny wins, and the reminders that people are still doing good work everywhere."
          />

          <div className="rounded-3xl border border-amber-300/15 bg-black/25 p-5">
            <p className="text-sm leading-8 text-neutral-300 sm:text-base sm:leading-8">
              A great NutsNews story should feel like a small reset. It may teach
              you something, introduce you to a person worth knowing about,
              highlight a community solving a problem, or simply give you a
              moment of relief. The feed is intentionally focused, filtered, and
              lightweight so readers can enjoy positive stories without digging
              through a noisy internet first.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-neutral-900/80 p-5 shadow-xl shadow-black/25 sm:p-7">
          <SectionHeading
            eyebrow="What has been built"
            title="A full positive news platform, not just a page"
            description="NutsNews has grown into a working product with a public website, automated article pipeline, admin tools, monitoring, mobile experience, and a native iOS app foundation."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {builtFeatures.map((feature) => (
              <div
                key={feature}
                className="rounded-3xl border border-white/10 bg-black/20 p-4"
              >
                <p className="text-sm font-semibold leading-6 text-neutral-200">
                  {feature}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15 sm:p-7">
          <SectionHeading
            eyebrow="How it works"
            title="A careful pipeline behind a simple feed"
            description="Readers see a quiet list of stories. Behind that list is a system that discovers articles, filters them for tone and fit, prepares useful summaries, and keeps the site running with practical cloud infrastructure."
          />

          <div className="grid gap-4">
            {workflow.map((item) => {
              const Icon = item.Icon;

              return (
                <article
                key={item.step}
                className="rounded-3xl border border-amber-300/15 bg-black/25 p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-300/30 bg-amber-400/15 text-amber-200 shadow-lg shadow-amber-950/20">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300/75">
                      {item.step}
                    </p>
                    <h3 className="mt-1 text-lg font-black text-amber-50">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-neutral-300">
                      {item.description}
                    </p>
                  </div>
                </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-neutral-900/80 p-5 shadow-xl shadow-black/25 sm:p-7">
          <SectionHeading
            eyebrow="Built with intention"
            title="The product values"
            description="Every technical decision supports the same reader experience: faster access to better-feeling stories, fewer distractions, and a site that can grow without becoming complicated to use."
          />

          <div className="grid gap-3 md:grid-cols-2">
            {principles.map((principle) => (
              <article
                key={principle.title}
                className="rounded-3xl border border-white/10 bg-black/20 p-5 transition hover:border-amber-300/30"
              >
                <h3 className="text-base font-black text-amber-100">
                  {principle.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-neutral-300">
                  {principle.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-amber-300/15 bg-[radial-gradient(circle_at_bottom_left,_rgba(245,158,11,0.18),_transparent_34%),linear-gradient(135deg,_#0a0a0a,_#171717_58%,_#451a03)] p-5 shadow-2xl shadow-black/40 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-300/80">
            The bigger idea
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight text-amber-50 sm:text-5xl">
            NutsNews is a reminder that positive stories deserve great product
            design too.
          </h2>
          <p className="mt-5 max-w-3xl text-sm leading-8 text-neutral-300 sm:text-base sm:leading-8">
            The best version of NutsNews is warm, useful, trustworthy, and easy
            to return to. It should feel like opening a window instead of
            entering a storm. That is the story this project is trying to tell:
            technology can help make media gentler, more focused, and more human.
          </p>
        </section>
      </section>

      <SiteFooter />
    </main>
  );
}
