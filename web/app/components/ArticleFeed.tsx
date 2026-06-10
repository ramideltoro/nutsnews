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
};

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

export function ArticleFeed({
  initialArticles,
  initialNextPage,
}: ArticleFeedProps) {
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [nextPage, setNextPage] = useState<number | null>(initialNextPage);
  const [isLoading, setIsLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  async function loadArticles() {
    if (isLoading || nextPage === null) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/articles?page=${nextPage}`);

      if (!response.ok) {
        throw new Error("Failed to load articles");
      }

      const data = (await response.json()) as ArticlesResponse;

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
  }, [nextPage, isLoading]);

  if (!isLoading && articles.length === 0) {
    return (
      <p className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/30 p-5 text-sm leading-6 text-amber-100 shadow-lg shadow-amber-950/20">
        No uplifting stories are available yet. Please check back soon.
      </p>
    );
  }

  return (
    <>
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
                  <span
                    key={`${article.id}-${category}-${index}`}
                    className="inline-flex items-center rounded-full border border-amber-300/25 bg-gradient-to-r from-amber-400/20 via-yellow-400/10 to-orange-500/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100 shadow-sm shadow-amber-950/30"
                  >
                    <span
                      className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                        categoryDotStyles[index % categoryDotStyles.length]
                      }`}
                    />
                    {category}
                  </span>
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