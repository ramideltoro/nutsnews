"use client";

import Link from "next/link";

import { type LanguageCode } from "@/lib/languages";
import { SiteFooter } from "../components/SiteFooter";
import { useSelectedLanguage } from "../components/useSelectedLanguage";
import { ContactForm } from "./ContactForm";

export const contactCopyByLanguage: Record<
  LanguageCode,
  {
    eyebrow: string;
    title: string;
    intro: string;
    backTitle: string;
    backBody: string;
    backButton: string;
  }
> = {
  en: {
    eyebrow: "Contact NutsNews",
    title: "Send a message",
    intro:
      "Share feedback, report a site issue, suggest an uplifting source, or send a note about NutsNews. The message will be sent directly to the NutsNews inbox.",
    backTitle: "Back to the feed",
    backBody:
      "Continue browsing positive stories while your message is on its way.",
    backButton: "Back to home",
  },
  fr: {
    eyebrow: "Contacter NutsNews",
    title: "Envoyer un message",
    intro:
      "Partagez un commentaire, signalez un problème du site, suggérez une source positive ou envoyez simplement un mot à propos de NutsNews. Le message sera envoyé directement à la boîte de réception NutsNews.",
    backTitle: "Retour au fil",
    backBody:
      "Continuez à parcourir des histoires positives pendant que votre message est en route.",
    backButton: "Retour à l’accueil",
  },
  ja: {
    eyebrow: "NutsNewsに連絡する",
    title: "メッセージを送る",
    intro:
      "フィードバック、サイトの問題、前向きなニュースソースの提案、またはNutsNewsへのメッセージを送れます。内容はNutsNewsの受信箱へ直接届きます。",
    backTitle: "フィードに戻る",
    backBody:
      "メッセージを送っている間も、ポジティブなストーリーを続けて読めます。",
    backButton: "ホームに戻る",
  },

  "de-CH": {
    eyebrow: "NutsNews kontaktieren",
    title: "Eine Nachricht senden",
    intro:
      "Teile Feedback, melde ein Problem auf der Website, schlage eine positive Quelle vor oder sende eine Notiz zu NutsNews. Die Nachricht geht direkt an den NutsNews-Posteingang.",
    backTitle: "Zurück zum Feed",
    backBody:
      "Stöbere weiter in positiven Geschichten, während deine Nachricht unterwegs ist.",
    backButton: "Zurück zur Startseite",
  },
  de: {
    eyebrow: "NutsNews kontaktieren",
    title: "Eine Nachricht senden",
    intro:
      "Teile Feedback, melde ein Problem auf der Website, schlage eine positive Quelle vor oder sende eine Notiz zu NutsNews. Die Nachricht geht direkt an den NutsNews-Posteingang.",
    backTitle: "Zurück zum Feed",
    backBody:
      "Stöbere weiter in positiven Geschichten, während deine Nachricht unterwegs ist.",
    backButton: "Zurück zur Startseite",
  },
  el: {
    eyebrow: "Επικοινωνία με το NutsNews",
    title: "Στείλτε ένα μήνυμα",
    intro:
      "Μοιραστείτε σχόλια, αναφέρετε ένα πρόβλημα στον ιστότοπο, προτείνετε μια θετική πηγή ή στείλτε ένα σημείωμα για το NutsNews. Το μήνυμα θα σταλεί απευθείας στα εισερχόμενα του NutsNews.",
    backTitle: "Πίσω στη ροή",
    backBody:
      "Συνεχίστε να διαβάζετε θετικές ιστορίες όσο το μήνυμά σας είναι καθ’ οδόν.",
    backButton: "Πίσω στην αρχική",
  },
};

export function LocalizedContactPage() {
  const selectedLanguage = useSelectedLanguage();
  const copy = contactCopyByLanguage[selectedLanguage];

  return (
    <main
      lang={selectedLanguage}
      className="public-themed-page modern-home-shell min-h-screen overflow-hidden px-4 pb-36 pt-6 text-[var(--theme-text)]"
    >
      <section className="mx-auto w-full max-w-3xl">
        <section className="overflow-hidden rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/25 p-5 shadow-2xl shadow-amber-950/25 ring-1 ring-amber-300/5">
          <div className="rounded-[1.5rem] border border-amber-300/15 bg-gradient-to-br from-black/35 via-neutral-950/80 to-amber-950/25 p-5 shadow-inner shadow-amber-950/10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200">
                {copy.eyebrow}
              </span>
            </div>

            <h1 className="text-4xl font-black tracking-tight text-amber-50 sm:text-5xl">
              {copy.title}
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-neutral-300">
              {copy.intro}
            </p>
          </div>
        </section>

        <ContactForm />

        <section className="mt-6 rounded-[1.75rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15">
          <h2 className="text-lg font-black tracking-tight text-amber-100">
            {copy.backTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-300">
            {copy.backBody}
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-full border border-amber-300/25 bg-amber-400/15 px-5 py-3 text-sm font-black text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-300 hover:text-neutral-950"
          >
            {copy.backButton}
          </Link>
        </section>
      </section>

      <SiteFooter />
    </main>
  );
}
