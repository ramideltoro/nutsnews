"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dedupeArticlesByIdentity,
  getArticleIdentityKey,
} from "@/lib/articleIdentity";
import type { Article } from "@/lib/articles";
import {
  DEFAULT_LANGUAGE_CODE,
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_STORAGE_KEY,
  type LanguageCode,
  isSupportedLanguageCode,
} from "@/lib/languages";
import { OptimizedArticleImage } from "./OptimizedArticleImage";

export type ArticleCategorySection = {
  id: Exclude<CategoryId, "all">;
  articles: Article[];
};

type ArticleFeedProps = {
  initialArticles: Article[];
  initialNextPage: number | null;
  initialNextCursor: string | null;
  initialCategorySections: ArticleCategorySection[];
};

type ArticlesResponse = {
  articles: Article[];
  nextPage: number | null;
  nextCursor: string | null;
  error?: string;
};

type HomeFeedResponse = ArticlesResponse & {
  sections: ArticleCategorySection[];
};

type CategoryId =
  | "all"
  | "community"
  | "animals"
  | "science"
  | "wellness"
  | "travel"
  | "culture"
  | "achievements";

type CategoryNavItem = {
  id: CategoryId;
  href: string;
  query: string | null;
};

type FeedCopy = {
  recently: string;
  loadingMore: string;
  readFullStory: string;
  emptyFeed: string;
  loadError: string;
  tryAgain: string;
  topStories: string;
  leadStory: string;
  editorsPicks: string;
  latestBriefs: string;
  moreGoodNews: string;
  moreGoodNewsDeck: string;
  sourceLabel: string;
  categoryLabels: Record<CategoryId, string>;
};

const CATEGORY_NAV_ITEMS: CategoryNavItem[] = [
  { id: "all", href: "#top-stories", query: null },
  { id: "community", href: "#community", query: "community" },
  { id: "animals", href: "#animals", query: "animals" },
  { id: "science", href: "#science", query: "science" },
  { id: "wellness", href: "#wellness", query: "wellness" },
  { id: "travel", href: "#travel", query: "travel" },
  { id: "culture", href: "#culture", query: "culture" },
  { id: "achievements", href: "#achievements", query: "achievement" },
];

