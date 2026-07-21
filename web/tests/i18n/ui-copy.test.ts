import { describe, expect, test } from "vitest";

import { aboutCopyByLanguage } from "@/app/about/LocalizedAboutPage";
import { appsCopyByLanguage } from "@/app/apps/LocalizedAppsPage";
import { articleDetailCopyByLanguage } from "@/app/articles/[id]/LocalizedArticleDetail";
import { copyByLanguage as articleFeedCopyByLanguage, dateLocaleByLanguage } from "@/app/components/ArticleFeed";
import { heroTaglineCopyByLanguage } from "@/app/components/HeroTagline";
import { homeHeaderCopyByLanguage } from "@/app/components/HomeSiteHeader";
import { navCopyByLanguage } from "@/app/components/NewspaperPrimaryNav";
import { footerCopyByLanguage } from "@/app/components/SiteFooter";
import { settingsCopyByLanguage } from "@/app/components/ThemeSwitcher";
import { formCopyByLanguage } from "@/app/contact/ContactForm";
import { contactCopyByLanguage } from "@/app/contact/LocalizedContactPage";
import { privacyCopyByLanguage } from "@/app/privacy/LocalizedPrivacyPolicyPage";
import { savedStoriesCopyByLanguage } from "@/app/saved/SavedStoriesPage";
import { themeInitScript } from "@/lib/themeBootstrap";
import {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  getLanguageLabel,
  isSupportedLanguageCode,
  normalizeLanguageCode,
  type LanguageCode,
} from "@/lib/languages";

type CopyMap = Record<LanguageCode, unknown>;

const supportedCodes = SUPPORTED_LANGUAGES.map((language) => language.code);

const copyMaps: { name: string; value: CopyMap }[] = [
  { name: "about", value: aboutCopyByLanguage },
  { name: "apps", value: appsCopyByLanguage },
  { name: "articleDetail", value: articleDetailCopyByLanguage },
  { name: "articleFeed", value: articleFeedCopyByLanguage },
  { name: "contactForm", value: formCopyByLanguage },
  { name: "contactPage", value: contactCopyByLanguage },
  { name: "footer", value: footerCopyByLanguage },
  { name: "heroTagline", value: heroTaglineCopyByLanguage },
  { name: "homeHeader", value: homeHeaderCopyByLanguage },
  { name: "nav", value: navCopyByLanguage },
  { name: "privacy", value: privacyCopyByLanguage },
  { name: "savedStories", value: savedStoriesCopyByLanguage },
  { name: "settings", value: settingsCopyByLanguage },
];

const criticalTranslatedPaths = [
  { map: "about", path: ["heroTitle"] },
  { map: "apps", path: ["roadmapTitle"] },
  { map: "articleDetail", path: ["backToHome"] },
  { map: "articleDetail", path: ["summaryNote"] },
  { map: "articleDetail", path: ["readFullStory"] },
  { map: "articleDetail", path: ["aboutNutsNews"] },
  { map: "articleFeed", path: ["topStories"] },
  { map: "articleFeed", path: ["emptyFeed"] },
  { map: "articleFeed", path: ["categoryLabels", "community"] },
  { map: "contactForm", path: ["emailLabel"] },
  { map: "contactForm", path: ["turnstileUnavailable"] },
  { map: "contactPage", path: ["title"] },
  { map: "contactPage", path: ["backButton"] },
  { map: "footer", path: ["searchTitle"] },
  { map: "footer", path: ["emptyTitle"] },
  { map: "heroTagline", path: ["ariaLabel"] },
  { map: "homeHeader", path: ["ariaLabel"] },
  { map: "nav", path: ["ariaLabel"] },
  { map: "nav", path: ["labels", "community"] },
  { map: "privacy", path: ["title"] },
  { map: "privacy", path: ["returnButton"] },
  { map: "savedStories", path: ["title"] },
  { map: "savedStories", path: ["emptyTitle"] },
  { map: "settings", path: ["openSettings"] },
  { map: "settings", path: ["language"] },
] as const;

const expectedDateLabels: Record<LanguageCode, string> = {
  en: "Jul 2, 2026",
  fr: "2 juil. 2026",
  ja: "2026年7月2日",
  "de-CH": "2. Juli 2026",
  de: "2. Juli 2026",
  el: "2 Ιουλ 2026",
};

const optionalEmptyStrings = new Set([
  "articleDetail.en$.readFullStoryAtSuffix",
  "articleDetail.fr$.readFullStoryAtSuffix",
  "articleDetail.el$.readFullStoryAtSuffix",
  "contactForm.en$.turnstileHelp",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectShape(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return [
      `${path}:array:${value.length}`,
      ...value.flatMap((item, index) => collectShape(item, `${path}[${index}]`)),
    ];
  }

  if (isRecord(value)) {
    return [
      `${path}:object:${Object.keys(value).sort().join(",")}`,
      ...Object.keys(value)
        .sort()
        .flatMap((key) => collectShape(value[key], `${path}.${key}`)),
    ];
  }

  return [`${path}:${typeof value}`];
}

function collectStrings(value: unknown, path = "$"): { path: string; value: string }[] {
  if (typeof value === "string") {
    return [{ path, value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectStrings(item, `${path}[${index}]`));
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .flatMap((key) => collectStrings(value[key], `${path}.${key}`));
  }

  return [];
}

function readPath(value: unknown, path: readonly string[]) {
  return path.reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[segment];
  }, value);
}

