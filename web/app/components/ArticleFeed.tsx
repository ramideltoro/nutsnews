"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Article } from "@/lib/articles";
import {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_STORAGE_KEY,
  type LanguageCode,
  isSupportedLanguageCode,
} from "@/lib/languages";
import { OptimizedArticleImage } from "./OptimizedArticleImage";

type ArticleFeedProps = {
  initialArticles: Article[];
  initialNextPage: number | null;
  initialNextCursor: string | null;
};

type ArticlesResponse = {
  articles: Article[];
  nextPage: number | null;
  nextCursor: string | null;
  error?: string;
};

const copyByLanguage: Record<
  LanguageCode,
  {
    recently: string;
    loadingMore: string;
    readFullStory: string;
    emptyFeed: string;
    loadError: string;
    tryAgain: string;
    searchLabel: string;
    searchPlaceholder: string;
    searchButton: string;
    searchLoading: string;
    searchLoadError: string;
    clearSearch: string;
    loadMoreResults: string;
    searchHint: string;
    searchResultsLabel: (count: number, query: string) => string;
    noSearchResultsTitle: string;
    noSearchResultsBody: (query: string) => string;
  }
> = {
  en: {
    recently: "Recently",
    loadingMore: "Loading more stories",
    readFullStory: "Read full story",
    emptyFeed:
      "No uplifting stories are available yet. Please check back soon.",
    loadError: "Could not load more stories.",
    tryAgain: "Try again",
    searchLabel: "Search all NutsNews",
    searchPlaceholder: "Search animals, science, community, wellness...",
    searchButton: "Search",
    searchLoading: "Searching the full archive",
    searchLoadError: "Could not search the archive.",
    clearSearch: "Clear search",
    loadMoreResults: "Load more results",
    searchHint:
      "Search the full NutsNews archive, not just the stories currently loaded here.",
    searchResultsLabel: (count, query) =>
      `${count} result${count === 1 ? "" : "s"} for “${query}”`,
    noSearchResultsTitle: "No matching stories yet",
    noSearchResultsBody: (query) =>
      `No published NutsNews stories matched “${query}”. Try a broader word like animals, science, community, travel, or wellness.`,
  },
  fr: {
    recently: "Récemment",
    loadingMore: "Chargement d’autres histoires",
    readFullStory: "Lire l’article complet",
    emptyFeed:
      "Aucune histoire positive n’est disponible pour le moment. Revenez bientôt.",
    loadError: "Impossible de charger plus d’histoires.",
    tryAgain: "Réessayer",
    searchLabel: "Rechercher dans tout NutsNews",
    searchPlaceholder: "Animaux, science, communauté, bien-être...",
    searchButton: "Rechercher",
    searchLoading: "Recherche dans toute l’archive",
    searchLoadError: "Impossible de rechercher dans l’archive.",
    clearSearch: "Effacer la recherche",
    loadMoreResults: "Charger plus de résultats",
    searchHint:
      "Recherchez dans toute l’archive NutsNews, pas seulement dans les histoires déjà affichées ici.",
    searchResultsLabel: (count, query) =>
      `${count} résultat${count === 1 ? "" : "s"} pour « ${query} »`,
    noSearchResultsTitle: "Aucune histoire trouvée",
    noSearchResultsBody: (query) =>
      `Aucune histoire publiée ne correspond à « ${query} ». Essayez un mot plus large comme animaux, science, communauté, voyage ou bien-être.`,
  },
  ja: {
    recently: "最近",
    loadingMore: "さらにストーリーを読み込み中",
    readFullStory: "元の記事を読む",
    emptyFeed:
      "前向きなストーリーはまだありません。しばらくしてからご確認ください。",
    loadError: "ストーリーを読み込めませんでした。",
    tryAgain: "もう一度試す",
    searchLabel: "NutsNews全体を検索",
    searchPlaceholder: "動物、科学、コミュニティ、健康...",
    searchButton: "検索",
    searchLoading: "全アーカイブを検索中",
    searchLoadError: "アーカイブを検索できませんでした。",
    clearSearch: "検索をクリア",
    loadMoreResults: "さらに結果を表示",
    searchHint:
      "ここに表示中の記事だけでなく、NutsNews全体のアーカイブを検索できます。",
    searchResultsLabel: (count, query) => `「${query}」の検索結果 ${count}件`,
    noSearchResultsTitle: "一致するストーリーはありません",
    noSearchResultsBody: (query) =>
      `「${query}」に一致する公開済みストーリーはありません。動物、科学、コミュニティ、旅行、健康など広い言葉を試してください。`,
  },
};

