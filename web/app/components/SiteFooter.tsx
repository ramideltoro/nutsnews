"use client";

/* eslint-disable @next/next/no-img-element */

import {
  type FormEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import type { Article } from "@/lib/articles";
import { DEFAULT_LANGUAGE_CODE, type LanguageCode } from "@/lib/languages";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useSelectedLanguage } from "./useSelectedLanguage";

const COPYRIGHT_YEAR = 2026;
const FOOTER_HOME_TRANSITION_KEY = "nutsnews.footerHomeTransition";

type SearchResponse = {
  articles: Article[];
  nextPage: number | null;
  query: string;
  page: number;
  pageSize: number;
  languageCode: LanguageCode;
  error?: string;
};

const footerCopyByLanguage: Record<
  LanguageCode,
  {
    shortcuts: string;
    homeAria: string;
    searchAria: string;
    closeSearch: string;
    searchTitle: string;
    searchPlaceholder: string;
    searchButton: string;
    searchLoading: string;
    searchError: string;
    clearSearch: string;
    loadMoreResults: string;
    readFullStory: string;
    recently: string;
    resultCount: (count: number, query: string) => string;
    emptyTitle: string;
    emptyBody: (query: string) => string;
    footerNav: string;
    apps: string;
    about: string;
    contact: string;
    privacy: string;
    rights: string;
  }
