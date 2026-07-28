import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "../../components/SiteFooter";

export const metadata: Metadata = {
  title: "Android Privacy Policy",
  description:
    "How the NutsNews Android app handles local data, network requests, search, reminders, text-to-speech, sharing, and publisher links.",
  alternates: {
    canonical: "/privacy/android",
  },
  openGraph: {
    title: "Android Privacy Policy | NutsNews",
    description:
      "Privacy details for the native NutsNews Android app.",
    url: "/privacy/android",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Android Privacy Policy | NutsNews",
    description:
      "Privacy details for the native NutsNews Android app.",
  },
};

const highlights = [
  "No NutsNews account is required.",
  "Saved stories, notes, reflections, reading stats, themes, and reminder settings stay on your device.",
  "The Android app contains no advertising, analytics, social-login, or payment SDKs.",
  "Daily reminders are optional local Android notifications, not remote push messages.",
];

const sections = [
  {
    title: "Information stored on your device",
    paragraphs: [
      "NutsNews stores your topic and mood choices, reading goal, theme, haptic and widget settings, optional reminder schedule, saved and liked stories, private notes and reflections, and reading statistics locally on your Android device. NutsNews does not require an account and does not upload this personal app state to a NutsNews account or cloud profile.",
      "The app may cache recent article feed and image data on the device so content loads faster and remains useful during temporary network interruptions. Android may remove cached files during normal storage management.",
    ],
  },
  {
    title: "Feed, article, and search requests",
    paragraphs: [
      "The app uses HTTPS to request article summaries, metadata, images, and archive search results from the NutsNews service. Archive Search sends the words you enter to the NutsNews search API so matching stories can be returned.",
      "Like most internet services, these requests can produce standard technical logs, including an IP address, user agent, request time, requested URL or search query, response status, and performance timing. NutsNews may use those logs to operate the service, diagnose failures, improve reliability, and protect it from abuse. NutsNews does not use them for cross-app advertising profiles and does not sell personal information.",
    ],
  },
  {
    title: "Notifications",
    paragraphs: [
      "The optional Daily good-news reset is a local Android reminder. The app asks for notification permission only after you enable the reminder on an Android version that requires permission. Its schedule is stored on your device, and opening the notification takes you to Today's Picks.",
      "NutsNews does not register the Android app with a remote push-notification provider.",
    ],
  },
  {
    title: "Listen Mode and sharing",
    paragraphs: [
      "Listen Mode asks the Android text-to-speech service installed on your device to read a NutsNews Brief aloud. NutsNews does not send the brief to a NutsNews speech service. A text-to-speech engine supplied by another company may have its own data practices and privacy policy.",
      "When you create or share a Good News Share Card, the app creates the image locally and opens the Android Sharesheet. The app does not know which compatible app you choose. The receiving app's privacy practices apply after you share.",
    ],
  },
  {
    title: "Original publisher links",
    paragraphs: [
      "NutsNews provides short summaries and links to original publisher websites. Opening an original story leaves the native app experience and opens the publisher in a browser or custom tab. That publisher may collect information under its own privacy policy, including through advertising, analytics, or embedded content on its site.",
    ],
  },
  {
    title: "Advertising, analytics, and sensitive permissions",
    paragraphs: [
      "The Android app does not contain ad SDKs, in-app purchases, account-login SDKs, social-login SDKs, or third-party analytics SDKs. It does not request access to precise location, contacts, photos, camera, microphone, health information, or financial information.",
      "Visits to this web policy page are part of the NutsNews website, not the Android app. Website analytics remain off by default and are covered by the separate website privacy policy and its consent controls.",
    ],
  },
  {
    title: "Children and target audience",
    paragraphs: [
      "NutsNews is a general-audience newsreader intended for people age 13 and older. It is not designed for children under 13 and does not knowingly ask children to provide personal information. Original publisher content can cover changing current events and is governed by each publisher's practices.",
    ],
  },
  {
    title: "Your choices and deletion",
    paragraphs: [
      "You can decline notification permission and use the rest of the app. You can disable reminders, remove saved or liked stories, delete notes and reflections, clear app storage in Android Settings, or uninstall NutsNews to remove locally stored app data.",
      "Because NutsNews has no user accounts, it cannot identify an app installation from an account profile. To ask about standard service logs, request privacy help, or report a concern, use the NutsNews contact page.",
    ],
  },
  {
    title: "Changes to this policy",
    paragraphs: [
      "This Android privacy policy may be updated when the app or its supporting services change. The current version and updated date will remain available at this URL.",
    ],
  },
];

export default function AndroidPrivacyPolicyPage() {
  return (
    <main className="public-themed-page modern-home-shell min-h-screen overflow-hidden px-4 pb-36 pt-6 text-[var(--theme-text)]">
      <section className="mx-auto w-full max-w-3xl">
        <header className="overflow-hidden rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/25 p-5 shadow-2xl shadow-amber-950/25 ring-1 ring-amber-300/5">
          <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/30 p-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200">
                Native Android app
              </span>
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-amber-50 sm:text-5xl">
              NutsNews Android Privacy Policy
            </h1>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300/80">
              Last updated: July 28, 2026
            </p>
            <p className="mt-6 max-w-2xl text-base leading-8 text-neutral-300">
              This policy describes the native NutsNews Android app with package
              name <strong className="text-amber-100">com.nutsnews.app</strong>.
              It explains what stays on your device, what the app sends over the
              network, and the controls available to you.
            </p>
          </div>
        </header>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300/80">
            Privacy at a glance
          </p>
          <div className="mt-5 grid gap-3">
            {highlights.map((point) => (
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
            <section
              key={section.title}
              className="rounded-[1.75rem] border border-amber-300/15 bg-black/25 p-5 shadow-lg shadow-amber-950/10"
            >
              <h2 className="text-lg font-black tracking-tight text-amber-100">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-sm leading-7 text-neutral-300"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-6 rounded-[1.75rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15">
          <h2 className="text-lg font-black tracking-tight text-amber-100">
            Contact and related policies
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-300">
            Use the contact page for privacy questions or requests. The general
            privacy policy explains the separate NutsNews website and iOS app.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="inline-flex rounded-full border border-amber-300/25 bg-amber-400/15 px-5 py-3 text-sm font-black text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-300 hover:text-neutral-950"
            >
              Contact NutsNews
            </Link>
            <Link
              href="/privacy"
              className="inline-flex rounded-full border border-neutral-500/40 bg-neutral-900/70 px-5 py-3 text-sm font-black text-neutral-200 transition hover:border-amber-200/60 hover:text-amber-100"
            >
              Website and iOS policy
            </Link>
          </div>
        </section>
      </section>

      <SiteFooter />
    </main>
  );
}