export const copyByLanguage: Record<LanguageCode, FeedCopy> = {
  en: {
    recently: "Recently",
    loadingMore: "Loading more stories",
    readFullStory: "Read full story",
    emptyFeed:
      "No uplifting stories are available yet. Please check back soon.",
    loadError: "Could not load more stories.",
    tryAgain: "Try again",
    topStories: "Top Stories",
    leadStory: "Lead story",
    editorsPicks: "Editor-style picks",
    latestBriefs: "Latest briefs",
    moreGoodNews: "More Good News",
    moreGoodNewsDeck: "Keep reading from the full NutsNews feed.",
    sourceLabel: "Source",
    categoryLabels: {
      all: "All",
      community: "Community",
      animals: "Animals",
      science: "Science",
      wellness: "Wellness",
      travel: "Travel",
      culture: "Culture",
      achievements: "Achievements",
    },
  },
  fr: {
    recently: "Récemment",
    loadingMore: "Chargement d’autres histoires",
    readFullStory: "Lire l’article complet",
    emptyFeed:
      "Aucune histoire positive n’est disponible pour le moment. Revenez bientôt.",
    loadError: "Impossible de charger plus d’histoires.",
    tryAgain: "Réessayer",
    topStories: "À la une",
    leadStory: "Article principal",
    editorsPicks: "Sélection",
    latestBriefs: "Dernières brèves",
    moreGoodNews: "Plus de bonnes nouvelles",
    moreGoodNewsDeck: "Continuez à lire le fil complet de NutsNews.",
    sourceLabel: "Source",
    categoryLabels: {
      all: "Tout",
      community: "Communauté",
      animals: "Animaux",
      science: "Science",
      wellness: "Bien-être",
      travel: "Voyage",
      culture: "Culture",
      achievements: "Réussites",
    },
  },
  ja: {
    recently: "最近",
    loadingMore: "さらにストーリーを読み込み中",
    readFullStory: "元の記事を読む",
    emptyFeed:
      "前向きなストーリーはまだありません。しばらくしてからご確認ください。",
    loadError: "ストーリーを読み込めませんでした。",
    tryAgain: "もう一度試す",
    topStories: "トップストーリー",
    leadStory: "リード記事",
    editorsPicks: "注目記事",
    latestBriefs: "最新短報",
    moreGoodNews: "さらに良いニュース",
    moreGoodNewsDeck: "NutsNewsのフィードを続けて読む。",
    sourceLabel: "出典",
    categoryLabels: {
      all: "すべて",
      community: "コミュニティ",
      animals: "動物",
      science: "科学",
      wellness: "ウェルネス",
      travel: "旅行",
      culture: "文化",
      achievements: "達成",
    },
  },
  "de-CH": {
    recently: "Kürzlich",
    loadingMore: "Weitere Geschichten werden geladen",
    readFullStory: "Ganze Geschichte lesen",
    emptyFeed:
      "Im Moment sind keine positiven Geschichten verfügbar. Schau bald wieder vorbei.",
    loadError: "Weitere Geschichten konnten nicht geladen werden.",
    tryAgain: "Erneut versuchen",
    topStories: "Top-Geschichten",
    leadStory: "Hauptgeschichte",
    editorsPicks: "Auswahl",
    latestBriefs: "Kurzmeldungen",
    moreGoodNews: "Mehr gute Nachrichten",
    moreGoodNewsDeck: "Lies weiter im ganzen NutsNews-Feed.",
    sourceLabel: "Quelle",
    categoryLabels: {
      all: "Alle",
      community: "Gemeinschaft",
      animals: "Tiere",
      science: "Wissenschaft",
      wellness: "Wohlbefinden",
      travel: "Reisen",
      culture: "Kultur",
      achievements: "Erfolge",
    },
  },
  de: {
    recently: "Kürzlich",
    loadingMore: "Weitere Geschichten werden geladen",
    readFullStory: "Ganze Geschichte lesen",
    emptyFeed:
      "Im Moment sind keine positiven Geschichten verfügbar. Schau bald wieder vorbei.",
    loadError: "Weitere Geschichten konnten nicht geladen werden.",
    tryAgain: "Erneut versuchen",
    topStories: "Top-Geschichten",
    leadStory: "Hauptgeschichte",
    editorsPicks: "Auswahl",
    latestBriefs: "Kurzmeldungen",
    moreGoodNews: "Mehr gute Nachrichten",
    moreGoodNewsDeck: "Lies weiter im gesamten NutsNews-Feed.",
    sourceLabel: "Quelle",
    categoryLabels: {
      all: "Alle",
      community: "Gemeinschaft",
      animals: "Tiere",
      science: "Wissenschaft",
      wellness: "Wohlbefinden",
      travel: "Reisen",
      culture: "Kultur",
      achievements: "Erfolge",
    },
  },
  el: {
    recently: "Πρόσφατα",
    loadingMore: "Φόρτωση περισσότερων ιστοριών",
    readFullStory: "Διαβάστε ολόκληρη την ιστορία",
    emptyFeed:
      "Δεν υπάρχουν ακόμα θετικές ιστορίες. Ελέγξτε ξανά σύντομα.",
    loadError: "Δεν ήταν δυνατή η φόρτωση περισσότερων ιστοριών.",
    tryAgain: "Δοκιμάστε ξανά",
    topStories: "Κύριες ιστορίες",
    leadStory: "Κύρια ιστορία",
    editorsPicks: "Επιλογές",
    latestBriefs: "Τελευταία σύντομα",
    moreGoodNews: "Περισσότερα καλά νέα",
    moreGoodNewsDeck: "Συνεχίστε να διαβάζετε από όλη τη ροή του NutsNews.",
    sourceLabel: "Πηγή",
    categoryLabels: {
      all: "Όλα",
      community: "Κοινότητα",
      animals: "Ζώα",
      science: "Επιστήμη",
      wellness: "Ευεξία",
      travel: "Ταξίδια",
      culture: "Πολιτισμός",
      achievements: "Επιτεύγματα",
    },
  },
};

