"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
  isSupportedLanguageCode,
  getLanguageLabel,
} from "@/lib/languages";

const THEME_STORAGE_KEY = "nutsnews.web.theme";

const themes = [
  {
    id: "amber",
    name: "Amber",
    description: "Classic NutsNews amber glow.",
    swatches: ["#0a0a0a", "#1f1308", "#facc15"],
  },
  {
    id: "sakura",
    name: "Sakura",
    description: "Cherry pink matcha calm.",
    swatches: ["#fde2e7", "#fff7ed", "#7aa95c"],
  },
  {
    id: "modern-saas",
    name: "SaaS",
    description: "Sleek dark blue polish.",
    swatches: ["#121212", "#1e1e1e", "#3b82f6"],
  },
  {
    id: "san-juan",
    name: "Foxy",
    description: "Pastel streets tropical glow.",
    swatches: ["#f6c453", "#e76f51", "#2a9df4", "#2f9e44"],
  },
  {
    id: "creative-premium",
    name: "Butterfly",
    description: "Navy purple premium glow.",
    swatches: ["#0f172a", "#1e293b", "#7c3aed"],
  },
  {
    id: "moody-cyberpunk",
    name: "Bambi",
    description: "Green cyber yellow glow.",
    swatches: ["#1a211b", "#2c362f", "#facc15"],
  },
] as const;

type ThemeId = (typeof themes)[number]["id"];
type SettingsPanel = "menu" | "theme" | "language";

const settingsCopyByLanguage: Record<
  LanguageCode,
  {
    openSettings: string;
    settingsLabel: string;
    settings: string;
    customize: string;
    theme: string;
    language: string;
    backToSettings: string;
    selectedMark: string;
    themeDescriptions: Record<ThemeId, string>;
  }
