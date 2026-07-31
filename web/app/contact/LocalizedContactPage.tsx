"use client";

import Link from "next/link";

import { NUTSNEWS_CONTACT_EMAIL } from "@/lib/contactDetails";
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
    contactTitle: string;
    contactBody: string;
    emailLabel: string;
    backTitle: string;
    backBody: string;
    backButton: string;
  }
> = {
  en: {
    eyebrow: "Contact NutsNews",
    title: "Send a message",
    intro:
      "Share feedback, report a site issue, suggest an uplifting source, or send a publisher correction, attribution concern, or source removal request. The message will be sent directly to the NutsNews inbox.",
    contactTitle: "Contact us",
    contactBody:
      "For questions, feedback, corrections, attribution concerns, or source removal requests, email NutsNews directly.",
    emailLabel: "Email",
    backTitle: "Back to the feed",
    backBody:
      "Continue browsing positive stories while your message is on its way.",
    backButton: "Back to home",
  },
  fr: {
    eyebrow: "Contacter NutsNews",
    title: "Envoyer un message",
    intro:
      "Partagez un commentaire, signalez un problème du site, suggérez une source positive ou envoyez une correction d’éditeur, une question d’attribution ou une demande de retrait de source. Le message sera envoyé directement à la boîte de réception NutsNews.",
    contactTitle: "Nous contacter",
    contactBody:
      "Pour toute question, commentaire, correction, question d’attribution ou demande de retrait d’une source, écrivez directement à NutsNews.",
    emailLabel: "E-mail",
    backTitle: "Retour au fil",
    backBody:
      "Continuez à parcourir des histoires positives pendant que votre message est en route.",
    backButton: "Retour à l’accueil",
  },
  ja: {
    eyebrow: "NutsNewsに連絡する",
    title: "メッセージを送る",
    intro:
      "フィードバック、サイトの問題、前向きなニュースソースの提案、出版社の訂正、出典表示の相談、ソース削除の依頼を送れます。内容はNutsNewsの受信箱へ直接届きます。",
    contactTitle: "お問い合わせ",
    contactBody:
      "質問、フィードバック、訂正、出典表示に関するご相談、ソース削除のご依頼は、NutsNewsへ直接メールしてください。",
    emailLabel: "メール",
    backTitle: "フィードに戻る",
    backBody:
      "メッセージを送っている間も、ポジティブなストーリーを続けて読めます。",
    backButton: "ホームに戻る",
  },

  "de-CH": {
    eyebrow: "NutsNews kontaktieren",
    title: "Eine Nachricht senden",
    intro:
      "Teile Feedback, melde ein Problem auf der Website, schlage eine positive Quelle vor oder sende eine Verlagskorrektur, einen Hinweis zur Attribution oder eine Anfrage zur Quellenentfernung. Die Nachricht geht direkt an den NutsNews-Posteingang.",
    contactTitle: "Kontakt",
    contactBody:
      "Für Fragen, Feedback, Korrekturen, Hinweise zur Attribution oder Anfragen zur Quellenentfernung kannst du NutsNews direkt per E-Mail kontaktieren.",
    emailLabel: "E-Mail",
    backTitle: "Zurück zum Feed",
    backBody:
      "Stöbere weiter in positiven Geschichten, während deine Nachricht unterwegs ist.",
    backButton: "Zurück zur Startseite",
  },
  de: {
    eyebrow: "NutsNews kontaktieren",
    title: "Eine Nachricht senden",
    intro:
      "Teile Feedback, melde ein Problem auf der Website, schlage eine positive Quelle vor oder sende eine Verlagskorrektur, einen Hinweis zur Attribution oder eine Anfrage zur Quellenentfernung. Die Nachricht geht direkt an den NutsNews-Posteingang.",
    contactTitle: "Kontakt",
    contactBody:
      "Für Fragen, Feedback, Korrekturen, Hinweise zur Attribution oder Anfragen zur Quellenentfernung kannst du NutsNews direkt per E-Mail kontaktieren.",
    emailLabel: "E-Mail",
    backTitle: "Zurück zum Feed",
    backBody:
      "Stöbere weiter in positiven Geschichten, während deine Nachricht unterwegs ist.",
    backButton: "Zurück zur Startseite",
  },
  el: {
    eyebrow: "Επικοινωνία με το NutsNews",
    title: "Στείλτε ένα μήνυμα",
    intro:
      "Μοιραστείτε σχόλια, αναφέρετε πρόβλημα στον ιστότοπο, προτείνετε θετική πηγή ή στείλτε διόρθωση εκδότη, ζήτημα απόδοσης ή αίτημα αφαίρεσης πηγής. Το μήνυμα θα σταλεί απευθείας στα εισερχόμενα του NutsNews.",
    contactTitle: "Επικοινωνήστε μαζί μας",
    contactBody:
      "Για ερωτήσεις, σχόλια, διορθώσεις, ζητήματα απόδοσης ή αιτήματα αφαίρεσης πηγής, στείλτε email απευθείας στο NutsNews.",
    emailLabel: "Email",
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

        <section
          aria-labelledby="nutsnews-contact-information"
          className="mt-6 rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/25 p-5 shadow-xl shadow-amber-950/15"
        >
          <h2
            id="nutsnews-contact-information"
            className="text-2xl font-black tracking-tight text-amber-100"
          >
            {copy.contactTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-300">
            {copy.contactBody}
          </p>
          <address className="mt-5 not-italic">
            <span className="block text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
              {copy.emailLabel}
            </span>
            <a
              href={`mailto:${NUTSNEWS_CONTACT_EMAIL}`}
              className="mt-2 inline-flex break-all rounded-full border border-amber-300/30 bg-amber-400/15 px-5 py-3 text-sm font-black text-amber-100 transition hover:border-amber-200/70 hover:bg-amber-300 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
            >
              {NUTSNEWS_CONTACT_EMAIL}
            </a>
          </address>
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