export const dateLocaleByLanguage: Record<LanguageCode, string> = {
  en: "en-US",
  fr: "fr-FR",
  ja: "ja-JP",
  "de-CH": "de-CH",
  de: "de-DE",
  el: "el-GR",
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

function getCategoryQuery(categoryId: CategoryId = "all") {
  return CATEGORY_NAV_ITEMS.find((item) => item.id === categoryId)?.query ?? null;
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

type ArticleCardVariant = "lead" | "feature" | "rail" | "standard";

function getArticleRenderKey(article: Article, index: number) {
  return getArticleIdentityKey(article) ?? `unkeyed:${index}`;
}

function dedupeCategorySectionsForPage(
  sections: ArticleCategorySection[],
  pageArticles: Article[],
) {
  const seenArticleKeys = new Set(
    pageArticles
      .map((article) => getArticleIdentityKey(article))
      .filter((articleKey): articleKey is string => Boolean(articleKey)),
  );

  return sections.map((section) => {
    const uniqueArticles: Article[] = [];

    for (const article of section.articles) {
      const articleKey = getArticleIdentityKey(article);

      if (articleKey && seenArticleKeys.has(articleKey)) {
        continue;
      }

      uniqueArticles.push(article);

      if (articleKey) {
        seenArticleKeys.add(articleKey);
      }
    }

    return {
      ...section,
      articles: uniqueArticles,
    };
  });
}

function ArticleCard({
  article,
  index,
  languageCode,
  variant,
  label,
}: {
  article: Article;
  index: number;
  languageCode: LanguageCode;
  variant: ArticleCardVariant;
  label?: string;
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
        threshold: 0.12,
      },
    );

    observer.observe(card);

    return () => observer.disconnect();
  }, []);

  const revealDelay = `${Math.min(index % 5, 4) * 50}ms`;
  const sourceLabel = formatSourceLabel(article.source);
  const siteDate = formatSiteDate(article.published_on_site_at, languageCode);
  const showSummary = variant !== "rail";
  const showCta = variant === "lead" || variant === "standard";

  return (
    <article
      ref={cardRef}
      data-testid="nutsnews-article-card"
      style={{ transitionDelay: isVisible ? revealDelay : "0ms" }}
      className={`wp-article-card wp-article-card--${variant} transition-all duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:blur-0 motion-reduce:transition-none ${
        isVisible
          ? "translate-y-0 opacity-100 blur-0"
          : "translate-y-6 opacity-0 blur-[2px]"
      }`}
      lang={article.language_code ?? languageCode}
    >
      <a
        href={article.original_url}
        target="_blank"
        rel="noreferrer"
        className="wp-article-card__link"
      >
        <div className="wp-article-card__image relative overflow-hidden">
          <OptimizedArticleImage
            src={article.image_url}
            category={article.category}
            eager={index < 2}
            sizes={
              variant === "lead"
                ? "(min-width: 1024px) 56vw, 100vw"
                : "(min-width: 1024px) 28vw, 100vw"
            }
          />
        </div>

        <div className="wp-article-card__body">
          <div className="wp-article-card__meta" aria-label={`${sourceLabel} · ${siteDate}`}>
            {label ? <span>{label}</span> : null}
            <span>{sourceLabel}</span>
            <span>{siteDate}</span>
          </div>

          <h2 className="wp-article-card__title">{article.title}</h2>

          {article.ai_summary && showSummary ? (
            <p className="wp-article-card__summary">{article.ai_summary}</p>
          ) : null}

          {showCta ? (
            <span className="read-story-button wp-article-card__cta">
              {copyByLanguage[languageCode].readFullStory}
            </span>
          ) : null}
        </div>
      </a>
    </article>
  );
}

