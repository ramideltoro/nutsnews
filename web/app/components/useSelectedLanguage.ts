"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_STORAGE_KEY,
  type LanguageCode,
  isSupportedLanguageCode,
} from "@/lib/languages";

function readStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE_CODE;
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isSupportedLanguageCode(storedLanguage)
    ? storedLanguage
    : DEFAULT_LANGUAGE_CODE;
}

export function useSelectedLanguage() {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(
    DEFAULT_LANGUAGE_CODE,
  );

  useEffect(() => {
    const applyLanguage = (languageCode: LanguageCode) => {
      document.documentElement.lang = languageCode;
      window.setTimeout(() => setSelectedLanguage(languageCode), 0);
    };

    applyLanguage(readStoredLanguage());

    const handleLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<{ languageCode?: string }>)
        .detail?.languageCode;

      if (isSupportedLanguageCode(nextLanguage)) {
        applyLanguage(nextLanguage);
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== LANGUAGE_STORAGE_KEY) {
        return;
      }

      applyLanguage(
        isSupportedLanguageCode(event.newValue)
          ? event.newValue
          : DEFAULT_LANGUAGE_CODE,
      );
    };

    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return selectedLanguage;
}