> = {
  en: {
    shortcuts: "Site shortcuts",
    homeAria: "Go to NutsNews home",
    searchAria: "Open search",
    closeSearch: "Close search",
    searchTitle: "Search",
    searchPlaceholder: "Animals, science, community, wellness...",
    searchButton: "Search",
    searchLoading: "Searching",
    searchError: "Could not search right now.",
    clearSearch: "Clear search",
    loadMoreResults: "Load more results",
    readFullStory: "Read full story",
    recently: "Recently",
    resultCount: (count, query) =>
      `${count} result${count === 1 ? "" : "s"} for “${query}”`,
    emptyTitle: "No matching stories yet",
    emptyBody: (query) =>
      `No published NutsNews stories matched “${query}”. Try a broader word like animals, science, community, travel, or wellness.`,
    footerNav: "Footer navigation",
    apps: "Apps",
    about: "About",
    contact: "Contact",
    privacy: "Privacy",
    rights: "All Rights Reserved.",
  },
  fr: {
    shortcuts: "Raccourcis du site",
    homeAria: "Aller à l’accueil de NutsNews",
    searchAria: "Ouvrir la recherche",
    closeSearch: "Fermer la recherche",
    searchTitle: "Recherche",
    searchPlaceholder: "Animaux, science, communauté, bien-être...",
    searchButton: "Rechercher",
    searchLoading: "Recherche en cours",
    searchError: "Impossible de rechercher pour le moment.",
    clearSearch: "Effacer la recherche",
    loadMoreResults: "Charger plus de résultats",
    readFullStory: "Lire l’article complet",
    recently: "Récemment",
    resultCount: (count, query) =>
      `${count} résultat${count === 1 ? "" : "s"} pour « ${query} »`,
    emptyTitle: "Aucune histoire trouvée",
    emptyBody: (query) =>
      `Aucune histoire publiée ne correspond à « ${query} ». Essayez un mot plus large comme animaux, science, communauté, voyage ou bien-être.`,
    footerNav: "Navigation du pied de page",
    apps: "Apps",
    about: "À propos",
    contact: "Contact",
    privacy: "Confidentialité",
    rights: "Tous droits réservés.",
  },
  ja: {
    shortcuts: "サイトのショートカット",
    homeAria: "NutsNewsのホームへ移動",
    searchAria: "検索を開く",
    closeSearch: "検索を閉じる",
    searchTitle: "検索",
    searchPlaceholder: "動物、科学、コミュニティ、健康...",
    searchButton: "検索",
    searchLoading: "検索中",
    searchError: "現在検索できません。",
    clearSearch: "検索をクリア",
    loadMoreResults: "さらに結果を表示",
    readFullStory: "元の記事を読む",
    recently: "最近",
    resultCount: (count, query) => `「${query}」の検索結果 ${count}件`,
    emptyTitle: "一致するストーリーはありません",
    emptyBody: (query) =>
      `「${query}」に一致する公開済みストーリーはありません。動物、科学、コミュニティ、旅行、健康など広い言葉を試してください。`,
    footerNav: "フッターナビゲーション",
    apps: "アプリ",
    about: "概要",
    contact: "お問い合わせ",
    privacy: "プライバシー",
    rights: "All Rights Reserved.",
  },

  "de-CH": {
    shortcuts: "Website-Abkürzungen",
    homeAria: "Zur NutsNews-Startseite",
    searchAria: "Suche öffnen",
    closeSearch: "Suche schliessen",
    searchTitle: "Suche",
    searchPlaceholder: "Tiere, Wissenschaft, Gemeinschaft, Wohlbefinden...",
    searchButton: "Suchen",
    searchLoading: "Suche läuft",
    searchError: "Die Suche ist gerade nicht möglich.",
    clearSearch: "Suche löschen",
    loadMoreResults: "Mehr Ergebnisse laden",
    readFullStory: "Ganze Geschichte lesen",
    recently: "Kürzlich",
    resultCount: (count, query) =>
      `${count} Ergebnis${count === 1 ? "" : "se"} für „${query}“`,
    emptyTitle: "Noch keine passenden Geschichten",
    emptyBody: (query) =>
      `Keine veröffentlichte NutsNews-Geschichte passt zu „${query}“. Versuch ein breiteres Wort wie Tiere, Wissenschaft, Gemeinschaft, Reisen oder Wohlbefinden.`,
    footerNav: "Footer-Navigation",
    apps: "Apps",
    about: "Über uns",
    contact: "Kontakt",
    privacy: "Datenschutz",
    rights: "Alle Rechte vorbehalten.",
  },
  de: {
    shortcuts: "Website-Kurzbefehle",
    homeAria: "Zur NutsNews-Startseite",
    searchAria: "Suche öffnen",
    closeSearch: "Suche schließen",
    searchTitle: "Suche",
    searchPlaceholder: "Tiere, Wissenschaft, Gemeinschaft, Wohlbefinden...",
    searchButton: "Suchen",
    searchLoading: "Suche läuft",
    searchError: "Die Suche ist gerade nicht möglich.",
    clearSearch: "Suche löschen",
    loadMoreResults: "Mehr Ergebnisse laden",
    readFullStory: "Ganze Geschichte lesen",
    recently: "Kürzlich",
    resultCount: (count, query) =>
      `${count} Ergebnis${count === 1 ? "" : "se"} für „${query}“`,
    emptyTitle: "Noch keine passenden Geschichten",
    emptyBody: (query) =>
      `Keine veröffentlichte NutsNews-Geschichte passt zu „${query}“. Versuch ein breiteres Wort wie Tiere, Wissenschaft, Gemeinschaft, Reisen oder Wohlbefinden.`,
    footerNav: "Footer-Navigation",
    apps: "Apps",
    about: "Über uns",
    contact: "Kontakt",
    privacy: "Datenschutz",
    rights: "Alle Rechte vorbehalten.",
  },
  el: {
    shortcuts: "Συντομεύσεις ιστότοπου",
    homeAria: "Μετάβαση στην αρχική σελίδα του NutsNews",
    searchAria: "Άνοιγμα αναζήτησης",
    closeSearch: "Κλείσιμο αναζήτησης",
    searchTitle: "Αναζήτηση",
    searchPlaceholder: "Ζώα, επιστήμη, κοινότητα, ευεξία...",
    searchButton: "Αναζήτηση",
    searchLoading: "Αναζήτηση",
    searchError: "Δεν είναι δυνατή η αναζήτηση αυτή τη στιγμή.",
    clearSearch: "Καθαρισμός αναζήτησης",
    loadMoreResults: "Φόρτωση περισσότερων αποτελεσμάτων",
    readFullStory: "Διαβάστε ολόκληρη την ιστορία",
    recently: "Πρόσφατα",
    resultCount: (count, query) =>
      `${count} αποτέλεσμα${count === 1 ? "" : "τα"} για «${query}»`,
    emptyTitle: "Δεν βρέθηκαν ακόμα ιστορίες",
    emptyBody: (query) =>
      `Καμία δημοσιευμένη ιστορία του NutsNews δεν ταίριαξε με «${query}». Δοκιμάστε μια πιο γενική λέξη όπως ζώα, επιστήμη, κοινότητα, ταξίδια ή ευεξία.`,
    footerNav: "Πλοήγηση υποσέλιδου",
    apps: "Εφαρμογές",
    about: "Σχετικά",
    contact: "Επικοινωνία",
    privacy: "Απόρρητο",
    rights: "Με επιφύλαξη παντός δικαιώματος.",
  },
};

const dateLocaleByLanguage: Record<LanguageCode, string> = {
  en: "en-US",
  fr: "fr-FR",
  ja: "ja-JP",
  "de-CH": "de-CH",
  de: "de-DE",
  el: "el-GR",
};


