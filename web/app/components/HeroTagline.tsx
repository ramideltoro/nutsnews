"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_STORAGE_KEY,
  type LanguageCode,
  normalizeLanguageCode,
} from "@/lib/languages";

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
};

function getStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE_CODE;
  }

  return normalizeLanguageCode(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

export function HeroTagline() {
  const [languageCode, setLanguageCode] = useState<LanguageCode>(() => getStoredLanguage());

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ languageCode?: string }>;
      setLanguageCode(normalizeLanguageCode(customEvent.detail?.languageCode));
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY) {
        setLanguageCode(normalizeLanguageCode(event.newValue));
      }
    };

    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

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
