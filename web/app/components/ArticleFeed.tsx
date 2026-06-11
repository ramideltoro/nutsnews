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
      emoji: "🔭",
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
      emoji: "💛",
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
      emoji: "🌿",
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
      emoji: "🤝",
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
      emoji: "🎨",
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
      emoji: "🏆",
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
      emoji: "🍯",
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

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateValue));
}

function formatSourceLabel(source: string | null) {
  if (!source) {
    return "NutsNews";
  }

  return source
    .replace(/^Google\s+News\s*-\s*/i, "")
    .replace(/^Google\s*-\s*/i, "")
    .trim();
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
        className="sticky top-0 z-50 -mx-1 mb-5 pt-2"
        aria-label="Article categories"
      >
        <div className="relative rounded-[2rem] border border-amber-300/30 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.26),_transparent_55%),linear-gradient(135deg,_rgba(23,23,23,0.98),_rgba(10,10,10,0.98)_58%,_rgba(69,26,3,0.75))] p-2 shadow-[0_0_34px_rgba(245,158,11,0.22),0_22px_55px_rgba(0,0,0,0.55)] ring-1 ring-amber-300/20 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 rounded-[2rem] border border-amber-200/10" />
          <div className="pointer-events-none absolute -inset-1 -z-10 rounded-[2.2rem] bg-amber-400/12 blur-xl" />

          <button
            type="button"
            onClick={() => setIsCategoryMenuOpen((isOpen) => !isOpen)}
            className="relative flex w-full items-center justify-between gap-3 rounded-[1.55rem] border border-amber-300/25 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 px-4 py-3 text-left shadow-inner shadow-amber-950/10 transition hover:border-amber-300/50 hover:bg-amber-400/10"
            aria-expanded={isCategoryMenuOpen}
            aria-controls="category-menu"
          >
            <span className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">
                Click to Filter
              </span>
              <span className="mt-1 flex items-center text-sm font-black uppercase tracking-[0.13em] text-amber-50">
                <span className="mr-2 h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,1)]" />
                {selectedCategory}
              </span>
            </span>

            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-200/45 bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400 text-xl font-black text-neutral-950 shadow-lg shadow-amber-950/35 transition ${
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
              className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-50 max-h-80 overflow-y-auto rounded-[2rem] border border-amber-300/30 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.22),_transparent_52%),linear-gradient(135deg,_#0a0a0a,_#171717_55%,_#451a03)] p-2 shadow-[0_0_36px_rgba(245,158,11,0.24),0_28px_70px_rgba(0,0,0,0.65)] ring-1 ring-amber-300/20 backdrop-blur-2xl"
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
                        : "border-amber-300/15 bg-black/30 text-amber-100 hover:border-amber-300/50 hover:bg-amber-400/10"
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
            const generatedThumbnail = getGeneratedThumbnail(article);

            return (
              <article
                key={article.id}
                className="overflow-hidden rounded-[2rem] border border-amber-300/15 bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/20 p-5 shadow-xl shadow-amber-950/20 ring-1 ring-amber-300/5 transition hover:border-amber-300/35 hover:shadow-amber-900/25"
              >
                <div className="mb-4 overflow-hidden rounded-[1.6rem] border border-amber-300/15 bg-black/30 shadow-inner shadow-amber-950/10">
                  {article.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={article.image_url}
                      alt=""
                      className="h-52 w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className={`relative flex h-52 w-full items-center justify-center overflow-hidden ${generatedThumbnail.gradient}`}
                      aria-label={`Generated thumbnail for ${article.title}`}
                    >
                      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-amber-400/25 blur-3xl" />
                      <div className="pointer-events-none absolute -bottom-16 -left-14 h-44 w-44 rounded-full bg-orange-500/20 blur-3xl" />
                      <div className="pointer-events-none absolute left-5 top-5 text-4xl font-black text-amber-200/25">
                        {generatedThumbnail.shapes[0]}
                      </div>
                      <div className="pointer-events-none absolute bottom-6 right-8 text-6xl font-black text-white/10">
                        {generatedThumbnail.shapes[1]}
                      </div>
                      <div className="pointer-events-none absolute right-16 top-8 text-3xl font-black text-orange-200/25">
                        {generatedThumbnail.shapes[2]}
                      </div>

                      <div className="relative z-10 px-5 text-center">
                        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-[1.5rem] border border-amber-300/25 bg-black/25 text-6xl shadow-lg shadow-black/30">
                          {generatedThumbnail.emoji}
                        </div>

                        <p className="text-sm font-black uppercase tracking-[0.24em] text-amber-200">
                          {generatedThumbnail.label}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

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
                    {formatSourceLabel(article.source)}
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