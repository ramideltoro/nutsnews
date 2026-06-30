"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import type { LanguageCode } from "@/lib/languages";
import { SiteFooter } from "../components/SiteFooter";
import { useSelectedLanguage } from "../components/useSelectedLanguage";

const APP_STORE_BADGE_SRC =
  "https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83";

const APP_STORE_URL =
  process.env.NEXT_PUBLIC_NUTSNEWS_IOS_APP_STORE_URL?.trim() ||
  "https://apps.apple.com/";

type RoadmapItem = {
  label: string;
  status: string;
  description: string;
};

type AppsCopy = {
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  appStoreAlt: string;
  appStoreNote: string;
  readWeb: string;
  roadmapEyebrow: string;
  roadmapTitle: string;
  roadmapBody: string;
  roadmapItems: RoadmapItem[];
  shareTitle: string;
  shareBody: string;
  shareLinkLabel: string;
  legal: string;
};

const appsCopyByLanguage: Record<LanguageCode, AppsCopy> = {
  en: {
    heroEyebrow: "NutsNews apps",
    heroTitle: "NutsNews for iPhone is here.",
    heroBody:
      "Open a calmer feed of positive headlines, quick summaries, and good stories whenever you want a lighter scroll.",
    appStoreAlt: "Download on the App Store",
    appStoreNote: "Available for iPhone. Android is next.",
    readWeb: "Read on the web",
    roadmapEyebrow: "Coming next",
    roadmapTitle: "More ways to read NutsNews",
    roadmapBody:
      "This page keeps the homepage clean today and gives every future platform one simple place to live as NutsNews grows.",
    roadmapItems: [
      {
        label: "Android",
        status: "Next",
        description:
          "The next mobile platform planned after the iPhone launch.",
      },
      {
        label: "iPad",
        status: "Planned",
        description:
          "A larger-screen reading experience for positive stories.",
      },
      {
        label: "Apple Watch",
        status: "Later",
        description:
          "Quick positive moments for a smaller screen in a later release.",
      },
      {
        label: "CarPlay",
        status: "Idea",
        description:
          "Audio-friendly positive stories for the road after the core app grows.",
      },
    ],
    shareTitle: "Sharing NutsNews?",
    shareBody:
      "Use this page as the clean link for downloads now and for future platforms later.",
    shareLinkLabel: "nutsnews.com/apps",
    legal:
      "Apple, the Apple logo, App Store, iPhone, iPad, Apple Watch, and CarPlay are trademarks of Apple Inc., registered in the U.S. and other countries.",
  },
  fr: {
    heroEyebrow: "Apps NutsNews",
    heroTitle: "NutsNews pour iPhone est disponible.",
    heroBody:
      "Ouvrez un fil plus calme avec des titres positifs, des résumés courts et de bonnes histoires quand vous voulez faire défiler sans bruit.",
    appStoreAlt: "Download on the App Store",
    appStoreNote: "Disponible pour iPhone. Android arrive ensuite.",
    readWeb: "Lire sur le web",
    roadmapEyebrow: "À venir",
    roadmapTitle: "Plus de façons de lire NutsNews",
    roadmapBody:
      "Cette page garde l’accueil simple aujourd’hui et donne à chaque future plateforme un endroit clair au fur et à mesure que NutsNews grandit.",
    roadmapItems: [
      {
        label: "Android",
        status: "Ensuite",
        description:
          "La prochaine plateforme mobile prévue après le lancement iPhone.",
      },
      {
        label: "iPad",
        status: "Prévu",
        description:
          "Une expérience de lecture plus grande pour les histoires positives.",
      },
      {
        label: "Apple Watch",
        status: "Plus tard",
        description:
          "De petits moments positifs pour un écran plus compact dans une version future.",
      },
      {
        label: "CarPlay",
        status: "Idée",
        description:
          "Des histoires positives adaptées à l’audio pour la route, après la croissance de l’app principale.",
      },
    ],
    shareTitle: "Vous partagez NutsNews ?",
    shareBody:
      "Utilisez cette page comme lien simple pour les téléchargements maintenant et les futures plateformes plus tard.",
    shareLinkLabel: "nutsnews.com/apps",
    legal:
      "Apple, the Apple logo, App Store, iPhone, iPad, Apple Watch, and CarPlay are trademarks of Apple Inc., registered in the U.S. and other countries.",
  },
  ja: {
    heroEyebrow: "NutsNewsアプリ",
    heroTitle: "iPhone向けNutsNewsが登場しました。",
    heroBody:
      "ポジティブな見出し、短い要約、よいニュースを、落ち着いたフィードで気軽に読めます。",
    appStoreAlt: "Download on the App Store",
    appStoreNote: "iPhoneで利用できます。次はAndroidです。",
    readWeb: "Webで読む",
    roadmapEyebrow: "次に来るもの",
    roadmapTitle: "NutsNewsを読む方法を増やしていきます",
    roadmapBody:
      "このページがあることでホーム画面はすっきりしたまま、今後のプラットフォームも一か所にまとめられます。",
    roadmapItems: [
      {
        label: "Android",
        status: "次",
        description: "iPhone版の次に予定しているモバイルプラットフォームです。",
      },
      {
        label: "iPad",
        status: "予定",
        description: "ポジティブなストーリーを大きな画面で読める体験です。",
      },
      {
        label: "Apple Watch",
        status: "今後",
        description: "小さな画面で楽しめる短いポジティブな瞬間を予定しています。",
      },
      {
        label: "CarPlay",
        status: "アイデア",
        description: "アプリが成長した後、移動中に聞きやすいニュース体験を考えています。",
      },
    ],
    shareTitle: "NutsNewsを共有するなら",
    shareBody:
      "今のダウンロードにも、今後のプラットフォームにも使えるシンプルなリンクです。",
    shareLinkLabel: "nutsnews.com/apps",
    legal:
      "Apple, the Apple logo, App Store, iPhone, iPad, Apple Watch, and CarPlay are trademarks of Apple Inc., registered in the U.S. and other countries.",
  },
  "de-CH": {
    heroEyebrow: "NutsNews Apps",
    heroTitle: "NutsNews für iPhone ist da.",
    heroBody:
      "Öffne einen ruhigeren Feed mit positiven Schlagzeilen, kurzen Zusammenfassungen und guten Geschichten, wenn du leichter scrollen möchtest.",
    appStoreAlt: "Download on the App Store",
    appStoreNote: "Verfügbar für iPhone. Android kommt als Nächstes.",
    readWeb: "Im Web lesen",
    roadmapEyebrow: "Als Nächstes",
    roadmapTitle: "Mehr Wege, NutsNews zu lesen",
    roadmapBody:
      "Diese Seite hält die Startseite sauber und gibt jeder zukünftigen Plattform einen einfachen Platz, während NutsNews wächst.",
    roadmapItems: [
      {
        label: "Android",
        status: "Nächstes",
        description:
          "Die nächste mobile Plattform nach dem iPhone-Start.",
      },
      {
        label: "iPad",
        status: "Geplant",
        description:
          "Ein Leseerlebnis für grössere Bildschirme und positive Geschichten.",
      },
      {
        label: "Apple Watch",
        status: "Später",
        description:
          "Kurze positive Momente für einen kleineren Bildschirm in einer späteren Version.",
      },
      {
        label: "CarPlay",
        status: "Idee",
        description:
          "Audiofreundliche positive Geschichten für unterwegs, nachdem die Haupt-App wächst.",
      },
    ],
    shareTitle: "NutsNews teilen?",
    shareBody:
      "Nutze diese Seite als sauberen Link für Downloads jetzt und zukünftige Plattformen später.",
    shareLinkLabel: "nutsnews.com/apps",
    legal:
      "Apple, the Apple logo, App Store, iPhone, iPad, Apple Watch, and CarPlay are trademarks of Apple Inc., registered in the U.S. and other countries.",
  },
  de: {
    heroEyebrow: "NutsNews Apps",
    heroTitle: "NutsNews für iPhone ist da.",
    heroBody:
      "Öffne einen ruhigeren Feed mit positiven Schlagzeilen, kurzen Zusammenfassungen und guten Geschichten, wenn du leichter scrollen möchtest.",
    appStoreAlt: "Download on the App Store",
    appStoreNote: "Verfügbar für iPhone. Android kommt als Nächstes.",
    readWeb: "Im Web lesen",
    roadmapEyebrow: "Als Nächstes",
    roadmapTitle: "Mehr Wege, NutsNews zu lesen",
    roadmapBody:
      "Diese Seite hält die Startseite sauber und gibt jeder zukünftigen Plattform einen einfachen Platz, während NutsNews wächst.",
    roadmapItems: [
      {
        label: "Android",
        status: "Nächstes",
        description:
          "Die nächste mobile Plattform nach dem iPhone-Start.",
      },
      {
        label: "iPad",
        status: "Geplant",
        description:
          "Ein Leseerlebnis für größere Bildschirme und positive Geschichten.",
      },
      {
        label: "Apple Watch",
        status: "Später",
        description:
          "Kurze positive Momente für einen kleineren Bildschirm in einer späteren Version.",
      },
      {
        label: "CarPlay",
        status: "Idee",
        description:
          "Audiofreundliche positive Geschichten für unterwegs, nachdem die Haupt-App wächst.",
      },
    ],
    shareTitle: "NutsNews teilen?",
    shareBody:
      "Nutze diese Seite als sauberen Link für Downloads jetzt und zukünftige Plattformen später.",
    shareLinkLabel: "nutsnews.com/apps",
    legal:
      "Apple, the Apple logo, App Store, iPhone, iPad, Apple Watch, and CarPlay are trademarks of Apple Inc., registered in the U.S. and other countries.",
  },
  el: {
    heroEyebrow: "Εφαρμογές NutsNews",
    heroTitle: "Το NutsNews για iPhone είναι διαθέσιμο.",
    heroBody:
      "Άνοιξε μια πιο ήρεμη ροή με θετικούς τίτλους, σύντομες περιλήψεις και όμορφες ιστορίες όταν θέλεις ένα πιο ανάλαφρο scroll.",
    appStoreAlt: "Download on the App Store",
    appStoreNote: "Διαθέσιμο για iPhone. Το Android είναι το επόμενο.",
    readWeb: "Διάβασε στο web",
    roadmapEyebrow: "Έρχεται μετά",
    roadmapTitle: "Περισσότεροι τρόποι να διαβάζεις NutsNews",
    roadmapBody:
      "Αυτή η σελίδα κρατά την αρχική καθαρή σήμερα και δίνει σε κάθε μελλοντική πλατφόρμα ένα απλό σημείο όσο μεγαλώνει το NutsNews.",
    roadmapItems: [
      {
        label: "Android",
        status: "Επόμενο",
        description:
          "Η επόμενη mobile πλατφόρμα που σχεδιάζεται μετά το iPhone launch.",
      },
      {
        label: "iPad",
        status: "Σχεδιασμένο",
        description:
          "Μια εμπειρία ανάγνωσης σε μεγαλύτερη οθόνη για θετικές ιστορίες.",
      },
      {
        label: "Apple Watch",
        status: "Αργότερα",
        description:
          "Σύντομες θετικές στιγμές για μικρότερη οθόνη σε μελλοντική έκδοση.",
      },
      {
        label: "CarPlay",
        status: "Ιδέα",
        description:
          "Θετικές ιστορίες φιλικές για ήχο στον δρόμο, αφού μεγαλώσει η βασική εφαρμογή.",
      },
    ],
    shareTitle: "Μοιράζεσαι το NutsNews;",
    shareBody:
      "Χρησιμοποίησε αυτή τη σελίδα ως καθαρό link για downloads τώρα και για μελλοντικές πλατφόρμες αργότερα.",
    shareLinkLabel: "nutsnews.com/apps",
    legal:
      "Apple, the Apple logo, App Store, iPhone, iPad, Apple Watch, and CarPlay are trademarks of Apple Inc., registered in the U.S. and other countries.",
  },
};