type BootstrapElement = {
  attributes: Record<string, string>;
  style: Record<string, string>;
  setAttribute: (name: string, value: string) => void;
};

function createBootstrapElement(): BootstrapElement {
  const element: BootstrapElement = {
    attributes: {},
    style: {},
    setAttribute(name, value) {
      element.attributes[name] = String(value);
    },
  };

  return element;
}

function runThemeBootstrap(storedLanguage: string | null) {
  const root = createBootstrapElement();

  const window = {
    localStorage: {
      getItem(key: string) {
        if (key === LANGUAGE_STORAGE_KEY) {
          return storedLanguage;
        }

        if (key === "nutsnews.web.theme") {
          return "amber";
        }

        return null;
      },
    },
  };
  const document = {
    documentElement: root,
    head: {
      appendChild() {},
    },
    querySelector() {
      return null;
    },
    createElement() {
      return createBootstrapElement();
    },
  };

  new Function("window", "document", themeInitScript)(window, document);

  return {
    lang: root.attributes.lang,
    theme: root.attributes["data-nutsnews-theme"],
    colorScheme: root.style.colorScheme,
  };
}

describe("i18n copy inventory", () => {
  test("every public UI copy map covers the centralized supported locale inventory", () => {
    for (const { name, value } of copyMaps) {
      expect(
        Object.keys(value).sort(),
        `${name} must include exactly the supported locales`,
      ).toEqual([...supportedCodes].sort());
    }
  });

  test("localized copy maps keep the same required key shape as English", () => {
    for (const { name, value } of copyMaps) {
      const englishShape = collectShape(value.en);

      for (const languageCode of supportedCodes) {
        expect(
          collectShape(value[languageCode]),
          `${name}.${languageCode} is missing or changing a required translation key`,
        ).toEqual(englishShape);
      }
    }
  });

  test("required localized strings are non-empty and do not expose raw placeholders", () => {
    for (const { name, value } of copyMaps) {
      for (const languageCode of supportedCodes) {
        for (const entry of collectStrings(value[languageCode])) {
          const entryId = `${name}.${languageCode}${entry.path}`;

          if (!optionalEmptyStrings.has(entryId)) {
            expect(entry.value.trim(), `${entryId} is empty`).not.toBe("");
          }

          expect(
            entry.value,
            `${entryId} exposes a raw translation placeholder`,
          ).not.toMatch(/\b(?:TODO|MISSING_TRANSLATION|translation_key)\b|\{\{.+\}\}|\[\[.+\]\]/i);
        }
      }
    }
  });

  test("critical translated surfaces do not silently fall back to English", () => {
    const mapByName = new Map(copyMaps.map((entry) => [entry.name, entry.value]));

    for (const { map, path } of criticalTranslatedPaths) {
      const copyMap = mapByName.get(map);
      const englishValue = readPath(copyMap?.en, path);

      expect(typeof englishValue, `${map}.en.${path.join(".")} must be a string`).toBe("string");

      for (const languageCode of supportedCodes.filter((code) => code !== DEFAULT_LANGUAGE_CODE)) {
        const localizedValue = readPath(copyMap?.[languageCode], path);

        expect(
          localizedValue,
          `${map}.${languageCode}.${path.join(".")} should be translated instead of English`,
        ).not.toBe(englishValue);
      }
    }
  });
});

describe("i18n fallback and formatting", () => {
  test("pre-hydration bootstrap honors the centralized supported language inventory", () => {
    for (const languageCode of supportedCodes) {
      expect(
        runThemeBootstrap(languageCode).lang,
        `bootstrap script must preserve stored ${languageCode}`,
      ).toBe(languageCode);
    }
  });

  test("pre-hydration bootstrap normalization matches shared language utilities", () => {
    for (const storedLanguage of [
      null,
      "",
      "zz",
      " de_ch ",
      "ch",
      "DE",
      "EL",
      "fr",
    ]) {
      expect(runThemeBootstrap(storedLanguage).lang).toBe(
        normalizeLanguageCode(storedLanguage),
      );
    }
  });

  test("pre-hydration bootstrap keeps existing theme initialization behavior", () => {
    expect(runThemeBootstrap("fr")).toMatchObject({
      colorScheme: "dark",
      theme: "amber",
    });
  });

  test("unsupported language inputs normalize to English instead of leaking raw codes", () => {
    expect(isSupportedLanguageCode("zz")).toBe(false);
    expect(normalizeLanguageCode("zz")).toBe(DEFAULT_LANGUAGE_CODE);
    expect(normalizeLanguageCode(" de_ch ")).toBe("de-CH");
    expect(getLanguageLabel(normalizeLanguageCode("zz"))).toBe("English");
  });

  test("date formatting stays stable for every supported locale", () => {
    const date = new Date("2026-07-02T12:00:00Z");

    for (const languageCode of supportedCodes) {
      const formatted = new Intl.DateTimeFormat(dateLocaleByLanguage[languageCode], {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);

      expect(formatted, `${languageCode} date label changed`).toBe(
        expectedDateLabels[languageCode],
      );
    }
  });
});
