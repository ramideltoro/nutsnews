"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Article } from "@/lib/articles";

type ArticlesResponse = {
  articles: Article[];
  nextPage: number | null;
};

type ArticleFeedProps = {
  initialArticles: Article[];
  initialNextPage: number | null;
  categories?: string[];
};

type GeneratedThumbnail = {
  emoji: string;
  label: string;
  gradient: string;
  shapes: string[];
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

const generatedThumbnailThemes: Array<{
  keywords: string[];
  thumbnail: GeneratedThumbnail;
}> = [
  {
    keywords: [
      "science",
      "scientist",
      "research",
      "discovery",
      "study",
      "space",
      "planet",
      "star",
      "moon",
      "nasa",
    ],
    thumbnail: {
      emoji: "",
      label: "Bright Discovery",
      gradient:
          "bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.36),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.28),_transparent_34%),linear-gradient(135deg,_#111827,_#0a0a0a_58%,_#451a03)]",
      shapes: ["✦", "●", "✧"],
    },
  },
  {
    keywords: [
      "health",
      "doctor",
      "hospital",
      "medical",
      "patient",
      "wellness",
      "therapy",
      "care",
      "healing",
    ],
    thumbnail: {
      emoji: "",
      label: "Hopeful Health",
      gradient:
          "bg-[radial-gradient(circle_at_top_right,_rgba(252,211,77,0.42),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.24),_transparent_36%),linear-gradient(135deg,_#0f172a,_#0a0a0a_58%,_#365314)]",
      shapes: ["+", "●", "✦"],
    },
  },
  {
    keywords: [
      "tree",
      "forest",
      "plant",
      "garden",
      "nature",
      "wildlife",
      "animal",
      "dog",
      "cat",
      "bird",
      "ocean",
      "river",
      "earth",
    ],
    thumbnail: {
      emoji: "",
      label: "Nature Win",
      gradient:
          "bg-[radial-gradient(circle_at_top_right,_rgba(132,204,22,0.34),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(245,158,11,0.26),_transparent_36%),linear-gradient(135deg,_#052e16,_#0a0a0a_58%,_#451a03)]",
      shapes: ["✿", "●", "◇"],
    },
  },
  {
    keywords: [
      "community",
      "volunteer",
      "neighbors",
      "school",
      "students",
      "teacher",
      "family",
      "village",
      "town",
      "city",
      "help",
      "kindness",
    ],
    thumbnail: {
      emoji: "",
      label: "Community Joy",
      gradient:
          "bg-[radial-gradient(circle_at_top_right,_rgba(251,146,60,0.38),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(252,211,77,0.28),_transparent_36%),linear-gradient(135deg,_#171717,_#0a0a0a_58%,_#7c2d12)]",
      shapes: ["●", "✦", "●"],
    },
  },
  {
    keywords: [
      "art",
      "music",
      "artist",
      "song",
      "museum",
      "dance",
      "film",
      "book",
      "library",
      "creative",
      "design",
    ],
    thumbnail: {
      emoji: "",
      label: "Creative Spark",
      gradient:
          "bg-[radial-gradient(circle_at_top_right,_rgba(253,224,71,0.38),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(236,72,153,0.22),_transparent_36%),linear-gradient(135deg,_#18181b,_#0a0a0a_58%,_#713f12)]",
      shapes: ["✺", "●", "✦"],
    },
  },
  {
    keywords: [
      "sport",
      "athlete",
      "team",
      "game",
      "race",
      "marathon",
      "soccer",
      "football",
      "basketball",
      "baseball",
      "tennis",
    ],
    thumbnail: {
      emoji: "",
      label: "Winning Moment",
      gradient:
          "bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.44),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(249,115,22,0.25),_transparent_36%),linear-gradient(135deg,_#111827,_#0a0a0a_58%,_#78350f)]",
      shapes: ["★", "●", "✦"],
    },
  },
  {
    keywords: [
      "food",
      "chef",
      "restaurant",
      "farm",
      "meal",
      "recipe",
      "bakery",
      "coffee",
      "chocolate",
    ],
    thumbnail: {
      emoji: "",
      label: "Sweet Story",
      gradient:
          "bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.42),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(217,119,6,0.26),_transparent_36%),linear-gradient(135deg,_#1c1917,_#0a0a0a_58%,_#451a03)]",
      shapes: ["●", "✦", "◇"],
    },
  },
];

const defaultGeneratedThumbnail: GeneratedThumbnail = {
  emoji: "✨",
  label: "Positive Story",
  gradient:
      "bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.42),_transparent_36%),linear-gradient(135deg,_#171717,_#0a0a0a_58%,_#451a03)]",
  shapes: ["✦", "●", "✧"],
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

function buildArticlesUrl(page: number, category: string) {
  const params = new URLSearchParams({
    page: String(page),
  });

  if (category !== ALL_CATEGORY) {
    params.set("category", category);
  }

  return `/api/articles?${params.toString()}`;
}

function getGeneratedThumbnail(article: Article): GeneratedThumbnail {
  const searchableText = [
    article.title,
    article.ai_summary,
    article.category,
    article.source,
  ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  const matchedTheme = generatedThumbnailThemes.find((theme) =>
      theme.keywords.some((keyword) => searchableText.includes(keyword)),
  );

  return matchedTheme?.thumbnail ?? defaultGeneratedThumbnail;
}

export function ArticleFeed({
                              initialArticles,
                              initialNextPage,
                              categories = [],
                            }: ArticleFeedProps) {
  const [articles, setArticles] = useState(initialArticles);
  const [nextPage, setNextPage] = useState(initialNextPage);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  const loaderRef = useRef<HTMLDivElement | null>(null);
  const menuCategories = [ALL_CATEGORY, ...categories];

  const fetchArticles = useCallback(async (page: number, category: string) => {
    const response = await fetch(buildArticlesUrl(page, category));

    if (!response.ok) {
      throw new Error("Failed to load articles");
    }

    return (await response.json()) as ArticlesResponse;
  }, []);

  const loadArticles = useCallback(async () => {
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
  }, [fetchArticles, isLoading, nextPage, selectedCategory]);

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
  }, [loadArticles, nextPage, isLoading]);

  return (
      <>
        {menuCategories.length > 1 ? (
            <section className="mb-6">
              <button
                  type="button"
                  onClick={() => setIsCategoryMenuOpen((isOpen) => !isOpen)}
                  className="relative flex w-full items-center justify-between gap-3 rounded-[1.55rem] border border-amber-300/25 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 px-4 py-3 text-left shadow-inner shadow-amber-950/10 transition hover:border-amber-300/50 hover:bg-amber-400/10"
                  aria-expanded={isCategoryMenuOpen}
                  aria-controls="category-menu"
              >
            <span>
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/80">
                Click to Filter
              </span>
              <span className="mt-1 block text-sm font-black uppercase tracking-[0.08em] text-amber-50">
                {selectedCategory}
              </span>
            </span>

                <span
                    aria-hidden="true"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/20 bg-amber-400/10 text-amber-200"
                >
              ↓
            </span>
              </button>

              {isCategoryMenuOpen ? (
                  <div
                      id="category-menu"
                      className="mt-3 rounded-[1.55rem] border border-amber-300/20 bg-neutral-950/95 p-2 shadow-2xl shadow-black/60"
                  >
                    {menuCategories.map((category) => {
                      const isActive = category === selectedCategory;

                      return (
                          <button
                              key={category}
                              type="button"
                              onClick={() => selectCategory(category)}
                              className={`mb-1 flex w-full items-center justify-between rounded-[1.35rem] border px-3.5 py-3 text-left text-[11px] font-black uppercase tracking-[0.13em] transition last:mb-0 ${
                                  isActive
                                      ? "border-amber-200/70 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 text-neutral-950 shadow-lg shadow-amber-950/30"
                                      : "border-amber-300/15 bg-black/30 text-amber-100 hover:border-amber-300/50 hover:bg-amber-400/10"
                              }`}
                              aria-pressed={isActive}
                          >
                            <span>{category}</span>
                            {isActive ? <span aria-hidden="true">✓</span> : null}
                          </button>
                      );
                    })}
                  </div>
              ) : null}
            </section>
        ) : null}

        {!isLoading && articles.length === 0 ? (
            <div className="rounded-[2rem] border border-amber-300/20 bg-neutral-950/80 px-5 py-8 text-center shadow-2xl shadow-black/40">
              <p className="text-sm font-semibold text-amber-100">
                No uplifting stories are available for this category yet. Please
                check back soon.
              </p>
            </div>
        ) : null}

        {articles.length > 0 ? (
            <div className="space-y-6">
              {articles.map((article) => {
                const categoryBadges = getCategoryBadges(article.category);
                const generatedThumbnail = getGeneratedThumbnail(article);

                return (
                    <article
                        key={article.id}
                        className="overflow-hidden rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-neutral-950 via-neutral-950 to-amber-950/20 shadow-2xl shadow-black/50"
                    >
                      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-900">
                        {article.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={article.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <div
                                className={`relative flex h-full w-full items-center justify-center overflow-hidden ${generatedThumbnail.gradient}`}
                            >
                      <span className="absolute left-7 top-6 text-5xl text-amber-200/25">
                        {generatedThumbnail.shapes[0]}
                      </span>
                              <span className="absolute bottom-7 right-8 text-6xl text-amber-300/20">
                        {generatedThumbnail.shapes[1]}
                      </span>
                              <span className="absolute right-12 top-9 text-3xl text-orange-200/25">
                        {generatedThumbnail.shapes[2]}
                      </span>

                              <div className="relative z-10 rounded-[1.5rem] border border-amber-200/20 bg-black/30 px-5 py-4 text-center shadow-2xl shadow-black/30 backdrop-blur-md">
                                <div className="text-4xl">
                                  {generatedThumbnail.emoji}
                                </div>
                                <p className="mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-100">
                                  {generatedThumbnail.label}
                                </p>
                              </div>
                            </div>
                        )}
                      </div>

                      <div className="space-y-4 p-5">
                        <div className="flex flex-wrap gap-2">
                          {categoryBadges.map((category, index) => (
                              <button
                                  key={`${article.id}-${category}-${index}`}
                                  type="button"
                                  onClick={() => selectCategory(category)}
                                  className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-gradient-to-r from-amber-400/20 via-yellow-400/10 to-orange-500/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100 shadow-sm shadow-amber-950/30 transition hover:border-amber-300/50 hover:bg-amber-400/20"
                              >
                        <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 rounded-full ${
                                categoryDotStyles[index % categoryDotStyles.length]
                            }`}
                        />
                                {category}
                              </button>
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
              })}
            </div>
        ) : null}

        <div
            ref={loaderRef}
            className="py-8 text-center text-xs font-black uppercase tracking-[0.18em] text-amber-400/70"
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