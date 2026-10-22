"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_STORAGE_KEY,
  type LanguageCode,
  isSupportedLanguageCode,
  normalizeLanguageCode,
} from "@/lib/languages";

function readStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE_CODE;
  }

  return normalizeLanguageCode(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

export function useSelectedLanguage() {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(
    DEFAULT_LANGUAGE_CODE,
  );

  useEffect(() => {
    const applyLanguage = (languageCode: LanguageCode) => {
      document.documentElement.lang = languageCode;
      setSelectedLanguage(languageCode);
    };

    const initialLanguageTimer = window.setTimeout(
      () => applyLanguage(readStoredLanguage()),
      0,
    );

    const handleLanguageChange = (event: Event) => {
      window.clearTimeout(initialLanguageTimer);
      const nextLanguage = (event as CustomEvent<{ languageCode?: string }>)
        .detail?.languageCode;

      if (isSupportedLanguageCode(nextLanguage)) {
        applyLanguage(nextLanguage);
        return;
      }

      applyLanguage(normalizeLanguageCode(nextLanguage));
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== LANGUAGE_STORAGE_KEY && event.key !== null) {
        return;
      }

      window.clearTimeout(initialLanguageTimer);
      applyLanguage(normalizeLanguageCode(event.newValue));
    };

    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.clearTimeout(initialLanguageTimer);
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return selectedLanguage;
}
