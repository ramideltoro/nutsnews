import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "../components/SiteFooter";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact NutsNews with questions, feedback, story ideas, or site issues.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact | NutsNews",
    description:
      "Send a message to NutsNews with questions, feedback, story ideas, or site issues.",
    url: "/contact",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact | NutsNews",
    description:
      "Send a message to NutsNews with questions, feedback, story ideas, or site issues.",
  },
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_34%),linear-gradient(180deg,_#0a0a0a_0%,_#17120a_45%,_#0a0a0a_100%)] px-4 pb-36 pt-6 text-neutral-50">
      <section className="mx-auto w-full max-w-3xl">
        <section className="overflow-hidden rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/25 p-5 shadow-2xl shadow-amber-950/25 ring-1 ring-amber-300/5">
          <div className="rounded-[1.5rem] border border-amber-300/15 bg-gradient-to-br from-black/35 via-neutral-950/80 to-amber-950/25 p-5 shadow-inner shadow-amber-950/10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200">
                Contact NutsNews
              </span>
            </div>

            <h1 className="text-4xl font-black tracking-tight text-amber-50 sm:text-5xl">
              Send a message
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-neutral-300">
              Share feedback, report a site issue, suggest an uplifting source,
              or send a note about NutsNews. The message will be sent directly
              to the NutsNews inbox.
            </p>
          </div>
        </section>

        <ContactForm />

        <section className="mt-6 rounded-[1.75rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15">
          <h2 className="text-lg font-black tracking-tight text-amber-100">
            Back to the feed
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-300">
            Continue browsing positive stories while your message is on its way.
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