> = {
  en: {
    openSettings: "Open NutsNews settings",
    settingsLabel: "NutsNews settings",
    settings: "Settings",
    customize: "Customize",
    theme: "Theme",
    language: "Language",
    backToSettings: "Back to settings menu",
    selectedMark: "Selected",
    themeDescriptions: {
      amber: "Classic NutsNews amber glow.",
      "modern-saas": "Sleek dark blue polish.",
      "creative-premium": "Navy purple premium glow.",
      "moody-cyberpunk": "Green cyber yellow glow.",
      sakura: "Cherry pink matcha calm.",
      "san-juan": "Pastel streets tropical glow.",
    },
  },
  fr: {
    openSettings: "Ouvrir les paramètres NutsNews",
    settingsLabel: "Paramètres NutsNews",
    settings: "Paramètres",
    customize: "Personnaliser",
    theme: "Thème",
    language: "Langue",
    backToSettings: "Retour au menu des paramètres",
    selectedMark: "Sélectionné",
    themeDescriptions: {
      amber: "Lueur ambrée classique de NutsNews.",
      "modern-saas": "Finition bleu foncé élégante.",
      "creative-premium": "Éclat premium bleu nuit et violet.",
      "moody-cyberpunk": "Vert profond avec éclat jaune cyber.",
      sakura: "Calme rose cerisier et matcha.",
      "san-juan": "Rues pastel et éclat tropical.",
    },
  },
  ja: {
    openSettings: "NutsNewsの設定を開く",
    settingsLabel: "NutsNewsの設定",
    settings: "設定",
    customize: "カスタマイズ",
    theme: "テーマ",
    language: "言語",
    backToSettings: "設定メニューに戻る",
    selectedMark: "選択中",
    themeDescriptions: {
      amber: "NutsNews定番のアンバーの輝き。",
      "modern-saas": "洗練されたダークブルーの雰囲気。",
      "creative-premium": "ネイビーと紫の上質な輝き。",
      "moody-cyberpunk": "グリーンにサイバーイエローの光。",
      sakura: "桜色と抹茶の落ち着き。",
      "san-juan": "パステルの街並みと南国の輝き。",
    },
  },

  "de-CH": {
    openSettings: "NutsNews-Einstellungen öffnen",
    settingsLabel: "NutsNews-Einstellungen",
    settings: "Einstellungen",
    customize: "Anpassen",
    theme: "Design",
    language: "Sprache",
    backToSettings: "Zurück zum Einstellungsmenü",
    selectedMark: "Ausgewählt",
    themeDescriptions: {
      amber: "Klassischer NutsNews-Amberglanz.",
      "modern-saas": "Eleganter dunkelblauer Look.",
      "creative-premium": "Premium-Glanz in Navy und Violett.",
      "moody-cyberpunk": "Grün mit Cyber-Gelb.",
      sakura: "Kirschrosa und Matcha-Ruhe.",
      "san-juan": "Pastellstrassen mit tropischem Glanz.",
    },
  },
  de: {
    openSettings: "NutsNews-Einstellungen öffnen",
    settingsLabel: "NutsNews-Einstellungen",
    settings: "Einstellungen",
    customize: "Anpassen",
    theme: "Design",
    language: "Sprache",
    backToSettings: "Zurück zum Einstellungsmenü",
    selectedMark: "Ausgewählt",
    themeDescriptions: {
      amber: "Klassischer NutsNews-Amberglanz.",
      "modern-saas": "Eleganter dunkelblauer Look.",
      "creative-premium": "Premium-Glanz in Navy und Violett.",
      "moody-cyberpunk": "Grün mit Cyber-Gelb.",
      sakura: "Kirschrosa und Matcha-Ruhe.",
      "san-juan": "Pastellstraßen mit tropischem Glanz.",
    },
  },
  el: {
    openSettings: "Άνοιγμα ρυθμίσεων NutsNews",
    settingsLabel: "Ρυθμίσεις NutsNews",
    settings: "Ρυθμίσεις",
    customize: "Προσαρμογή",
    theme: "Θέμα",
    language: "Γλώσσα",
    backToSettings: "Πίσω στο μενού ρυθμίσεων",
    selectedMark: "Επιλεγμένο",
    themeDescriptions: {
      amber: "Η κλασική κεχριμπαρένια λάμψη του NutsNews.",
      "modern-saas": "Κομψή σκούρα μπλε εμφάνιση.",
      "creative-premium": "Premium λάμψη σε navy και μοβ.",
      "moody-cyberpunk": "Πράσινο με cyber κίτρινη λάμψη.",
      sakura: "Ηρεμία με ροζ κερασιάς και matcha.",
      "san-juan": "Παστέλ δρόμοι με τροπική λάμψη.",
    },
  },
};

const browserThemeColors: Record<ThemeId, string> = {
  amber: "#0a0a0a",
  "modern-saas": "#121212",
  "creative-premium": "#0f172a",
  "moody-cyberpunk": "#1a211b",
  sakura: "#fde2e7",
  "san-juan": "#ffe0a3",
};

function isThemeId(value: string | null): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

function updateBrowserThemeColor(themeId: ThemeId) {
  const color = browserThemeColors[themeId];
  let themeColorMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );

  if (!themeColorMeta) {
    themeColorMeta = document.createElement("meta");
    themeColorMeta.name = "theme-color";
    document.head.appendChild(themeColorMeta);
  }

  themeColorMeta.content = color;
}

function applyTheme(themeId: ThemeId) {
  document.documentElement.dataset.nutsnewsTheme = themeId;
  document.documentElement.style.colorScheme = "dark";
  updateBrowserThemeColor(themeId);
}

function getStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE_CODE;
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isSupportedLanguageCode(storedLanguage)
    ? storedLanguage
    : DEFAULT_LANGUAGE_CODE;
}

function subscribeToLanguageChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleLanguageChange = () => onStoreChange();
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function getServerLanguageSnapshot(): LanguageCode {
  return DEFAULT_LANGUAGE_CODE;
}

