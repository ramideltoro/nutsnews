import Link from "next/link";
import type { Article } from "@/lib/articles";

const ALL_CATEGORY = "All";

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
  categories?: string[];
  selectedCategory?: string;
  currentPage?: number;
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

function normalizeCategory(category?: string | null) {
  const cleanedCategory = category?.trim();

  if (!cleanedCategory || cleanedCategory.toLowerCase() === "all") {
    return ALL_CATEGORY;
  }

  return cleanedCategory;
}

function buildHomeHref(category: string, page = 0) {
  const params = new URLSearchParams();
  const selectedCategory = normalizeCategory(category);

  if (selectedCategory !== ALL_CATEGORY) {
    params.set("category", selectedCategory);
  }

  if (page > 0) {
    params.set("page", String(page));
  }

  const queryString = params.toString();

  return queryString ? `/?${queryString}` : "/";
}

function CategoryFilter({
  categories,
  selectedCategory,
}: {
  categories: string[];
  selectedCategory: string;
}) {
  const menuCategories = [ALL_CATEGORY, ...categories];

  if (menuCategories.length <= 1) {
    return null;
  }

  return (
    <section className="mb-6">
      <details className="group">
        <summary className="relative flex w-full cursor-pointer list-none items-center justify-between gap-3 rounded-[1.55rem] border border-amber-300/25 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 px-4 py-3 text-left shadow-inner shadow-amber-950/10 transition hover:border-amber-300/50 hover:bg-amber-400/10 [&::-webkit-details-marker]:hidden">
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
            className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/20 bg-amber-400/10 text-amber-200 transition group-open:rotate-180"
          >
            ↓
          </span>
        </summary>

        <div className="mt-3 rounded-[1.55rem] border border-amber-300/20 bg-neutral-950/95 p-2 shadow-2xl shadow-black/60">
          {menuCategories.map((category) => {
            const isActive = category === selectedCategory;

            return (
              <Link
                key={category}
                href={buildHomeHref(category)}
                prefetch={false}
                className={`mb-1 flex w-full items-center justify-between rounded-[1.35rem] border px-3.5 py-3 text-left text-[11px] font-black uppercase tracking-[0.13em] transition last:mb-0 ${
                  isActive
                    ? "border-amber-200/70 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 text-neutral-950 shadow-lg shadow-amber-950/30"
                    : "border-amber-300/15 bg-black/30 text-amber-100 hover:border-amber-300/50 hover:bg-amber-400/10"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span>{category}</span>
                {isActive ? <span aria-hidden="true">✓</span> : null}
              </Link>
            );
          })}
        </div>
      </details>
    </section>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const categoryBadges = getCategoryBadges(article.category);

  return (
    <article className="overflow-hidden rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-neutral-950 via-neutral-950 to-amber-950/20 shadow-2xl shadow-black/50">
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
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.42),_transparent_36%),linear-gradient(135deg,_#171717,_#0a0a0a_58%,_#451a03)]">
            <span className="absolute left-7 top-6 text-5xl text-amber-200/25">
              ✦
            </span>
            <span className="absolute bottom-7 right-8 text-6xl text-amber-300/20">
              ●
            </span>
            <span className="absolute right-12 top-9 text-3xl text-orange-200/25">
              ✧
            </span>

            <div className="relative z-10 rounded-[1.5rem] border border-amber-200/20 bg-black/30 px-5 py-4 text-center shadow-2xl shadow-black/30 backdrop-blur-md">
              <div className="text-4xl">✨</div>
              <p className="mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-100">
                Positive Story
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {categoryBadges.map((category, index) => (
            <Link
              key={`${article.id}-${category}-${index}`}
              href={buildHomeHref(category)}
              prefetch={false}
              className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-gradient-to-r from-amber-400/20 via-yellow-400/10 to-orange-500/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100 shadow-sm shadow-amber-950/30 transition hover:border-amber-300/50 hover:bg-amber-400/20"
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  categoryDotStyles[index % categoryDotStyles.length]
                }`}
              />
              {category}
            </Link>
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

function FeedPagination({
  currentPage,
  nextPage,
  selectedCategory,
}: {
  currentPage: number;
  nextPage: number | null;
  selectedCategory: string;
}) {
  if (currentPage <= 0 && nextPage === null) {
    return null;
  }

  return (
    <nav
      aria-label="Story pages"
      className="mt-7 flex items-center justify-between gap-3 rounded-[1.55rem] border border-amber-300/15 bg-neutral-950/70 p-3 shadow-2xl shadow-black/40"
    >
      {currentPage > 0 ? (
        <Link
          href={buildHomeHref(selectedCategory, currentPage - 1)}
          prefetch={false}
          className="inline-flex flex-1 items-center justify-center rounded-full border border-amber-300/25 bg-black/30 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/10"
        >
          Newer
        </Link>
      ) : (
        <span className="flex-1" />
      )}

      {nextPage !== null ? (
        <Link
          href={buildHomeHref(selectedCategory, nextPage)}
          prefetch={false}
          className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-950 shadow-lg shadow-amber-950/30 transition hover:from-amber-200 hover:to-orange-300"
        >
          Older
        </Link>
      ) : (
        <span className="flex-1 text-center text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
          All caught up
        </span>
      )}
    </nav>
  );
}

export function ArticleFeed({
  initialArticles,
  initialNextPage,
  categories = [],
  selectedCategory = ALL_CATEGORY,
  currentPage = 0,
}: ArticleFeedProps) {
  const normalizedCategory = normalizeCategory(selectedCategory);

  return (
    <>
      <CategoryFilter
        categories={categories}
        selectedCategory={normalizedCategory}
      />

      {initialArticles.length === 0 ? (
        <div className="rounded-[2rem] border border-amber-300/20 bg-neutral-950/80 px-5 py-8 text-center shadow-2xl shadow-black/40">
          <p className="text-sm font-semibold text-amber-100">
            No uplifting stories are available for this category yet. Please
            check back soon.
          </p>
        </div>
      ) : null}

      {initialArticles.length > 0 ? (
        <div className="space-y-6">
          {initialArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : null}

      <FeedPagination
        currentPage={currentPage}
        nextPage={initialNextPage}
        selectedCategory={normalizedCategory}
      />
    </>
  );
}
