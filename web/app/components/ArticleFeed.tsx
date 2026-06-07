"use client";

import { useEffect, useRef, useState } from "react";

type Article = {
  id: string;
  source: string;
  title: string;
  original_url: string;
  image_url: string | null;
  published_at: string | null;
  published_on_site_at: string | null;
  ai_summary: string | null;
  category: string | null;
  positivity_score: number | null;
};

type ArticlesResponse = {
  articles: Article[];
  nextPage: number | null;
};

function formatSiteDate(dateValue: string | null) {
  if (!dateValue) {
    return "Published recently";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateValue));
}

export function ArticleFeed() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(0);
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
        const existingIds = new Set(currentArticles.map((article) => article.id));

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
    loadArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextPage, isLoading]);

  if (!isLoading && articles.length === 0) {
    return (
      <div className="rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 text-neutral-300">
        No uplifting stories are available yet. Please check back soon.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        {articles.map((article) => (
          <article
            key={article.id}
            className="rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/20">
                {article.category ?? "Uplifting"}
              </span>

                <span className="text-xs font-medium text-neutral-400">
                {article.source} • {formatSiteDate(article.published_on_site_at)}
                </span>
            </div>

            <h2 className="text-xl font-semibold leading-snug text-amber-50">
              {article.title}
            </h2>

            <p className="mt-3 text-sm leading-6 text-neutral-300">
              {article.ai_summary}
            </p>

            <a
              href={article.original_url}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 shadow-sm hover:bg-amber-400"
            >
              Read full story
            </a>
          </article>
        ))}
      </div>

      <div ref={loaderRef} className="py-8 text-center text-sm text-neutral-500">
        {isLoading && "Loading more peaceful stories..."}
        {!isLoading && nextPage !== null && "Scroll for more stories"}
        {!isLoading && nextPage === null && articles.length > 0 && "You’re all caught up"}
      </div>
    </>
  );
}