export function LocalizedAppsPage() {
  const selectedLanguage = useSelectedLanguage();
  const copy = appsCopyByLanguage[selectedLanguage] ?? appsCopyByLanguage.en;

  return (
    <main
      lang={selectedLanguage}
      className="public-themed-page modern-home-shell min-h-screen overflow-hidden px-4 pb-36 pt-6 text-[var(--theme-text)]"
    >
      <section className="mx-auto w-full max-w-4xl">
        <section className="overflow-hidden rounded-[2rem] border border-amber-300/15 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.24),_transparent_38%),linear-gradient(135deg,_#171717,_#0a0a0a_58%,_#451a03)] p-5 shadow-2xl shadow-black/40 ring-1 ring-amber-300/5 sm:p-8">
          <div className="grid gap-6 rounded-[1.5rem] border border-amber-300/15 bg-black/30 p-5 shadow-inner shadow-amber-950/10 sm:p-7 md:grid-cols-[1.4fr_0.9fr] md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-300/80">
                {copy.heroEyebrow}
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tight text-amber-50 sm:text-6xl">
                {copy.heroTitle}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-neutral-300 sm:text-lg sm:leading-9">
                {copy.heroBody}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-amber-300/15 bg-neutral-950/70 p-5 text-center shadow-xl shadow-black/30">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
                aria-label={copy.appStoreAlt}
              >
                <img
                  src={APP_STORE_BADGE_SRC}
                  alt={copy.appStoreAlt}
                  width="190"
                  height="63"
                  className="h-auto w-[190px] max-w-full"
                />
              </a>
              <p className="mt-4 text-sm font-semibold leading-6 text-neutral-300">
                {copy.appStoreNote}
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex rounded-full border border-amber-300/25 bg-amber-400/15 px-5 py-3 text-sm font-black text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-300 hover:text-neutral-950"
              >
                {copy.readWeb}
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-300/15 bg-neutral-900/80 p-5 shadow-xl shadow-black/25 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300/80">
            {copy.roadmapEyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-amber-50 sm:text-3xl">
            {copy.roadmapTitle}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-300 sm:text-base sm:leading-8">
            {copy.roadmapBody}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {copy.roadmapItems.map((item) => (
              <article
                key={item.label}
                className="rounded-3xl border border-white/10 bg-black/25 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-amber-100">
                    {item.label}
                  </h3>
                  <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-amber-200">
                    {item.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-neutral-300">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[1.75rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/15 sm:p-7">
          <h2 className="text-lg font-black tracking-tight text-amber-100">
            {copy.shareTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 text-neutral-300">
            {copy.shareBody}
          </p>
          <p className="mt-4 rounded-2xl border border-amber-300/15 bg-black/25 px-4 py-3 text-sm font-black text-amber-100">
            {copy.shareLinkLabel}
          </p>
        </section>

        <p className="mx-auto mt-6 max-w-3xl text-xs leading-6 text-neutral-500">
          {copy.legal}
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