function applyLanguage(languageCode: LanguageCode) {
  document.documentElement.lang = languageCode;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
  window.dispatchEvent(
    new CustomEvent(LANGUAGE_CHANGE_EVENT, {
      detail: { languageCode },
    }),
  );
}

function GearIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.7 7.7 0 0 0-1.7-.98L14.5 2.4A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.4L9.12 5.07c-.6.24-1.17.56-1.7.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.02.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.53.41 1.1.74 1.7.98l.38 2.67a.5.5 0 0 0 .5.4h4a.5.5 0 0 0 .5-.4l.38-2.67c.6-.24 1.17-.57 1.7-.98l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65Z" />
    </svg>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="m7.5 4.5 5 5.5-5 5.5" />
    </svg>
  );
}

function BackIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="m12.5 4.5-5 5.5 5 5.5" />
    </svg>
  );
}

export function ThemeSwitcher() {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(() => {
    if (typeof window === "undefined") {
      return "amber";
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(storedTheme) ? storedTheme : "amber";
  });
  const selectedLanguage = useSyncExternalStore(
    subscribeToLanguageChanges,
    getStoredLanguage,
    getServerLanguageSnapshot,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<SettingsPanel>("menu");
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    applyTheme(selectedTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
  }, [selectedTheme]);

  useEffect(() => {
    document.documentElement.lang = selectedLanguage;
  }, [selectedLanguage]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActivePanel("menu");
      }
    };

    if (isOpen) {
      document.addEventListener("pointerdown", handlePointerDown);
    }

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const activeTheme = useMemo(
    () => themes.find((theme) => theme.id === selectedTheme) ?? themes[0],
    [selectedTheme],
  );

  const activeLanguage = useMemo(
    () =>
      SUPPORTED_LANGUAGES.find(
        (language) => language.code === selectedLanguage,
      ) ?? SUPPORTED_LANGUAGES[0],
    [selectedLanguage],
  );
  const activeLanguageLabel = getLanguageLabel(selectedLanguage);
  const copy = settingsCopyByLanguage[selectedLanguage];

  function handleThemeSelect(themeId: ThemeId) {
    setSelectedTheme(themeId);
  }

  function handleLanguageSelect(languageCode: LanguageCode) {
    applyLanguage(languageCode);
  }

  function handleToggleSettings() {
    setIsOpen((current) => {
      const nextIsOpen = !current;

      if (!nextIsOpen) {
        setActivePanel("menu");
      }

      return nextIsOpen;
    });
  }

  return (
    <div ref={panelRef} className="theme-switcher-shell">
      <button
        type="button"
        data-testid="nutsnews-settings-toggle"
        className="theme-gear-button"
        aria-label={copy.openSettings}
        aria-expanded={isOpen}
        onClick={handleToggleSettings}
      >
        <span className="theme-gear-button__halo" />
        <GearIcon className="theme-gear-button__icon" />
      </button>

      {isOpen ? (
        <section className="theme-panel" data-testid="nutsnews-settings-panel" aria-label={copy.settingsLabel}>
          {activePanel === "menu" ? (
            <>
              <div className="theme-panel__header">
                <div>
                  <p className="theme-panel__eyebrow">{copy.settings}</p>
                  <h2 className="theme-panel__title">{copy.customize}</h2>
                </div>
                <p className="theme-panel__active">NutsNews</p>
              </div>

              <div className="settings-menu-list">
                <button
                  type="button"
                  data-testid="nutsnews-settings-theme"
                  className="settings-menu-item"
                  onClick={() => setActivePanel("theme")}
                >
                  <span className="settings-menu-item__icon" aria-hidden="true">
                    <span className="theme-option__swatches">
                      {activeTheme.swatches.map((swatch) => (
                        <span
                          key={swatch}
                          className="theme-option__swatch"
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </span>
                  </span>
                  <span className="settings-menu-item__copy">
                    <span className="settings-menu-item__title">
                      {copy.theme}
                    </span>
                    <span className="settings-menu-item__value">
                      {activeTheme.name}
                    </span>
                  </span>
                  <ArrowIcon className="settings-menu-item__arrow" />
                </button>

                <button
                  type="button"
                  data-testid="nutsnews-settings-language"
                  className="settings-menu-item"
                  onClick={() => setActivePanel("language")}
                >
                  <span className="language-option__badge" aria-hidden="true">
                    {activeLanguage.flag}
                  </span>
                  <span className="settings-menu-item__copy">
                    <span className="settings-menu-item__title">
                      {copy.language}
                    </span>
                    <span className="settings-menu-item__value">
                      {activeLanguageLabel}
                    </span>
                  </span>
                  <ArrowIcon className="settings-menu-item__arrow" />
                </button>
              </div>
            </>
          ) : null}

          {activePanel === "theme" ? (
            <>
              <div className="theme-panel__header theme-panel__header--with-back">
                <button
                  type="button"
                  className="theme-panel__back-button"
                  aria-label={copy.backToSettings}
                  onClick={() => setActivePanel("menu")}
                >
                  <BackIcon className="theme-panel__back-icon" />
                </button>
                <div>
                  <p className="theme-panel__eyebrow">{copy.settings}</p>
                  <h2 className="theme-panel__title">{copy.theme}</h2>
                </div>
                <p className="theme-panel__active">{activeTheme.name}</p>
              </div>

              <div className="theme-panel__options">
                {themes.map((theme) => {
                  const isSelected = theme.id === selectedTheme;

                  return (
                    <button
                      key={theme.id}
                      type="button"
                      data-testid={`nutsnews-theme-option-${theme.id}`}
                      className={`theme-option ${isSelected ? "theme-option--active" : ""}`}
                      aria-pressed={isSelected}
                      onClick={() => handleThemeSelect(theme.id)}
                    >
                      <span
                        className="theme-option__swatches"
                        aria-hidden="true"
                      >
                        {theme.swatches.map((swatch) => (
                          <span
                            key={swatch}
                            className="theme-option__swatch"
                            style={{ backgroundColor: swatch }}
                          />
                        ))}
                      </span>
                      <span className="theme-option__copy">
                        <span className="theme-option__name">{theme.name}</span>
                        <span className="theme-option__description">
                          {copy.themeDescriptions[theme.id]}
                        </span>
                      </span>
                      <span className="theme-option__check" aria-hidden="true">
                        {isSelected ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {activePanel === "language" ? (
            <>
              <div className="theme-panel__header theme-panel__header--with-back">
                <button
                  type="button"
                  className="theme-panel__back-button"
                  aria-label={copy.backToSettings}
                  onClick={() => setActivePanel("menu")}
                >
                  <BackIcon className="theme-panel__back-icon" />
                </button>
                <div>
                  <p className="theme-panel__eyebrow">{copy.settings}</p>
                  <h2 className="theme-panel__title">{copy.language}</h2>
                </div>
                <p className="theme-panel__active">{activeLanguageLabel}</p>
              </div>

              <div className="theme-panel__options">
                {SUPPORTED_LANGUAGES.map((language) => {
                  const isSelected = language.code === selectedLanguage;

                  return (
                    <button
                      key={language.code}
                      type="button"
                      data-testid={`nutsnews-language-option-${language.code}`}
                      className={`theme-option ${isSelected ? "theme-option--active" : ""}`}
                      aria-pressed={isSelected}
                      onClick={() => handleLanguageSelect(language.code)}
                    >
                      <span
                        className="language-option__badge"
                        aria-hidden="true"
                      >
                        {language.flag}
                      </span>
                      <span className="theme-option__copy">
                        <span className="theme-option__name">
                          {language.nativeLabel}
                        </span>
                        <span className="theme-option__description">
                          {language.label}
                        </span>
                      </span>
                      <span className="theme-option__check" aria-hidden="true">
                        {isSelected ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
