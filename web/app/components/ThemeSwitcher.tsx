"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const THEME_STORAGE_KEY = "nutsnews.web.theme";

const themes = [
  {
    id: "amber",
    name: "Amber",
    description: "Classic NutsNews amber glow.",
    swatches: ["#0a0a0a", "#1f1308", "#facc15"],
  },
  {
    id: "modern-saas",
    name: "The Modern SaaS",
    description: "Charcoal, graphite, off-white, and electric blue.",
    swatches: ["#121212", "#1e1e1e", "#3b82f6"],
  },
  {
    id: "creative-premium",
    name: "The Creative Premium",
    description: "Midnight navy, deep slate, muted silver, and neon purple.",
    swatches: ["#0f172a", "#1e293b", "#7c3aed"],
  },
  {
    id: "moody-cyberpunk",
    name: "The Moody Cyberpunk",
    description: "Deep green-gray, oiled slate, soft gray, and cyber yellow.",
    swatches: ["#1a211b", "#2c362f", "#facc15"],
  },
] as const;

type ThemeId = (typeof themes)[number]["id"];

function isThemeId(value: string | null): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

function applyTheme(themeId: ThemeId) {
  document.documentElement.dataset.nutsnewsTheme = themeId;
  document.documentElement.style.colorScheme = "dark";
}


function HomeIcon({ className = "" }: { className?: string }) {
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
      <path d="m3 10.5 9-7 9 7" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
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

export function ThemeSwitcher() {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(() => {
    if (typeof window === "undefined") {
      return "amber";
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(storedTheme) ? storedTheme : "amber";
  });
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    applyTheme(selectedTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
  }, [selectedTheme]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
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

  function handleThemeSelect(themeId: ThemeId) {
    setSelectedTheme(themeId);
  }

  return (
    <div ref={panelRef} className="theme-switcher-shell">
      <Link
        href="/"
        className="theme-home-button"
        aria-label="Go to the NutsNews home page"
      >
        <span className="theme-home-button__halo" />
        <HomeIcon className="theme-home-button__icon" />
      </Link>

      <button
        type="button"
        className="theme-gear-button"
        aria-label="Open NutsNews theme settings"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="theme-gear-button__halo" />
        <GearIcon className="theme-gear-button__icon" />
      </button>

      {isOpen ? (
        <section className="theme-panel" aria-label="Theme settings">
          <div className="theme-panel__header">
            <div>
              <p className="theme-panel__eyebrow">Settings</p>
              <h2 className="theme-panel__title">Theme</h2>
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
                  className={`theme-option ${isSelected ? "theme-option--active" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => handleThemeSelect(theme.id)}
                >
                  <span className="theme-option__swatches" aria-hidden="true">
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
                      {theme.description}
                    </span>
                  </span>
                  <span className="theme-option__check" aria-hidden="true">
                    {isSelected ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
