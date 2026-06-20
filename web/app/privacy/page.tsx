import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "../components/SiteFooter";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read the NutsNews privacy policy, including how the iOS app and website handle article browsing, local likes, caching, diagnostics, and third-party publisher links.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy | NutsNews",
    description:
      "How NutsNews handles privacy for its positive news website and iOS app.",
    url: "/privacy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | NutsNews",
    description:
      "How NutsNews handles privacy for its positive news website and iOS app.",
  },
};

const lastUpdated = "June 19, 2026";

const positivePrivacyPoints = [
  "No account is required to browse NutsNews.",
  "The iOS app does not ask for a name, email address, phone number, password, or payment information.",
  "The iOS app does not use location, camera, microphone, photos, contacts, or health data permissions.",
  "The iOS app does not include advertising SDKs or cross-app tracking features.",
  "Liked stories, theme choices, and haptics preferences are stored locally on the device.",
  "Cached article responses are used to improve speed and reduce unnecessary network requests.",
  "Every story links back to the original publisher instead of republishing the full article.",
];

const sections = [
  {
    title: "Overview",
    body: [
      "NutsNews is a positive news reader that shows short uplifting summaries and links readers back to original publisher websites.",
      "This policy explains how NutsNews handles information in the iOS app and on the NutsNews website.",
    ],
  },
  {
    title: "Information the iOS app does not request",
    body: [
      "The NutsNews iOS app does not require account registration. Readers can open the app and browse stories without providing a name, email address, phone number, password, or payment information.",
      "The iOS app does not request access to location, contacts, photos, camera, microphone, calendars, reminders, health data, Bluetooth, or local network devices.",
      "The iOS app does not include advertising features, an advertising identifier request, or a cross-app tracking prompt.",
    ],
  },
  {
    title: "Local device storage",
    body: [
      "The iOS app stores certain preferences locally on the reader's device. This includes selected app theme, haptics preference, and liked-story identifiers.",
      "Liked stories are saved locally so the same story can appear as liked on both the home feed and story page. This liked-story information is not sent to a NutsNews account because the app does not require accounts.",
      "Readers can remove a liked story by tapping the like button again. Readers can also remove local app data by deleting the app from their device.",
    ],
  },
  {
    title: "Article feed caching",
    body: [
      "To make the app faster and reduce unnecessary network requests, the iOS app may cache recent article feed responses on the device for a limited time.",
      "The cache can include article titles, summaries, source names, publish dates, category labels, thumbnail URLs, and original publisher URLs. This cached article data is used for app performance and reliability, not to personally identify readers.",
      "Pull-to-refresh can request fresh stories, and iOS may clear cached files as part of normal device storage management.",
    ],
  },
  {
    title: "Network requests and server logs",
    body: [
      "When the app loads the feed, it requests article data from the NutsNews website API over HTTPS. Like most internet services, this request may include standard technical information such as IP address, user agent, request time, URL requested, response status, and performance timing.",
      "NutsNews may use standard hosting, security, logging, and monitoring tools to keep the app and website reliable, prevent abuse, understand errors, and improve performance.",
      "NutsNews does not use this technical information to track readers across other companies' apps or websites, and NutsNews does not sell personal information.",
    ],
  },
  {
    title: "Website analytics and diagnostics",
    body: [
      "The NutsNews website may use analytics and diagnostics tools to understand site traffic, reliability, and errors. These tools help improve the website and keep the service working properly.",
      "The iOS app is a separate native app experience. The current iOS app does not include advertising SDKs, account login SDKs, or third-party social login SDKs.",
    ],
  },
  {
    title: "Original publisher links",
    body: [
      "NutsNews links to original publisher websites. When a reader opens an original story, that publisher's website may collect information according to its own privacy policy and practices.",
      "NutsNews is not responsible for the privacy practices of third-party publisher websites, advertising networks, analytics tools, or embedded content that may appear on those publisher websites.",
    ],
  },
  {
    title: "Article content and AI summaries",
    body: [
      "NutsNews uses article metadata from RSS feeds and publisher pages to help identify positive stories and create short summaries.",
      "NutsNews does not republish full copyrighted articles. The service stores and displays article metadata, short summaries, source information, thumbnails, categories, and links back to original publisher pages.",
    ],
  },
  {
    title: "Children's privacy",
    body: [
      "NutsNews is a general-audience news reader. The app and website do not knowingly request personal information from children.",
      "If you believe a child has provided personal information to NutsNews, please contact us so we can review and address the issue.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You can use NutsNews without creating an account. You can unlike stories by tapping the like button again, change local preferences in Settings, and delete the app to remove local app data from your device.",
      "You can choose whether to open original publisher links. Publisher websites are separate from NutsNews and may have their own privacy controls.",
    ],
  },
  {
    title: "Changes to this policy",
    body: [
      "This privacy policy may be updated as NutsNews changes. The latest version will be posted on this page with an updated date.",
    ],
  },
  {
    title: "Contact",
    body: [
      "For questions about this privacy policy, contact Rami Del Toro at rami.deltoro@ramideltoro.com.",
    ],
  },
];

function PolicySection({
  title,
  body,
}: {
  title: string;
  body: string[];
}) {
  return (
    <section className="rounded-[1.75rem] border border-amber-300/15 bg-black/25 p-5 shadow-lg shadow-amber-950/10">
      <h2 className="text-lg font-black tracking-tight text-amber-100">
        {title}
      </h2>
      <div className="mt-3 space-y-3">
        {body.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-7 text-neutral-300">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_34%),linear-gradient(180deg,_#0a0a0a_0%,_#17120a_45%,_#0a0a0a_100%)] px-4 pb-36 pt-6 text-neutral-50">
      <section className="mx-auto w-full max-w-3xl">
        <section className="overflow-hidden rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/25 p-5 shadow-2xl shadow-amber-950/25 ring-1 ring-amber-300/5">
          <div className="rounded-[1.5rem] border border-amber-300/15 bg-gradient-to-br from-black/35 via-neutral-950/80 to-amber-950/25 p-5 shadow-inner shadow-amber-950/10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200">
                Privacy Policy
              </span>
            </div>

            <h1 className="text-4xl font-black tracking-tight text-amber-50 sm:text-5xl">
              NutsNews Privacy Policy
            </h1>

            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300/80">
              Last updated: {lastUpdated}
            </p>

            <p className="mt-6 max-w-2xl text-base leading-8 text-neutral-300">
              NutsNews is built to be simple and privacy-conscious: no account is
              required, app preferences are stored locally, and the app focuses
              on showing positive story summaries with links back to original
              publishers.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300/80">
            Privacy highlights
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-amber-50">
            Clear by design
          </h2>
          <div className="mt-5 grid gap-3">
            {positivePrivacyPoints.map((point) => (
              <div
                key={point}
                className="flex gap-3 rounded-3xl border border-amber-300/15 bg-black/25 p-4"
              >
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]" />
                <p className="text-sm leading-6 text-neutral-300">{point}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-4">
          {sections.map((section) => (
            <PolicySection
              key={section.title}
              title={section.title}
              body={section.body}
            />
          ))}
        </div>

        <section className="mt-6 rounded-[1.75rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15">
          <h2 className="text-lg font-black tracking-tight text-amber-100">
            Return to NutsNews
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-300">
            Continue browsing the latest uplifting stories on the NutsNews home
            feed.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-full border border-amber-300/25 bg-amber-400/15 px-5 py-3 text-sm font-black text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-300 hover:text-neutral-950"
          >
            Back to home
          </Link>
        </section>
      </section>

      <SiteFooter />
    </main>
  );
}
