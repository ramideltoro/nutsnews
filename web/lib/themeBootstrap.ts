import {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
} from "@/lib/languages";

const allowedLanguages = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((language) => [language.code, true]),
);

export const themeInitScript = `
(function () {
  var browserThemeColors = {
    amber: "#0a0a0a",
    "modern-saas": "#121212",
    "creative-premium": "#0f172a",
    "moody-cyberpunk": "#1a211b"
  };

  function updateBrowserThemeColor(theme) {
    var color = browserThemeColors[theme] || browserThemeColors.amber;
    var themeColorMeta = document.querySelector('meta[name="theme-color"]');

    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.setAttribute("name", "theme-color");
      document.head.appendChild(themeColorMeta);
    }

    themeColorMeta.setAttribute("content", color);
  }

  var allowedLanguages = ${JSON.stringify(allowedLanguages)};

  function normalizeStoredLanguage(value) {
    var normalizedValue = typeof value === "string" ? value.trim() : "";

    if (!normalizedValue) {
      return ${JSON.stringify(DEFAULT_LANGUAGE_CODE)};
    }

    var lowerValue = normalizedValue.toLowerCase();
    var language = lowerValue;

    if (lowerValue === "de-ch" || lowerValue === "de_ch" || lowerValue === "ch") {
      language = "de-CH";
    }

    return allowedLanguages[language] ? language : ${JSON.stringify(DEFAULT_LANGUAGE_CODE)};
  }

  try {
    var storageKey = "nutsnews.web.theme";
    var allowedThemes = {
      amber: true,
      "modern-saas": true,
      "creative-premium": true,
      "moody-cyberpunk": true
    };
    var storedTheme = window.localStorage.getItem(storageKey);
    var theme = allowedThemes[storedTheme] ? storedTheme : "amber";
    var root = document.documentElement;
    root.setAttribute("data-nutsnews-theme", theme);
    root.style.colorScheme = "dark";
    updateBrowserThemeColor(theme);

    var languageStorageKey = ${JSON.stringify(LANGUAGE_STORAGE_KEY)};
    var storedLanguage = window.localStorage.getItem(languageStorageKey);
    var language = normalizeStoredLanguage(storedLanguage);
    root.setAttribute("lang", language);
  } catch (_) {
    document.documentElement.setAttribute("data-nutsnews-theme", "amber");
    document.documentElement.style.colorScheme = "dark";
    document.documentElement.setAttribute("lang", ${JSON.stringify(DEFAULT_LANGUAGE_CODE)});
    updateBrowserThemeColor("amber");
  }
})();
`;