export function ArticleFeed({
  initialArticles,
  initialNextPage,
  initialNextCursor,
  initialCategorySections,
}: ArticleFeedProps) {
  const initialUniqueArticles = useMemo(
    () => dedupeArticlesByIdentity(initialArticles),
    [initialArticles],
  );
  const initialUniqueCategorySections = useMemo(
    () =>
      dedupeCategorySectionsForPage(
        initialCategorySections,
        initialUniqueArticles,
      ),
    [initialCategorySections, initialUniqueArticles],
  );
  const [articles, setArticles] = useState(initialUniqueArticles);
  const [nextPage, setNextPage] = useState(initialNextPage);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(
    DEFAULT_LANGUAGE_CODE,
  );
  const [categorySections, setCategorySections] = useState(initialUniqueCategorySections);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isReloadingFirstPageRef = useRef(false);
  const initialEnglishArticlesRef = useRef(initialUniqueArticles);
  const initialEnglishNextPageRef = useRef(initialNextPage);
  const initialEnglishNextCursorRef = useRef(initialNextCursor);
  const initialEnglishCategorySectionsRef = useRef(initialUniqueCategorySections);

  const copy = copyByLanguage[selectedLanguage];

  const frontPage = useMemo(
    () => ({
      lead: articles[0] ?? null,
      features: articles.slice(1, 3),
      latest: articles.slice(3, 5),
      more: articles.slice(5),
    }),
    [articles],
  );

  const orderedCategorySections = useMemo(() => {
    const pageUniqueSections = dedupeCategorySectionsForPage(
      categorySections,
      articles,
    );
    const sectionsById = new Map(
      pageUniqueSections.map((section) => [section.id, section.articles]),
    );

    return CATEGORY_NAV_ITEMS.filter(
      (item): item is CategoryNavItem & { id: ArticleCategorySection["id"] } =>
        item.id !== "all",
    ).map((item) => ({
      id: item.id,
      articles: sectionsById.get(item.id) ?? [],
    }));
  }, [articles, categorySections]);

  const fetchArticles = useCallback(
    async ({
      page,
      cursor,
      languageCode,
      categoryId = "all",
    }: {
      page: number | null;
      cursor: string | null;
      languageCode: LanguageCode;
      categoryId?: CategoryId;
    }) => {
      const query = new URLSearchParams();
      const categoryQuery = getCategoryQuery(categoryId);

      if (page !== null) {
        query.set("page", String(page));
      } else if (cursor) {
        query.set("cursor", cursor);
      }

      if (categoryQuery) {
        query.set("category", categoryQuery);
      }

      if (languageCode !== DEFAULT_LANGUAGE_CODE) {
        query.set("lang", languageCode);
      }

      const response = await fetch(`/api/articles?${query.toString()}`, {
        cache: "default",
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

  const loadLocalizedHomeFeed = useCallback(
    async (languageCode: LanguageCode) => {
      isReloadingFirstPageRef.current = true;
      setIsLoading(true);
      setLoadError(null);

      try {
        const homeQuery = new URLSearchParams();
        homeQuery.set("home", "1");

        if (languageCode !== DEFAULT_LANGUAGE_CODE) {
          homeQuery.set("lang", languageCode);
        }

        let response = await fetch(`/api/articles?${homeQuery.toString()}`, {
          cache: "default",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          const fallbackQuery = new URLSearchParams();

          if (languageCode !== DEFAULT_LANGUAGE_CODE) {
            fallbackQuery.set("lang", languageCode);
          }

          response = await fetch(`/api/home-feed?${fallbackQuery.toString()}`, {
            cache: "default",
            headers: { Accept: "application/json" },
          });
        }

        if (!response.ok) {
          throw new Error(`Home feed API returned ${response.status}`);
        }

        const data = (await response.json()) as HomeFeedResponse;

        if (data.error) {
          throw new Error(data.error);
        }

        const uniqueArticles = dedupeArticlesByIdentity(data.articles);
        setArticles(uniqueArticles);
        setNextPage(Number.isFinite(data.nextPage) ? data.nextPage : null);
        setNextCursor(data.nextCursor ?? null);
        setCategorySections(
          dedupeCategorySectionsForPage(data.sections, uniqueArticles),
        );
        document.documentElement.lang = languageCode;
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : copyByLanguage[languageCode].loadError,
        );
      } finally {
        isReloadingFirstPageRef.current = false;
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const storedLanguage = getStoredLanguage();
    document.documentElement.lang = storedLanguage;

    const initialRefreshTimer = window.setTimeout(() => {
      setSelectedLanguage(storedLanguage);

      if (
        storedLanguage !== DEFAULT_LANGUAGE_CODE ||
        initialEnglishArticlesRef.current.length === 0
      ) {
        void loadLocalizedHomeFeed(storedLanguage);
      }
    }, 0);

    const handleLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<{ languageCode?: string }>)
        .detail?.languageCode;

      if (!isSupportedLanguageCode(nextLanguage)) {
        return;
      }

      setSelectedLanguage(nextLanguage);

      if (nextLanguage === DEFAULT_LANGUAGE_CODE) {
        setArticles(initialEnglishArticlesRef.current);
        setNextPage(initialEnglishNextPageRef.current);
        setNextCursor(initialEnglishNextCursorRef.current);
        setCategorySections(initialEnglishCategorySectionsRef.current);
        setLoadError(null);
        document.documentElement.lang = DEFAULT_LANGUAGE_CODE;
        return;
      }

      void loadLocalizedHomeFeed(nextLanguage);
    };

    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);

    return () => {
      window.clearTimeout(initialRefreshTimer);
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    };
  }, [loadLocalizedHomeFeed]);

  const loadMoreArticles = useCallback(async () => {
    if (
      (nextPage === null && !nextCursor) ||
      isLoading ||
      isReloadingFirstPageRef.current
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

      setArticles((currentArticles) =>
        dedupeArticlesByIdentity([...currentArticles, ...data.articles]),
      );
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
    <section className="newspaper-feed-shell" id="top-stories" data-testid="nutsnews-article-feed">
      <div className="newspaper-feed-heading">
        <div>
          <h2>{copy.topStories}</h2>
        </div>
      </div>

      {articles.length === 0 && !isLoading ? (
        <div className="empty-feed-card px-5 py-8 text-center">
          <p className="text-sm font-semibold">{copy.emptyFeed}</p>
        </div>
      ) : null}

      {frontPage.lead ? (
        <div className="newspaper-front-grid">
          <div className="newspaper-front-grid__lead">
            <ArticleCard
              article={frontPage.lead}
              index={0}
              languageCode={selectedLanguage}
              variant="lead"
              label={copy.leadStory}
            />
          </div>

          <div className="newspaper-front-grid__features" aria-label={copy.editorsPicks}>
            <div className="newspaper-column-label">{copy.editorsPicks}</div>
            {frontPage.features.map((article, index) => (
              <ArticleCard
                key={getArticleRenderKey(article, index + 1)}
                article={article}
                index={index + 1}
                languageCode={selectedLanguage}
                variant="feature"
              />
            ))}
          </div>

          <aside className="newspaper-front-grid__rail" aria-label={copy.latestBriefs}>
            <div className="newspaper-column-label">{copy.latestBriefs}</div>
            {frontPage.latest.map((article, index) => (
              <ArticleCard
                key={getArticleRenderKey(article, index + 3)}
                article={article}
                index={index + 3}
                languageCode={selectedLanguage}
                variant="rail"
              />
            ))}
          </aside>
        </div>
      ) : null}

      {orderedCategorySections.map((section) => (
        <section
          key={section.id}
          className="newspaper-more-section"
          id={section.id}
          aria-labelledby={`${section.id}-heading`}
        >
          <div className="newspaper-section-rule">
            <div>
              <h2 id={`${section.id}-heading`}>{copy.categoryLabels[section.id]}</h2>
            </div>
          </div>

          {section.articles.length > 0 ? (
            <div className="newspaper-more-grid">
              {section.articles.map((article, index) => (
                <ArticleCard
                  key={getArticleRenderKey(article, index + 10)}
                  article={article}
                  index={index + 10}
                  languageCode={selectedLanguage}
                  variant="standard"
                />
              ))}
            </div>
          ) : (
            <div className="empty-feed-card mt-5 px-5 py-8 text-center">
              <p className="text-sm font-semibold">{copy.emptyFeed}</p>
            </div>
          )}
        </section>
      ))}

      <section className="newspaper-more-section" aria-labelledby="more-good-news">
        <div className="newspaper-section-rule">
          <div>
            <p>{copy.moreGoodNewsDeck}</p>
            <h2 id="more-good-news">{copy.moreGoodNews}</h2>
          </div>
        </div>

        {frontPage.more.length > 0 ? (
          <div className="newspaper-more-grid">
            {frontPage.more.map((article, index) => (
              <ArticleCard
                key={getArticleRenderKey(article, index + 5)}
                article={article}
                index={index + 5}
                languageCode={selectedLanguage}
                variant="standard"
              />
            ))}
          </div>
        ) : null}

        <div ref={sentinelRef} aria-hidden="true" className="h-8" />

        {isLoading ? <LoadingIndicator label={copy.loadingMore} /> : null}
      </section>

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
    </section>
  );
}
