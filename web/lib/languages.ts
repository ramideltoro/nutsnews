export const LANGUAGE_STORAGE_KEY = "nutsnews.web.language";

export const SUPPORTED_LANGUAGES = [
  {
    code: "en",
    label: "English",
    nativeLabel: "English",
    flag: "🇺🇸",
  },
  {
    code: "fr",
    label: "French",
    nativeLabel: "Français",
    flag: "🇫🇷",
  },
  {
    code: "ja",
    label: "Japanese",
    nativeLabel: "日本語",
    flag: "🇯🇵",
  },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE_CODE: LanguageCode = "en";

const supportedLanguageCodes = new Set<string>(
  SUPPORTED_LANGUAGES.map((language) => language.code),
);

export function isSupportedLanguageCode(value: string | null | undefined): value is LanguageCode {
  return Boolean(value && supportedLanguageCodes.has(value));
}

export function normalizeLanguageCode(value: string | null | undefined): LanguageCode {
  return isSupportedLanguageCode(value) ? value : DEFAULT_LANGUAGE_CODE;
}

export function getLanguageLabel(languageCode: LanguageCode) {
  return (
    SUPPORTED_LANGUAGES.find((language) => language.code === languageCode)
      ?.nativeLabel ?? "English"
  );
}

export const LANGUAGE_CHANGE_EVENT = "nutsnews:language-change";