const dateLocaleByLanguage: Record<LanguageCode, string> = {
  en: "en-US",
  fr: "fr-FR",
  ja: "ja-JP",
};

function getStoredLanguage(): LanguageCode {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE_CODE;
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isSupportedLanguageCode(storedLanguage)
    ? storedLanguage
    : DEFAULT_LANGUAGE_CODE;
}

function formatSiteDate(dateValue: string | null, languageCode: LanguageCode) {
  if (!dateValue) {
    return copyByLanguage[languageCode].recently;
  }

  const parsedDate = new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return copyByLanguage[languageCode].recently;
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

function LoadingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-7" aria-live="polite">
      <div className="loading-pill">
        <span className="loading-pill__dot" />
        {label}
      </div>
    </div>
  );
}

function ArticleCard({
  article,
  index,
  languageCode,
}: {
  article: Article;
  index: number;
  languageCode: LanguageCode;
}) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const card = cardRef.current;

    if (!card) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const animationFrame = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });

      return () => window.cancelAnimationFrame(animationFrame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.14,
      },
    );

    observer.observe(card);

    return () => observer.disconnect();
  }, []);

  const revealDelay = `${Math.min(index % 5, 4) * 60}ms`;

  return (
    <article
      ref={cardRef}
      style={{ transitionDelay: isVisible ? revealDelay : "0ms" }}
      className={`article-card-modern group transition-all duration-700 ease-out will-change-transform motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:blur-0 motion-reduce:transition-none ${
        isVisible
          ? "translate-y-0 opacity-100 blur-0"
          : "translate-y-8 opacity-0 blur-[2px]"
      }`}
      lang={article.language_code ?? languageCode}
    >
      <div className="article-card-modern__image relative aspect-[16/10] overflow-hidden">
        <OptimizedArticleImage src={article.image_url} eager={index === 0} />
        <div className="article-card-modern__image-glow" aria-hidden="true" />
      </div>

      <div className="article-card-modern__body space-y-4 p-5 sm:p-6">
        <h2 className="article-card-modern__title text-2xl font-black leading-tight tracking-[-0.04em] sm:text-[1.7rem]">
          {article.title}
        </h2>

        {article.ai_summary ? (
          <p className="article-card-modern__summary text-[15px] leading-7">
            {article.ai_summary}
          </p>
        ) : null}

        <a
          href={article.original_url}
          target="_blank"
          rel="noreferrer"
          className="read-story-button"
        >
          {copyByLanguage[languageCode].readFullStory}
        </a>

        <div className="article-card-modern__meta flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[11px] font-bold uppercase tracking-[0.14em]">
          <span>
            {formatSiteDate(article.published_on_site_at, languageCode)}
          </span>
          <span>{formatSourceLabel(article.source)}</span>
        </div>
      </div>
    </article>
  );
}

