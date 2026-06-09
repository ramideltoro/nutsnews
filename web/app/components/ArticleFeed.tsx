"use client";

import Link from "next/link";
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
      <p className="rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 text-sm leading-6 text-neutral-300 shadow-lg shadow-black/20">
        No uplifting stories are available yet. Please check back soon.
      </p>
    );
  }

  return (
    <>
      <section className="space-y-5" aria-label="Latest uplifting stories">
        {articles.map((article) => (
          <article
            key={article.id}
            className="rounded-[2rem] border border-white/10 bg-neutral-900/95 p-5 shadow-xl shadow-black/30 transition hover:border-amber-400/30"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
                {article.category ?? "Uplifting"}
              </span>
            </div>

            <h2 className="text-2xl font-black leading-tight text-white">
              <Link
                href={`/articles/${article.id}`}
                className="transition hover:text-amber-300"
              >
                {article.title}
              </Link>
            </h2>

            {article.ai_summary ? (
              <p className="mt-4 border-l border-amber-400/30 pl-4 text-sm leading-7 text-neutral-300">
                {article.ai_summary}
              </p>
            ) : null}

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                    Date
                  </p>
                  <p className="mt-1 text-sm font-semibold text-neutral-300">
                    {formatSiteDate(article.published_on_site_at)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                    Source
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-amber-300">
                    {article.source}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <a
                href={article.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-full bg-amber-400 px-4 py-3 text-sm font-bold text-neutral-950 transition hover:bg-amber-300"
              >
                Read full story
              </a>
            </div>
          </article>
        ))}
      </section>

      <div
        ref={loaderRef}
        className="py-8 text-center text-sm text-neutral-500"
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