function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function scrollHomePageToTop() {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (prefersReducedMotion) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return;
  }

  const startY = window.scrollY || document.documentElement.scrollTop || 0;

  if (startY <= 4) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return;
  }

  const duration = Math.min(920, Math.max(460, startY * 0.42));
  const startedAt = window.performance.now();

  function step(now: number) {
    const elapsed = now - startedAt;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(progress);

    window.scrollTo(0, Math.round(startY * (1 - eased)));

    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  }

  window.requestAnimationFrame(step);
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
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
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
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function formatSiteDate(dateValue: string | null, languageCode: LanguageCode) {
  if (!dateValue) {
    return footerCopyByLanguage[languageCode].recently;
  }

  const parsedDate = new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return footerCopyByLanguage[languageCode].recently;
  }

  return new Intl.DateTimeFormat(dateLocaleByLanguage[languageCode], {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsedDate);
}

function formatSourceLabel(source: string | null) {
  if (!source) {
    return "NutsNews";
  }

  const cleanedSource = source
    .replace(/^Google\s+News\s*-\s*/i, "")
    .replace(/^Google\s*-\s*/i, "")
    .trim();

  return cleanedSource || "NutsNews";
}

function SearchMenu({
  languageCode,
  isOpen,
  onClose,
}: {
  languageCode: LanguageCode;
  isOpen: boolean;
  onClose: () => void;
}) {
  const copy = footerCopyByLanguage[languageCode];
  const [searchInput, setSearchInput] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitAnimating, setIsSubmitAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const trimmedSearchInput = useMemo(
    () => searchInput.trim().replace(/\s+/g, " "),
    [searchInput],
  );

  const fetchSearchResults = useCallback(
    async ({ query, page }: { query: string; page: number }) => {
      const params = new URLSearchParams({
        q: query,
        page: String(page),
        limit: "10",
      });

      if (languageCode !== DEFAULT_LANGUAGE_CODE) {
        params.set("lang", languageCode);
      }

      const response = await fetch(`/api/search?${params.toString()}`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Search API returned ${response.status}`);
      }

      const data = (await response.json()) as SearchResponse;

      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    [languageCode],
  );

  const runSearch = useCallback(
    async ({
      query,
      page,
      append,
    }: {
      query: string;
      page: number;
      append: boolean;
    }) => {
      const safeQuery = query.trim().replace(/\s+/g, " ");

      if (safeQuery.length < 2) {
        setActiveSearchQuery("");
        setArticles([]);
        setNextPage(null);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchSearchResults({
          query: safeQuery,
          page,
        });

        setActiveSearchQuery(data.query || safeQuery);
        setArticles((currentArticles) => {
          if (!append) {
            return data.articles;
          }

          const seenIds = new Set(currentArticles.map((article) => article.id));
          const newArticles = data.articles.filter(
            (article) => !seenIds.has(article.id),
          );
          return [...currentArticles, ...newArticles];
        });
        setNextPage(Number.isFinite(data.nextPage) ? data.nextPage : null);
      } catch (searchError) {
        setError(
          searchError instanceof Error ? searchError.message : copy.searchError,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [copy.searchError, fetchSearchResults],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitAnimating(false);
    window.requestAnimationFrame(() => setIsSubmitAnimating(true));
    window.setTimeout(() => setIsSubmitAnimating(false), 460);
    void runSearch({
      query: trimmedSearchInput,
      page: 0,
      append: false,
    });
  }

  function clearSearch() {
    setSearchInput("");
    setActiveSearchQuery("");
    setArticles([]);
    setNextPage(null);
    setError(null);
    setIsLoading(false);
  }

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] grid min-h-[100dvh] place-items-center overflow-y-auto px-4 py-6 sm:p-8">
      <button
        type="button"
        aria-label={copy.closeSearch}
        className="search-menu-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="footer-search-title"
        data-testid="nutsnews-search-dialog"
        className="search-menu-panel relative my-auto max-h-[82dvh] w-full max-w-2xl overflow-hidden rounded-[2rem] border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-2xl shadow-black/40"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--theme-border)] px-5 py-4">
          <h2
            id="footer-search-title"
            className="text-lg font-black tracking-[-0.03em] text-[var(--theme-heading)]"
          >
            {copy.searchTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--theme-border)] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--theme-text)] transition hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-accent)]"
          >
            {copy.closeSearch}
          </button>
        </div>

        <div className="max-h-[calc(82dvh-4rem)] overflow-y-auto p-5">
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="footer-archive-search" className="sr-only">
              {copy.searchTitle}
            </label>
            <input
              id="footer-archive-search"
              data-testid="nutsnews-search-input"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="min-h-12 w-full rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] px-4 text-base font-semibold text-[var(--theme-text)] outline-none transition placeholder:text-[var(--theme-muted-strong)] focus:border-[var(--theme-border-strong)] focus:shadow-[0_0_0_4px_var(--theme-glow-soft)]"
              autoComplete="off"
              inputMode="search"
              autoFocus
            />
            <button
              type="submit"
              data-testid="nutsnews-search-submit"
              className={`read-story-button search-submit-button min-h-12 w-full justify-center px-6 ${
                isSubmitAnimating ? "search-submit-button--pulse" : ""
              }`}
              disabled={isLoading || trimmedSearchInput.length < 2}
            >
              {copy.searchButton}
            </button>
          </form>

          {activeSearchQuery && articles.length > 0 ? (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-black text-[var(--theme-heading)]">
                {copy.resultCount(articles.length, activeSearchQuery)}
              </p>
              <button
                type="button"
                onClick={clearSearch}
                className="text-left text-xs font-black uppercase tracking-[0.12em] text-[var(--theme-accent)] transition hover:text-[var(--theme-accent-soft)] sm:text-right"
              >
                {copy.clearSearch}
              </button>
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-5 text-center">
              <p className="text-sm font-black text-[var(--theme-heading)]">
                {copy.searchError}
              </p>
              <p className="mt-2 text-xs font-semibold text-[var(--theme-muted)]">
                {error}
              </p>
            </div>
          ) : null}

          {activeSearchQuery &&
          !isLoading &&
          articles.length === 0 &&
          !error ? (
            <div className="mt-5 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-6 text-center">
              <h3 className="text-xl font-black tracking-[-0.03em] text-[var(--theme-heading)]">
                {copy.emptyTitle}
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-[var(--theme-muted)]">
                {copy.emptyBody(activeSearchQuery)}
              </p>
              <button
                type="button"
                onClick={clearSearch}
                className="read-story-button mt-5 px-5 py-2 text-[11px]"
              >
                {copy.clearSearch}
              </button>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {articles.map((article) => (
              <article
                key={article.id}
                data-testid="nutsnews-search-result-card"
                className="overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-soft)]"
              >
                <div className="grid gap-0 sm:grid-cols-[150px_1fr]">
                  {article.image_url ? (
                    <a
                      href={article.original_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block bg-[var(--theme-surface-strong)]"
                      aria-label={`${copy.readFullStory}: ${article.title}`}
                    >
                      <img
                        src={article.image_url}
                        alt=""
                        className="h-36 w-full object-cover sm:h-full"
                        loading="lazy"
                        decoding="async"
                      />
                    </a>
                  ) : null}

                  <div className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--theme-muted)]">
                      <span>
                        {formatSiteDate(article.published_on_site_at, languageCode)}
                      </span>
                      <span>{formatSourceLabel(article.source)}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-black leading-tight tracking-[-0.03em] text-[var(--theme-heading)]">
                      {article.title}
                    </h3>
                    {article.ai_summary ? (
                      <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-[var(--theme-muted)]">
                        {article.ai_summary}
                      </p>
                    ) : null}
                    <a
                      href={article.original_url}
                      target="_blank"
                      rel="noreferrer"
                      className="read-story-button mt-4 px-4 py-2 text-[11px]"
                    >
                      {copy.readFullStory}
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-6" aria-live="polite">
              <div className="loading-pill">
                <span className="loading-pill__dot" />
                {copy.searchLoading}
              </div>
            </div>
          ) : null}

          {nextPage !== null && !isLoading ? (
            <div className="flex justify-center pt-5">
              <button
                type="button"
                onClick={() =>
                  void runSearch({
                    query: activeSearchQuery,
                    page: nextPage,
                    append: true,
                  })
                }
                className="read-story-button px-6 py-3"
              >
                {copy.loadMoreResults}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function SiteFooter() {
  const selectedLanguage = useSelectedLanguage();
  const copy = footerCopyByLanguage[selectedLanguage];
  const pathname = usePathname();
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchButtonAnimating, setIsSearchButtonAnimating] = useState(false);
  const [isHomeButtonAnimating, setIsHomeButtonAnimating] = useState(false);

  function pulseHomeButton() {
    setIsHomeButtonAnimating(false);
    window.requestAnimationFrame(() => setIsHomeButtonAnimating(true));
    window.setTimeout(() => setIsHomeButtonAnimating(false), 620);
  }

  function handleHomeClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    pulseHomeButton();

    if (pathname === "/") {
      event.preventDefault();
      scrollHomePageToTop();
      return;
    }

    try {
      window.sessionStorage.setItem(FOOTER_HOME_TRANSITION_KEY, "1");
    } catch {
      // Navigation still works if session storage is unavailable.
    }

    event.preventDefault();
    router.push("/");
  }

  function openSearchMenu() {
    setIsSearchButtonAnimating(false);
    window.requestAnimationFrame(() => setIsSearchButtonAnimating(true));
    window.setTimeout(() => setIsSearchButtonAnimating(false), 520);
    setIsSearchOpen(true);
  }

  return (
    <footer className="site-footer-modern">
      <div className="site-footer-modern__inner">
        <div className="site-footer-modern__top-row">
          <div
            className="site-footer-modern__controls"
            aria-label={copy.shortcuts}
          >
            <Link
              href="/"
              data-testid="nutsnews-footer-home"
              className={`footer-icon-button ${
                isHomeButtonAnimating ? "footer-icon-button--home-pulse" : ""
              }`}
              aria-label={copy.homeAria}
              onClick={handleHomeClick}
            >
              <span className="footer-icon-button__halo" />
              <HomeIcon className="footer-icon-button__icon" />
            </Link>

            <button
              type="button"
              data-testid="nutsnews-footer-search"
              className={`footer-icon-button footer-icon-button--search ${
                isSearchButtonAnimating ? "footer-icon-button--search-pulse" : ""
              }`}
              aria-label={copy.searchAria}
              onClick={openSearchMenu}
            >
              <span className="footer-icon-button__halo" />
              <SearchIcon className="footer-icon-button__icon" />
            </button>

            <ThemeSwitcher />
          </div>

          <nav aria-label={copy.footerNav} className="site-footer-modern__nav">
            <Link href="/apps" className="site-footer-modern__link">
              {copy.apps}
            </Link>
            <Link href="/about" className="site-footer-modern__link">
              {copy.about}
            </Link>
            <Link href="/contact" className="site-footer-modern__link">
              {copy.contact}
            </Link>
            <Link href="/privacy" className="site-footer-modern__link">
              {copy.privacy}
            </Link>
          </nav>
        </div>

        <p className="site-footer-modern__copyright">
          © {COPYRIGHT_YEAR}{" "}
          <a
            href="https://www.ramideltoro.com"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[var(--theme-accent)] transition hover:text-[var(--theme-accent-soft)]"
          >
            Rami Del Toro
          </a>{" "}
          · {copy.rights}
        </p>
      </div>

      <SearchMenu
        languageCode={selectedLanguage}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      <style jsx global>{`
        @keyframes nutsnewsSearchBackdropFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes nutsnewsSearchPanelEnter {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.96);
            filter: blur(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }


        @keyframes nutsnewsFooterHomePulse {
          0% {
            transform: translateY(0) scale(1);
            box-shadow: 0 0 0 0 var(--theme-glow-soft);
          }
          45% {
            transform: translateY(-3px) scale(1.09);
            box-shadow: 0 0 0 10px var(--theme-glow-soft);
          }
          100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 0 0 0 transparent;
          }
        }

        @keyframes nutsnewsFooterSearchPulse {
          0% {
            transform: translateY(0) scale(1);
            box-shadow: 0 0 0 0 var(--theme-glow-soft);
          }
          45% {
            transform: translateY(-2px) scale(1.08);
            box-shadow: 0 0 0 8px var(--theme-glow-soft);
          }
          100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 0 0 0 transparent;
          }
        }

        @keyframes nutsnewsSearchSubmitPulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 var(--theme-glow-soft);
          }
          45% {
            transform: scale(1.025);
            box-shadow: 0 0 0 8px var(--theme-glow-soft);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 transparent;
          }
        }

        .search-menu-backdrop {
          animation: nutsnewsSearchBackdropFade 180ms ease-out both;
        }

        .search-menu-panel {
          animation: nutsnewsSearchPanelEnter 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
          transform-origin: center;
        }

        .footer-icon-button--home-pulse {
          animation: nutsnewsFooterHomePulse 620ms ease-out both;
        }

        .footer-icon-button--search-pulse {
          animation: nutsnewsFooterSearchPulse 520ms ease-out both;
        }

        .search-submit-button--pulse {
          animation: nutsnewsSearchSubmitPulse 460ms ease-out both;
        }

        @media (prefers-reduced-motion: reduce) {
          .search-menu-backdrop,
          .search-menu-panel,
          .footer-icon-button--home-pulse,
          .footer-icon-button--search-pulse,
          .search-submit-button--pulse {
            animation: none;
          }
        }
      `}</style>
    </footer>
  );
}
