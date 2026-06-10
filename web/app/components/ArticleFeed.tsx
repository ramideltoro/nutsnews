"use client";

import { useEffect, useRef, useState } from "react";

import type { Article } from "@/lib/articles";

type ArticlesResponse = {
  articles: Article[];
  nextPage: number | null;
};

type ArticleFeedProps = {
  initialArticles: Article[];
  initialNextPage: number | null;
  categories: string[];
};

const ALL_CATEGORY = "All";

const categoryDotStyles = [
  "bg-amber-200 shadow-[0_0_10px_rgba(253,230,138,0.95)]",
  "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.95)]",
  "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.95)]",
  "bg-orange-300 shadow-[0_0_10px_rgba(253,186,116,0.95)]",
  "bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.95)]",
  "bg-yellow-300 shadow-[0_0_10px_rgba(253,224,71,0.95)]",
];

function formatSiteDate(dateValue: string | null) {
  if (!dateValue) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateValue));
}

function getCategoryBadges(category: string | null) {
  const fallback = ["Uplifting"];

  if (!category) {
    return fallback;
  }

  const badges = category
    .split(/[|,;/]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return badges.length > 0 ? badges : fallback;
}

function buildArticlesUrl(page: number, category: string) {
  const params = new URLSearchParams({
    page: String(page),
  });

  if (category !== ALL_CATEGORY) {
    params.set("category", category);
  }

  return `/api/articles?${params.toString()}`;
}

export function ArticleFeed({
  initialArticles,
  initialNextPage,
  categories,
}: ArticleFeedProps) {
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [nextPage, setNextPage] = useState<number | null>(initialNextPage);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const menuCategories = [ALL_CATEGORY, ...categories];

  async function fetchArticles(page: number, category: string) {
    const response = await fetch(buildArticlesUrl(page, category));

    if (!response.ok) {
      throw new Error("Failed to load articles");
    }

    return (await response.json()) as ArticlesResponse;
  }

  async function loadArticles() {
    if (isLoading || nextPage === null) {
      return;
    }

    setIsLoading(true);

    try {
      const data = await fetchArticles(nextPage, selectedCategory);

      setArticles((currentArticles) => {
        const existingIds = new Set(
          currentArticles.map((article) => article.id),
        );

        const newArticles = data.articles.filter(
          (article) => !existingIds.has(article.id),
        );

        return [...currentArticles, ...newArticles];
      });

      setNextPage(data.nextPage);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function selectCategory(category: string) {
    setIsCategoryMenuOpen(false);

    if (category === selectedCategory || isLoading) {
      return;
    }

    setSelectedCategory(category);
    setArticles([]);
    setNextPage(null);
    setIsLoading(true);

    try {
      if (category === ALL_CATEGORY) {
        setArticles(initialArticles);
        setNextPage(initialNextPage);
        return;
      }

      const data = await fetchArticles(0, category);

      setArticles(data.articles);
      setNextPage(data.nextPage);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const loader = loaderRef.current;

    if (!loader) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];

        if (firstEntry.isIntersecting && !isLoading && nextPage !== null) {
          loadArticles();
        }
      },
      {
        rootMargin: "300px",
      },
    );

    observer.observe(loader);

    return () => {
      observer.disconnect();
    };
  }, [nextPage, isLoading, selectedCategory]);

  return (
    <>
      <nav
        className="sticky top-3 z-30 mb-5"
        aria-label="Article categories"
      >
        <div className="relative rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950/95 via-neutral-900/95 to-amber-950/25 p-2 shadow-2xl shadow-black/35 ring-1 ring-amber-300/5 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setIsCategoryMenuOpen((isOpen) => !isOpen)}
            className="flex w-full items-center justify-between gap-3 rounded-[1.55rem] border border-amber-300/15 bg-gradient-to-br from-black/35 via-neutral-950/80 to-amber-950/20 px-4 py-3 text-left shadow-inner shadow-amber-950/10 transition hover:border-amber-300/35 hover:bg-amber-400/10"
            aria-expanded={isCategoryMenuOpen}
            aria-controls="category-menu"
          >
            <span className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-amber-300/70">
                Browse stories
              </span>
              <span className="mt-1 flex items-center text-sm font-black uppercase tracking-[0.13em] text-amber-50">
                <span className="mr-2 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.95)]" />
                {selectedCategory}
              </span>
            </span>

            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-300/20 bg-amber-400/10 text-lg font-black text-amber-200 transition ${
                isCategoryMenuOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            >
              ↓
            </span>
          </button>

          {isCategoryMenuOpen ? (
            <div
              id="category-menu"
              className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 max-h-80 overflow-y-auto rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/30 p-2 shadow-2xl shadow-black/60 ring-1 ring-amber-300/10 backdrop-blur-xl"
            >
              {menuCategories.map((category, index) => {
                const isActive = category === selectedCategory;

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => selectCategory(category)}
                    className={`mb-1 flex w-full items-center justify-between rounded-[1.35rem] border px-3.5 py-3 text-left text-[11px] font-black uppercase tracking-[0.13em] transition last:mb-0 ${
                      isActive
                        ? "border-amber-200/70 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 text-neutral-950 shadow-lg shadow-amber-950/30"
                        : "border-amber-300/10 bg-black/25 text-amber-100 hover:border-amber-300/45 hover:bg-amber-400/10"
                    }`}
                    aria-pressed={isActive}
                  >
                    <span className="flex min-w-0 items-center">
                      <span
                        className={`mr-2 h-1.5 w-1.5 rounded-full ${
                          categoryDotStyles[index % categoryDotStyles.length]
                        }`}
                      />
                      <span className="truncate">{category}</span>
                    </span>

                    {isActive ? (
                      <span className="ml-3 shrink-0 text-xs">✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </nav>

      {!isLoading && articles.length === 0 ? (
        <p className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/30 p-5 text-sm leading-6 text-amber-100 shadow-lg shadow-amber-950/20">
          No uplifting stories are available for this category yet. Please
          check back soon.
        </p>
      ) : null}

      {articles.length > 0 ? (
        <section className="space-y-5" aria-label="Latest uplifting stories">
          {articles.map((article) => {
            const categoryBadges = getCategoryBadges(article.category);

            return (
              <article
                key={article.id}
                className="rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/20 ring-1 ring-amber-300/5 transition hover:border-amber-300/35 hover:shadow-amber-900/25"
              >
                <div className="rounded-2xl border border-amber-300/15 bg-gradient-to-br from-black/35 via-neutral-950/80 to-amber-950/25 p-4 shadow-inner shadow-amber-950/10">
                  <h2 className="text-left text-2xl font-black leading-tight text-amber-50">
                    {article.title}
                  </h2>

                  {article.ai_summary ? (
                    <p className="mt-3 text-left text-base leading-7 text-neutral-300">
                      {article.ai_summary}
                    </p>
                  ) : null}
                </div>

                <div className="mt-5">
                  <a
                    href={article.original_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center rounded-full border border-amber-200/50 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-4 py-3 text-sm font-black text-neutral-950 shadow-lg shadow-amber-950/30 transition hover:scale-[1.01] hover:from-amber-200 hover:via-amber-300 hover:to-orange-300"
                  >
                    Read full story
                  </a>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {categoryBadges.map((category, index) => (
                    <button
                      key={`${article.id}-${category}-${index}`}
                      type="button"
                      onClick={() => selectCategory(category)}
                      className="inline-flex items-center rounded-full border border-amber-300/25 bg-gradient-to-r from-amber-400/20 via-yellow-400/10 to-orange-500/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100 shadow-sm shadow-amber-950/30 transition hover:border-amber-300/50 hover:bg-amber-400/20"
                    >
                      <span
                        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                          categoryDotStyles[index % categoryDotStyles.length]
                        }`}
                      />
                      {category}
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between gap-4 border-t border-amber-300/15 pt-4 text-[11px] font-bold text-amber-300/85">
                  <span>{formatSiteDate(article.published_on_site_at)}</span>
                  <span className="min-w-0 truncate text-right">
                    {article.source}
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      <div
        ref={loaderRef}
        className="py-8 text-center text-sm font-semibold text-amber-300/60"
        aria-live="polite"
      >
        {isLoading && "Loading more peaceful stories..."}
        {!isLoading && nextPage !== null && "Scroll for more stories"}
        {!isLoading &&
          nextPage === null &&
          articles.length > 0 &&
          "You’re all caught up"}
      </div>
    </>
  );
}