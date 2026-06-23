"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Article } from "@/lib/articles";
import { OptimizedArticleImage } from "./OptimizedArticleImage";

const categoryDotStyles = [
  "bg-amber-200 shadow-[0_0_10px_rgba(253,230,138,0.95)]",
  "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.95)]",
  "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.95)]",
  "bg-orange-300 shadow-[0_0_10px_rgba(253,186,116,0.95)]",
  "bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.95)]",
  "bg-yellow-300 shadow-[0_0_10px_rgba(253,224,71,0.95)]",
];

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

function formatSiteDate(dateValue: string | null) {
  if (!dateValue) {
    return "Recently";
  }

  const parsedDate = new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-US", {
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

function LoadingIndicator() {
  return (
    <div className="flex items-center justify-center py-7" aria-live="polite">
      <div className="inline-flex items-center gap-3 rounded-full border border-amber-300/15 bg-neutral-950/70 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-amber-100 shadow-2xl shadow-black/40">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)]" />
        Loading more stories
      </div>
    </div>
  );
}

function ArticleCard({ article, index }: { article: Article; index: number }) {
  const categoryBadges = getCategoryBadges(article.category);
  const cardRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const card = cardRef.current;

    if (!card) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
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
      className={`overflow-hidden rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-neutral-950 via-neutral-950 to-amber-950/20 shadow-2xl shadow-black/50 transition-all duration-700 ease-out will-change-transform motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:blur-0 motion-reduce:transition-none ${
        isVisible
          ? "translate-y-0 opacity-100 blur-0"
          : "translate-y-8 opacity-0 blur-[2px]"
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-900">
        <OptimizedArticleImage src={article.image_url} eager={index === 0} />
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {categoryBadges.map((category, index) => (
            <span
              key={`${article.id}-${category}-${index}`}
              className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-gradient-to-r from-amber-400/20 via-yellow-400/10 to-orange-500/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100 shadow-sm shadow-amber-950/30"
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  categoryDotStyles[index % categoryDotStyles.length]
                }`}
              />
              {category}
            </span>
          ))}
        </div>

        <h2 className="text-2xl font-black leading-tight tracking-[-0.04em] text-amber-50">
          {article.title}
        </h2>

        {article.ai_summary ? (
          <p className="text-[15px] leading-7 text-neutral-300">
            {article.ai_summary}
          </p>
        ) : null}

        <a
          href={article.original_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-neutral-950 shadow-lg shadow-amber-950/30 transition hover:scale-[1.01] hover:from-amber-200 hover:to-orange-300"
        >
          Read full story
        </a>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-300/10 pt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
          <span>{formatSiteDate(article.published_on_site_at)}</span>
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
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMoreArticles = useCallback(async () => {
    if ((nextPage === null && !nextCursor) || isLoading) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const query = new URLSearchParams();

      // Offset pagination is the primary path for the public feed because it
      // works with both the public feed snapshot and the canonical articles
      // table in production. Cursor pagination remains as a fallback for older
      // cached homepage payloads that only contain a cursor.
      if (nextPage !== null) {
        query.set("page", String(nextPage));
      } else if (nextCursor) {
        query.set("cursor", nextCursor);
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
          : "Could not load more stories right now.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, nextCursor, nextPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || (nextPage === null && !nextCursor)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
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
        <div className="rounded-[2rem] border border-amber-300/20 bg-neutral-950/80 px-5 py-8 text-center shadow-2xl shadow-black/40">
          <p className="text-sm font-semibold text-amber-100">
            No uplifting stories are available yet. Please check back soon.
          </p>
        </div>
      ) : null}

      {articles.length > 0 ? (
        <div className="space-y-6">
          {articles.map((article, index) => (
            <ArticleCard key={article.id} article={article} index={index} />
          ))}
        </div>
      ) : null}

      <div ref={sentinelRef} aria-hidden="true" className="h-8" />

      {isLoading ? <LoadingIndicator /> : null}

      {loadError ? (
        <div className="mt-5 rounded-[1.55rem] border border-amber-300/20 bg-neutral-950/80 p-4 text-center shadow-2xl shadow-black/40">
          <p className="text-sm font-semibold text-amber-100">
            Could not load more stories.
          </p>
          <button
            type="button"
            onClick={() => void loadMoreArticles()}
            className="mt-3 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-950 shadow-lg shadow-amber-950/30 transition hover:from-amber-200 hover:to-orange-300"
          >
            Try again
          </button>
        </div>
      ) : null}
    </>
  );
}
