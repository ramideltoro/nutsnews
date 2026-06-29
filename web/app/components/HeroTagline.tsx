"use client";

import type { LanguageCode } from "@/lib/languages";
import { useSelectedLanguage } from "./useSelectedLanguage";

const taglineCopy: Record<LanguageCode, { soft: string; accent: string; ariaLabel: string }> = {
  en: {
    soft: "Positive News,",
    accent: "Simplified",
    ariaLabel: "Positive News, Simplified",
  },
  fr: {
    soft: "Actualités positives,",
    accent: "simplifiées",
    ariaLabel: "Actualités positives, simplifiées",
  },
  ja: {
    soft: "ポジティブなニュース、",
    accent: "シンプルに",
    ariaLabel: "ポジティブなニュース、シンプルに",
  },
  "de-CH": {
    soft: "Positive Nachrichten,",
    accent: "einfach erklärt",
    ariaLabel: "Positive Nachrichten, einfach erklärt",
  },
  de: {
    soft: "Positive Nachrichten,",
    accent: "einfach erklärt",
    ariaLabel: "Positive Nachrichten, einfach erklärt",
  },
  el: {
    soft: "Θετικές ειδήσεις,",
    accent: "απλά",
    ariaLabel: "Θετικές ειδήσεις, απλά",
  },
};

export function HeroTagline() {
  const languageCode = useSelectedLanguage();
  const copy = taglineCopy[languageCode] ?? taglineCopy.en;

  return (
    <p className="hero-tagline mx-auto max-w-max" aria-label={copy.ariaLabel}>
      <span className="hero-tagline__spark" aria-hidden="true" />
      <span className="hero-tagline__text">
        <span className="hero-tagline__word hero-tagline__word--soft">{copy.soft}</span>
        <span className="hero-tagline__word hero-tagline__word--accent">{copy.accent}</span>
      </span>
    </p>
  );
}