export function ArticleFeed({
  initialArticles,
  initialNextPage,
  initialNextCursor,
}: ArticleFeedProps) {
  const [articles, setArticles] = useState(initialArticles);
  const [nextPage, setNextPage] = useState(initialNextPage);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(
    DEFAULT_LANGUAGE_CODE,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isReloadingLanguageRef = useRef(false);

  const copy = copyByLanguage[selectedLanguage];

  const fetchArticles = useCallback(
    async ({
      page,
      cursor,
      languageCode,
    }: {
      page: number | null;
      cursor: string | null;
      languageCode: LanguageCode;
    }) => {
      const query = new URLSearchParams();

      if (page !== null) {
        query.set("page", String(page));
      } else if (cursor) {
        query.set("cursor", cursor);
      }

      if (languageCode !== DEFAULT_LANGUAGE_CODE) {
        query.set("lang", languageCode);
      }

      const response = await fetch(`/api/articles?${query.toString()}`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Articles API returned ${response.status}`);
      }

      const data = (await response.json()) as ArticlesResponse;

      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    [],
  );

  const loadFirstPageForLanguage = useCallback(
    async (languageCode: LanguageCode) => {
      isReloadingLanguageRef.current = true;
      setIsLoading(true);
      setLoadError(null);

      try {
        const data = await fetchArticles({
          page: 0,
          cursor: null,
          languageCode,
        });

        setArticles(data.articles);
        setNextPage(Number.isFinite(data.nextPage) ? data.nextPage : null);
        setNextCursor(data.nextCursor ?? null);
        document.documentElement.lang = languageCode;
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : copyByLanguage[languageCode].loadError,
        );
      } finally {
        isReloadingLanguageRef.current = false;
        setIsLoading(false);
      }
    },
    [fetchArticles],
  );

  useEffect(() => {
    const storedLanguage = getStoredLanguage();
    document.documentElement.lang = storedLanguage;

    if (storedLanguage !== DEFAULT_LANGUAGE_CODE) {
      window.setTimeout(() => {
        setSelectedLanguage(storedLanguage);
        void loadFirstPageForLanguage(storedLanguage);
      }, 0);
    }

    const handleLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<{ languageCode?: string }>)
        .detail?.languageCode;

      if (!isSupportedLanguageCode(nextLanguage)) {
        return;
      }

      setSelectedLanguage(nextLanguage);
      void loadFirstPageForLanguage(nextLanguage);
    };

    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);

    return () =>
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
  }, [loadFirstPageForLanguage]);

  const loadMoreArticles = useCallback(async () => {
    if (
      (nextPage === null && !nextCursor) ||
      isLoading ||
      isReloadingLanguageRef.current
    ) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await fetchArticles({
        page: nextPage,
        cursor: nextCursor,
        languageCode: selectedLanguage,
      });

      setArticles((currentArticles) => {
        const seenIds = new Set(currentArticles.map((article) => article.id));
        const newArticles = data.articles.filter(
          (article) => !seenIds.has(article.id),
        );

        return [...currentArticles, ...newArticles];
      });
      setNextPage(Number.isFinite(data.nextPage) ? data.nextPage : null);
      setNextCursor(data.nextCursor ?? null);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : copyByLanguage[selectedLanguage].loadError,
      );
    } finally {
      setIsLoading(false);
    }
  }, [fetchArticles, isLoading, nextCursor, nextPage, selectedLanguage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || (nextPage === null && !nextCursor)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry?.isIntersecting) {
          void loadMoreArticles();
        }
      },
      {
        rootMargin: "900px 0px 900px 0px",
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadMoreArticles, nextCursor, nextPage]);

  return (
    <>
      {articles.length === 0 ? (
        <div className="empty-feed-card px-5 py-8 text-center">
          <p className="text-sm font-semibold">{copy.emptyFeed}</p>
        </div>
      ) : null}

      {articles.length > 0 ? (
        <div className="space-y-6 sm:space-y-7">
          {articles.map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              index={index}
              languageCode={selectedLanguage}
            />
          ))}
        </div>
      ) : null}

      <div ref={sentinelRef} aria-hidden="true" className="h-8" />

      {isLoading ? <LoadingIndicator label={copy.loadingMore} /> : null}

      {loadError ? (
        <div className="empty-feed-card mt-5 p-4 text-center">
          <p className="text-sm font-semibold">{copy.loadError}</p>
          <button
            type="button"
            onClick={() => void loadMoreArticles()}
            className="read-story-button mt-3 px-4 py-2 text-[11px]"
          >
            {copy.tryAgain}
          </button>
        </div>
      ) : null}
    </>
  );
}
