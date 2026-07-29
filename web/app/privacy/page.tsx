import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "../components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy Policies",
  description:
    "Choose the NutsNews privacy policy for the Android or iOS app.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policies | NutsNews",
    description:
      "Choose the NutsNews privacy policy for the Android or iOS app.",
    url: "/privacy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policies | NutsNews",
    description:
      "Choose the NutsNews privacy policy for the Android or iOS app.",
  },
};

const policyChoices = [
  {
    platform: "Android",
    eyebrow: "Native Android app",
    description:
      "Review how the NutsNews Android app handles local data, network requests, reminders, sharing, and publisher links.",
    href: "https://www.nutsnews.com/privacy/android",
    testId: "android-privacy-choice",
  },
  {
    platform: "iOS",
    eyebrow: "iPhone and website",
    description:
      "Review how the NutsNews iOS app and website handle local choices, caching, diagnostics, analytics, and publisher links.",
    href: "/privacy/ios",
    testId: "ios-privacy-choice",
  },
] as const;

function PlatformIcon({ platform }: { platform: "Android" | "iOS" }) {
  if (platform === "Android") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        <path d="M7.5 7.5 5.8 4.6M16.5 7.5l1.7-2.9" />
        <path d="M6.5 9.2h11a2 2 0 0 1 2 2v6.3a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-6.3a2 2 0 0 1 2-2Z" />
        <path d="M4.5 12v4.5M19.5 12v4.5M8 19.5V22M16 19.5V22" />
        <circle cx="9" cy="12.5" r=".65" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12.5" r=".65" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.4" />
      <path d="M10 5h4M11 18.6h2" />
    </svg>
  );
}

function PolicyChoice({
  choice,
}: {
  choice: (typeof policyChoices)[number];
}) {
  const content = (
    <>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-200 shadow-lg shadow-amber-950/20">
        <PlatformIcon platform={choice.platform} />
      </span>

      <span className="min-w-0">
        <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-amber-300/80">
          {choice.eyebrow}
        </span>
        <span className="mt-2 block text-2xl font-black tracking-tight text-amber-50">
          {choice.platform} Privacy Policy
        </span>
        <span className="mt-3 block text-sm leading-7 text-neutral-300">
          {choice.description}
        </span>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-amber-200">
          Read policy
          <span aria-hidden="true" className="text-lg">
            →
          </span>
        </span>
      </span>
    </>
  );
  const className =
    "group grid min-h-full grid-cols-[auto_minmax(0,1fr)] gap-4 rounded-[1.75rem] border border-amber-300/15 bg-black/25 p-5 no-underline shadow-xl shadow-amber-950/15 transition hover:-translate-y-1 hover:border-amber-200/45 hover:bg-amber-400/10 hover:shadow-2xl hover:shadow-amber-950/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300";
  const ariaLabel = `Read the ${choice.platform} Privacy Policy`;

  if (choice.href.startsWith("https://")) {
    return (
      <a
        href={choice.href}
        className={className}
        aria-label={ariaLabel}
        data-testid={choice.testId}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={choice.href}
      className={className}
      aria-label={ariaLabel}
      data-testid={choice.testId}
    >
      {content}
    </Link>
  );
}

export default function PrivacyPolicySelectionPage() {
  return (
    <main className="public-themed-page modern-home-shell min-h-screen overflow-hidden px-4 pb-36 pt-6 text-[var(--theme-text)]">
      <section className="mx-auto w-full max-w-4xl">
        <header className="overflow-hidden rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/25 p-5 shadow-2xl shadow-amber-950/25 ring-1 ring-amber-300/5 sm:p-7">
          <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/30 p-5 sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200">
                Privacy center
              </span>
            </div>

            <h1 className="mt-5 max-w-2xl text-4xl font-black tracking-tight text-amber-50 sm:text-5xl">
              Choose your privacy policy
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-neutral-300">
              NutsNews provides a dedicated policy for each mobile app. Select
              your platform to see exactly how its features and data are
              handled.
            </p>
          </div>
        </header>

        <section
          aria-label="NutsNews privacy policies"
          className="mt-6 grid gap-4 md:grid-cols-2"
        >
          {policyChoices.map((choice) => (
            <PolicyChoice key={choice.platform} choice={choice} />
          ))}
        </section>

        <nav
          aria-label="Return to NutsNews"
          className="mt-6 flex justify-center"
        >
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-amber-300/25 bg-amber-400/10 px-5 py-3 text-sm font-black text-amber-100 no-underline transition hover:border-amber-200/60 hover:bg-amber-300 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
          >
            Back to NutsNews
          </Link>
        </nav>
      </section>

      <SiteFooter />
    </main>
  );
}
