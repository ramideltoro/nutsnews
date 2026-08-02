"use client";

import Link from "next/link";

import {
  isGoogleAnalyticsMeasurementId,
  setAnalyticsConsentState,
} from "@/lib/analyticsConsent";
import type { LanguageCode } from "@/lib/languages";
import { useRuntimePublicConfig } from "@/lib/runtimePublicConfigClient";
import { useAnalyticsConsent } from "./useAnalyticsConsent";
import { useSelectedLanguage } from "./useSelectedLanguage";

type AnalyticsConsentBannerCopy = {
  eyebrow: string;
  title: string;
  body: string;
  privacyLink: string;
  denyButton: string;
  allowButton: string;
};

export const analyticsConsentBannerCopyByLanguage: Record<
  LanguageCode,
  AnalyticsConsentBannerCopy
> = {
  en: {
    eyebrow: "Privacy choice",
    title: "Help improve NutsNews",
    body:
      "NutsNews uses Google Analytics 4 for basic page views and engagement only after you allow it. Advertising personalization and Google Signals stay off. Your choice is stored only in this browser.",
    privacyLink: "Privacy details",
    denyButton: "Keep analytics off",
    allowButton: "Allow minimal analytics",
  },
  fr: {
    eyebrow: "Choix de confidentialité",
    title: "Aidez à améliorer NutsNews",
    body:
      "NutsNews utilise Google Analytics 4 pour les pages consultées et l’engagement de base uniquement avec votre accord. La personnalisation publicitaire et Google Signals restent désactivés. Votre choix est enregistré uniquement dans ce navigateur.",
    privacyLink: "Détails de confidentialité",
    denyButton: "Garder l’analyse désactivée",
    allowButton: "Autoriser l’analyse minimale",
  },
  ja: {
    eyebrow: "プライバシー設定",
    title: "NutsNewsの改善にご協力ください",
    body:
      "NutsNewsは、許可された場合にのみ、基本的なページ閲覧数と利用状況の把握にGoogle Analytics 4を使用します。広告のパーソナライズとGoogle Signalsは無効のままです。選択内容はこのブラウザにのみ保存されます。",
    privacyLink: "プライバシーの詳細",
    denyButton: "分析をオフのままにする",
    allowButton: "最小限の分析を許可",
  },
  "de-CH": {
    eyebrow: "Datenschutzauswahl",
    title: "Hilf mit, NutsNews zu verbessern",
    body:
      "NutsNews verwendet Google Analytics 4 nur mit deiner Zustimmung für grundlegende Seitenaufrufe und Nutzungssignale. Anzeigenpersonalisierung und Google Signals bleiben ausgeschaltet. Deine Auswahl wird nur in diesem Browser gespeichert.",
    privacyLink: "Datenschutzdetails",
    denyButton: "Analyse ausgeschaltet lassen",
    allowButton: "Minimale Analyse erlauben",
  },
  de: {
    eyebrow: "Datenschutzauswahl",
    title: "Hilf mit, NutsNews zu verbessern",
    body:
      "NutsNews verwendet Google Analytics 4 nur mit deiner Zustimmung für grundlegende Seitenaufrufe und Nutzungssignale. Anzeigenpersonalisierung und Google Signals bleiben ausgeschaltet. Deine Auswahl wird nur in diesem Browser gespeichert.",
    privacyLink: "Datenschutzdetails",
    denyButton: "Analyse ausgeschaltet lassen",
    allowButton: "Minimale Analyse erlauben",
  },
  el: {
    eyebrow: "Επιλογή απορρήτου",
    title: "Βοηθήστε να βελτιωθεί το NutsNews",
    body:
      "Το NutsNews χρησιμοποιεί το Google Analytics 4 για βασικές προβολές σελίδων και στοιχεία αλληλεπίδρασης μόνο με την άδειά σας. Η εξατομίκευση διαφημίσεων και τα Google Signals παραμένουν απενεργοποιημένα. Η επιλογή σας αποθηκεύεται μόνο σε αυτόν τον browser.",
    privacyLink: "Λεπτομέρειες απορρήτου",
    denyButton: "Διατήρηση των analytics ανενεργών",
    allowButton: "Να επιτρέπονται ελάχιστα analytics",
  },
};

export function AnalyticsConsentBanner() {
  const config = useRuntimePublicConfig();
  const selectedLanguage = useSelectedLanguage();
  const { browserBlocked, storedConsent } = useAnalyticsConsent();
  const copy = analyticsConsentBannerCopyByLanguage[selectedLanguage];
  const analyticsAvailable =
    config?.telemetryEnabled &&
    isGoogleAnalyticsMeasurementId(config.gaId);

  if (!analyticsAvailable || browserBlocked || storedConsent !== null) {
    return null;
  }

  return (
    <section
      data-testid="nutsnews-analytics-consent-banner"
      aria-labelledby="nutsnews-analytics-consent-title"
      aria-describedby="nutsnews-analytics-consent-description"
      className="analytics-consent-banner fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-2xl rounded-[1.5rem] border border-[var(--theme-border-strong)] bg-[var(--theme-surface)] p-4 text-[var(--theme-text)] shadow-2xl shadow-black/60 backdrop-blur-2xl sm:p-5"
    >
      <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[var(--theme-accent-soft)]">
        {copy.eyebrow}
      </p>
      <h2
        id="nutsnews-analytics-consent-title"
        className="mt-1 text-lg font-black tracking-tight text-[var(--theme-heading)]"
      >
        {copy.title}
      </h2>
      <p
        id="nutsnews-analytics-consent-description"
        className="mt-2 text-sm leading-6 text-[var(--theme-muted)]"
      >
        {copy.body}{" "}
        <Link
          href="/privacy/ios"
          data-testid="nutsnews-analytics-consent-privacy"
          className="font-black text-[var(--theme-accent-soft)] underline decoration-[var(--theme-border-strong)] underline-offset-4 hover:text-[var(--theme-heading)]"
        >
          {copy.privacyLink}
        </Link>
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          data-testid="nutsnews-analytics-consent-deny"
          onClick={() => setAnalyticsConsentState("denied")}
          className="min-h-11 rounded-full border border-[var(--theme-border)] bg-black/20 px-5 py-2.5 text-sm font-black text-[var(--theme-heading)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-glow-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-accent)]"
        >
          {copy.denyButton}
        </button>
        <button
          type="button"
          data-testid="nutsnews-analytics-consent-allow"
          onClick={() => setAnalyticsConsentState("granted")}
          className="min-h-11 rounded-full border border-[var(--theme-border-strong)] bg-[var(--theme-accent)] px-5 py-2.5 text-sm font-black text-[var(--theme-button-text)] shadow-lg shadow-black/25 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-accent)]"
        >
          {copy.allowButton}
        </button>
      </div>
    </section>
  );
}
