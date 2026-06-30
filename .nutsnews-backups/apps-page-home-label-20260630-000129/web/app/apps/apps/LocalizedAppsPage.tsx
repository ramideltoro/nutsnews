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
  readWeb: string;
  roadmapEyebrow: string;
  roadmapTitle: string;
  roadmapBody: string;
  roadmapItems: RoadmapItem[];
};

const appsCopyByLanguage: Record<LanguageCode, AppsCopy> = {
  en: {
    heroEyebrow: "NutsNews apps",
    heroTitle: "NutsNews for iPhone is here.",
    heroBody:
      "Open a calmer feed of positive headlines, quick summaries, and good stories whenever you want a lighter scroll.",
    appStoreAlt: "Download on the App Store",
    readWeb: "Read on the web",
    roadmapEyebrow: "Coming next",
    roadmapTitle: "More ways to read NutsNews",
    roadmapBody:
      "This page keeps every NutsNews platform in one clean place as the app grows.",
    roadmapItems: [
      {
        label: "Android",
        status: "Next",
        description:
          "The next mobile platform planned after the first iPhone release.",
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
  },
  fr: {
    heroEyebrow: "Apps NutsNews",
    heroTitle: "NutsNews pour iPhone est disponible.",
    heroBody:
      "Ouvrez un fil plus calme avec des titres positifs, des résumés courts et de bonnes histoires quand vous voulez faire défiler sans bruit.",
    appStoreAlt: "Download on the App Store",
    readWeb: "Lire sur le web",
    roadmapEyebrow: "À venir",
    roadmapTitle: "Plus de façons de lire NutsNews",
    roadmapBody:
      "Cette page garde chaque plateforme NutsNews dans un seul endroit clair à mesure que l’app grandit.",
    roadmapItems: [
      {
        label: "Android",
        status: "Ensuite",
        description:
          "La prochaine plateforme mobile prévue après la première version iPhone.",
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
  },
  ja: {
    heroEyebrow: "NutsNewsアプリ",
    heroTitle: "iPhone向けNutsNewsが登場しました。",
    heroBody:
      "ポジティブな見出し、短い要約、よいニュースを、落ち着いたフィードで気軽に読めます。",
    appStoreAlt: "Download on the App Store",
    readWeb: "Webで読む",
    roadmapEyebrow: "次に来るもの",
    roadmapTitle: "NutsNewsを読む方法を増やしていきます",
    roadmapBody:
      "このページに、NutsNewsの各プラットフォームをすっきりまとめていきます。",
    roadmapItems: [
      {
        label: "Android",
        status: "次",
        description: "最初のiPhone版の次に予定しているモバイルプラットフォームです。",
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
  },
  "de-CH": {
    heroEyebrow: "NutsNews Apps",
    heroTitle: "NutsNews für iPhone ist da.",
    heroBody:
      "Öffne einen ruhigeren Feed mit positiven Schlagzeilen, kurzen Zusammenfassungen und guten Geschichten, wenn du leichter scrollen möchtest.",
    appStoreAlt: "Download on the App Store",
    readWeb: "Im Web lesen",
    roadmapEyebrow: "Als Nächstes",
    roadmapTitle: "Mehr Wege, NutsNews zu lesen",
    roadmapBody:
      "Diese Seite hält jede NutsNews-Plattform an einem klaren Ort, während die App wächst.",
    roadmapItems: [
      {
        label: "Android",
        status: "Nächstes",
        description:
          "Die nächste mobile Plattform nach der ersten iPhone-Version.",
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
  },
  de: {
    heroEyebrow: "NutsNews Apps",
    heroTitle: "NutsNews für iPhone ist da.",
    heroBody:
      "Öffne einen ruhigeren Feed mit positiven Schlagzeilen, kurzen Zusammenfassungen und guten Geschichten, wenn du leichter scrollen möchtest.",
    appStoreAlt: "Download on the App Store",
    readWeb: "Im Web lesen",
    roadmapEyebrow: "Als Nächstes",
    roadmapTitle: "Mehr Wege, NutsNews zu lesen",
    roadmapBody:
      "Diese Seite hält jede NutsNews-Plattform an einem klaren Ort, während die App wächst.",
    roadmapItems: [
      {
        label: "Android",
        status: "Nächstes",
        description:
          "Die nächste mobile Plattform nach der ersten iPhone-Version.",
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
  },
  el: {
    heroEyebrow: "Εφαρμογές NutsNews",
    heroTitle: "Το NutsNews για iPhone είναι διαθέσιμο.",
    heroBody:
      "Άνοιξε μια πιο ήρεμη ροή με θετικούς τίτλους, σύντομες περιλήψεις και όμορφες ιστορίες όταν θέλεις ένα πιο ανάλαφρο scroll.",
    appStoreAlt: "Download on the App Store",
    readWeb: "Διάβασε στο web",
    roadmapEyebrow: "Έρχεται μετά",
    roadmapTitle: "Περισσότεροι τρόποι να διαβάζεις NutsNews",
    roadmapBody:
      "Αυτή η σελίδα κρατά κάθε πλατφόρμα του NutsNews σε ένα καθαρό σημείο όσο μεγαλώνει η εφαρμογή.",
    roadmapItems: [
      {
        label: "Android",
        status: "Επόμενο",
        description:
          "Η επόμενη mobile πλατφόρμα που σχεδιάζεται μετά την πρώτη έκδοση για iPhone.",
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
              <Link
                href="/"
                className="mt-5 inline-flex rounded-full border border-amber-300/25 bg-amber-400/15 px-5 py-3 text-sm font-black text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-300 hover:text-neutral-950"
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
      </section>

      <SiteFooter />
    </main>
  );
}
