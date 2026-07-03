import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { formatAdminDateTime } from "@/lib/adminTime";

const REVIEW_SELECT_COLUMNS = [
  "id",
  "reviewed_at",
  "original_url",
  "source",
  "title",
  "decision",
  "category",
  "positivity_score",
  "summary",
  "reason",
  "ai_provider",
  "ai_model",
  "review_duration_ms",
].join(",");

const PUBLISHED_ARTICLE_SELECT_COLUMNS = [
  "id",
  "original_url",
  "source",
  "title",
  "image_url",
  "published_at",
  "published_on_site_at",
  "created_at",
  "ai_summary",
  "category",
  "positivity_score",
  "status",
].join(",");

export const ARTICLE_REVIEW_PAGE_SIZE = 50;
export const RECENT_PUBLISHED_ARTICLE_LIMIT = 10;
const MAX_OPTION_ROWS = 5000;

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

export type ArticleReviewDecision = "accept" | "reject";
export type ArticleReviewDecisionFilter = "all" | ArticleReviewDecision;
export type ArticleReviewSort = "newest" | "oldest";

type SearchParamValue = string | string[] | undefined;
export type ArticleReviewSearchParams = Record<string, SearchParamValue>;

export type ArticleReviewFilters = {
  decision: ArticleReviewDecisionFilter;
  source: string;
  category: string;
  minScore: number | null;
  maxScore: number | null;
  page: number;
  sort: ArticleReviewSort;
};

type ArticleReviewDbRow = {
  id: number;
  reviewed_at: string;
  original_url: string;
  source: string;
  title: string;
  decision: ArticleReviewDecision;
  category: string;
  positivity_score: number | string | null;
  summary: string | null;
  reason: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  review_duration_ms: number | string | null;
};

type PublishedArticleDbRow = {
  id: string;
  original_url: string;
  source: string;
  title: string;
  image_url: string | null;
  published_at: string | null;
  published_on_site_at: string | null;
  created_at: string | null;
  ai_summary: string | null;
  category: string | null;
  positivity_score: number | string | null;
  status: string | null;
};

type ArticleReviewOptionRow = {
  source: string | null;
  category: string | null;
};

export type ArticleReviewPublishedArticle = {
  id: string;
  imageUrl: string | null;
  publishedAt: string | null;
  publishedOnSiteAt: string | null;
  status: string | null;
};

export type AdminRecentPublishedArticle = {
  id: string;
  originalUrl: string;
  source: string;
  title: string;
  imageUrl: string | null;
  publishedAt: string | null;
  publishedOnSiteAt: string | null;
  createdAt: string | null;
  category: string;
  positivityScore: number;
  status: string;
  hasReview: boolean;
  reviewId: number | null;
  reviewedAt: string | null;
  reviewedAtLabel: string;
};

export type ArticleReviewRow = {
  id: number;
  createdAt: string;
  reviewedAt: string;
  reviewedAtLabel: string;
  originalUrl: string;
  source: string;
  title: string;
  decision: ArticleReviewDecision;
  decisionLabel: string;
  category: string;
  positivityScore: number;
  summary: string;
  reason: string;
  aiProvider: string;
  aiProviderLabel: string;
  aiModel: string;
  reviewDurationMs: number;
  isPublished: boolean;
  publishedArticle: ArticleReviewPublishedArticle | null;
};

export type ArticleReviewSummary = {
  totalMatchingReviews: number;
  visibleReviews: number;
  acceptedVisibleReviews: number;
  rejectedVisibleReviews: number;
  averageVisibleScore: number;
  publishedVisibleReviews: number;
  page: number;
  pageSize: number;
  sortLabel: string;
};

export type ArticleReviewDashboardData = {
  isConfigured: boolean;
  errorMessage: string | null;
  generatedAt: string;
  filters: ArticleReviewFilters;
  summary: ArticleReviewSummary;
  reviews: ArticleReviewRow[];
  recentPublishedArticles: AdminRecentPublishedArticle[];
  sourceOptions: string[];
  categoryOptions: string[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  previousPageHref: string;
  nextPageHref: string;
  reviewSql: string;
  recentPublishedArticlesSql: string;
};

function getSupabaseConfig(): SupabaseConfig | null {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceRoleKey) {
    return null;
  }

  return {
    url,
    serviceRoleKey,
  };
}

function getSingleSearchParam(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parseIntegerParam(value: string, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseScoreParam(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(10, Math.floor(parsed)));
}

function normalizeDecision(value: string): ArticleReviewDecisionFilter {
  return value === "accept" || value === "reject" ? value : "all";
}

function normalizeSort(value: string): ArticleReviewSort {
  return value === "oldest" ? "oldest" : "newest";
}

export function parseArticleReviewFilters(
  searchParams: ArticleReviewSearchParams = {},
): ArticleReviewFilters {
  const decision = normalizeDecision(
    getSingleSearchParam(searchParams.decision),
  );
  const source = getSingleSearchParam(searchParams.source).trim();
  const category = getSingleSearchParam(searchParams.category).trim();
  const minScore = parseScoreParam(getSingleSearchParam(searchParams.minScore));
  const maxScore = parseScoreParam(getSingleSearchParam(searchParams.maxScore));
  const page = Math.max(
    0,
    parseIntegerParam(getSingleSearchParam(searchParams.page), 0),
  );
  const sort = normalizeSort(getSingleSearchParam(searchParams.sort));

  return {
    decision,
    source,
    category,
    minScore,
    maxScore,
    page,
    sort,
  };
}

function emptySummary(filters: ArticleReviewFilters): ArticleReviewSummary {
  return {
    totalMatchingReviews: 0,
    visibleReviews: 0,
    acceptedVisibleReviews: 0,
    rejectedVisibleReviews: 0,
    averageVisibleScore: 0,
    publishedVisibleReviews: 0,
    page: filters.page,
    pageSize: ARTICLE_REVIEW_PAGE_SIZE,
    sortLabel:
      filters.sort === "oldest"
        ? "Oldest reviewed first"
        : "Newest reviewed first",
  };
}

function buildHref(filters: ArticleReviewFilters, page: number) {
  const params = new URLSearchParams();

  if (filters.decision !== "all") {
    params.set("decision", filters.decision);
  }

  if (filters.source) {
    params.set("source", filters.source);
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.minScore !== null) {
    params.set("minScore", String(filters.minScore));
  }

  if (filters.maxScore !== null) {
    params.set("maxScore", String(filters.maxScore));
  }

  if (filters.sort !== "newest") {
    params.set("sort", filters.sort);
  }

  if (page > 0) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return query ? `/admin/articles?${query}` : "/admin/articles";
}

function emptyDashboardData(
  filters: ArticleReviewFilters,
  errorMessage: string | null = null,
): ArticleReviewDashboardData {
  return {
    isConfigured: !errorMessage,
    errorMessage,
    generatedAt: new Date().toISOString(),
    filters,
    summary: emptySummary(filters),
    reviews: [],
    recentPublishedArticles: [],
    sourceOptions: [],
    categoryOptions: [],
    hasPreviousPage: filters.page > 0,
    hasNextPage: false,
    previousPageHref: buildHref(filters, Math.max(0, filters.page - 1)),
    nextPageHref: buildHref(filters, filters.page + 1),
    reviewSql: buildReviewSql(filters),
    recentPublishedArticlesSql: buildRecentPublishedArticlesSql(),
  };
}

function toNumber(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function cleanOption(value: string | null | undefined) {
  return value?.trim() || "";
}

function sortOptionValues(values: Iterable<string>) {
  return Array.from(values)
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function buildReviewSql(filters: ArticleReviewFilters) {
  const conditions = ["1 = 1"];

  if (filters.decision !== "all") {
    conditions.push(`decision = '${filters.decision}'`);
  }

  if (filters.source) {
    conditions.push(`source = '${filters.source.replaceAll("'", "''")}'`);
  }

  if (filters.category) {
    conditions.push(
      `category ilike '%${filters.category.replaceAll("'", "''")}%'`,
    );
  }

  if (filters.minScore !== null) {
    conditions.push(`positivity_score >= ${filters.minScore}`);
  }

  if (filters.maxScore !== null) {
    conditions.push(`positivity_score <= ${filters.maxScore}`);
  }

  return `select\n  reviewed_at,\n  decision,\n  source,\n  category,\n  positivity_score,\n  ai_provider,\n  ai_model,\n  review_duration_ms,\n  title,\n  reason,\n  original_url\nfrom public.article_ai_reviews\nwhere ${conditions.join("\n  and ")}\norder by reviewed_at ${filters.sort === "oldest" ? "asc" : "desc"}\nlimit ${ARTICLE_REVIEW_PAGE_SIZE};`;
}

function buildRecentPublishedArticlesSql() {
  return `select\n  id,\n  original_url,\n  source,\n  title,\n  image_url,\n  published_at,\n  published_on_site_at,\n  created_at,\n  ai_summary,\n  category,\n  positivity_score,\n  status\nfrom public.articles\nwhere status = 'published'\norder by\n  published_on_site_at desc nulls last,\n  published_at desc nulls last,\n  id desc\nlimit ${RECENT_PUBLISHED_ARTICLE_LIMIT};`;
}

async function loadOptions(client: SupabaseClient) {
  const { data, error } = await client
    .from("article_ai_reviews")
    .select("source, category")
    .order("reviewed_at", { ascending: false })
    .limit(MAX_OPTION_ROWS);

  if (error) {
    return {
      sourceOptions: [],
      categoryOptions: [],
    };
  }

  const rows = (data ?? []) as ArticleReviewOptionRow[];
  const sources = new Set<string>();
  const categories = new Set<string>();

  for (const row of rows) {
    const source = cleanOption(row.source);
    const category = cleanOption(row.category);

    if (source) {
      sources.add(source);
    }

    if (category) {
      category
        .split(/[|,;/]+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((value) => categories.add(value));
    }
  }

  return {
    sourceOptions: sortOptionValues(sources),
    categoryOptions: sortOptionValues(categories),
  };
}

function formatProviderLabel(provider: string) {
  if (provider === "local") {
    return "Local AI";
  }

  if (provider === "prefilter") {
    return "Local Rule";
  }

  if (provider === "no_thumbnail") {
    return "No Image Rule";
  }

  return "OpenAI";
}

function mapReviewRow(
  row: ArticleReviewDbRow,
  publishedByOriginalUrl: Map<string, PublishedArticleDbRow>,
): ArticleReviewRow {
  const publishedArticle = publishedByOriginalUrl.get(row.original_url) ?? null;
  const aiProvider = row.ai_provider || "openai";

  return {
    id: row.id,
    createdAt: row.reviewed_at,
    reviewedAt: row.reviewed_at,
    reviewedAtLabel: formatAdminDateTime(row.reviewed_at, "Unknown"),
    originalUrl: row.original_url,
    source: row.source,
    title: row.title,
    decision: row.decision,
    decisionLabel: row.decision === "accept" ? "Accepted" : "Rejected",
    category: row.category || "Uncategorized",
    positivityScore: toNumber(row.positivity_score),
    summary: row.summary || "No summary saved.",
    reason: row.reason || "No review reason saved.",
    aiProvider,
    aiProviderLabel: formatProviderLabel(aiProvider),
    aiModel: row.ai_model || "gpt-4o-mini",
    reviewDurationMs: toNumber(row.review_duration_ms),
    isPublished: Boolean(publishedArticle?.id),
    publishedArticle: publishedArticle
      ? {
          id: publishedArticle.id,
          imageUrl: publishedArticle.image_url,
          publishedAt: publishedArticle.published_at,
          publishedOnSiteAt: publishedArticle.published_on_site_at,
          status: publishedArticle.status,
        }
      : null,
  };
}

function mapRecentPublishedArticle(
  article: PublishedArticleDbRow,
  reviewByOriginalUrl: Map<string, ArticleReviewDbRow>,
): AdminRecentPublishedArticle {
  const review = reviewByOriginalUrl.get(article.original_url) ?? null;

  return {
    id: article.id,
    originalUrl: article.original_url,
    source: article.source,
    title: article.title,
    imageUrl: article.image_url,
    publishedAt: article.published_at,
    publishedOnSiteAt: article.published_on_site_at,
    createdAt: article.created_at,
    category: article.category || "Uncategorized",
    positivityScore: toNumber(article.positivity_score),
    status: article.status || "unknown",
    hasReview: Boolean(review?.id),
    reviewId: review?.id ?? null,
    reviewedAt: review?.reviewed_at ?? null,
    reviewedAtLabel: formatAdminDateTime(
      review?.reviewed_at ?? null,
      "No review row",
    ),
  };
}

async function loadRecentPublishedArticles(client: SupabaseClient) {
  const { data, error } = await client
    .from("articles")
    .select(PUBLISHED_ARTICLE_SELECT_COLUMNS)
    .eq("status", "published")
    .order("published_on_site_at", { ascending: false, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(RECENT_PUBLISHED_ARTICLE_LIMIT);

  if (error) {
    return [];
  }

  const articleRows = (data ?? []) as unknown as PublishedArticleDbRow[];
  const originalUrls = Array.from(
    new Set(articleRows.map((row) => row.original_url).filter(Boolean)),
  );
  const reviewByOriginalUrl = new Map<string, ArticleReviewDbRow>();

  if (originalUrls.length > 0) {
    const { data: reviewData } = await client
      .from("article_ai_reviews")
      .select(REVIEW_SELECT_COLUMNS)
      .in("original_url", originalUrls);

    for (const review of (reviewData ??
      []) as unknown as ArticleReviewDbRow[]) {
      reviewByOriginalUrl.set(review.original_url, review);
    }
  }

  return articleRows.map((article) =>
    mapRecentPublishedArticle(article, reviewByOriginalUrl),
  );
}

function summarizeVisibleReviews(
  filters: ArticleReviewFilters,
  reviews: ArticleReviewRow[],
  totalMatchingReviews: number,
): ArticleReviewSummary {
  const acceptedVisibleReviews = reviews.filter(
    (review) => review.decision === "accept",
  ).length;
  const rejectedVisibleReviews = reviews.filter(
    (review) => review.decision === "reject",
  ).length;
  const publishedVisibleReviews = reviews.filter(
    (review) => review.isPublished,
  ).length;
  const averageVisibleScore = reviews.length
    ? reviews.reduce((total, review) => total + review.positivityScore, 0) /
      reviews.length
    : 0;

  return {
    totalMatchingReviews,
    visibleReviews: reviews.length,
    acceptedVisibleReviews,
    rejectedVisibleReviews,
    averageVisibleScore,
    publishedVisibleReviews,
    page: filters.page,
    pageSize: ARTICLE_REVIEW_PAGE_SIZE,
    sortLabel:
      filters.sort === "oldest"
        ? "Oldest reviewed first"
        : "Newest reviewed first",
  };
}

export async function getAdminArticleReviewDashboardData(
  filters: ArticleReviewFilters,
): Promise<ArticleReviewDashboardData> {
  const config = getSupabaseConfig();

  if (!config) {
    return emptyDashboardData(
      filters,
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }

  const client = createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const [{ sourceOptions, categoryOptions }, recentPublishedArticles] =
    await Promise.all([
      loadOptions(client),
      loadRecentPublishedArticles(client),
    ]);

  const from = filters.page * ARTICLE_REVIEW_PAGE_SIZE;
  const to = from + ARTICLE_REVIEW_PAGE_SIZE - 1;

  let reviewQuery = client
    .from("article_ai_reviews")
    .select(REVIEW_SELECT_COLUMNS, { count: "exact" });

  if (filters.decision !== "all") {
    reviewQuery = reviewQuery.eq("decision", filters.decision);
  }

  if (filters.source) {
    reviewQuery = reviewQuery.eq("source", filters.source);
  }

  if (filters.category) {
    reviewQuery = reviewQuery.ilike("category", `%${filters.category}%`);
  }

  if (filters.minScore !== null) {
    reviewQuery = reviewQuery.gte("positivity_score", filters.minScore);
  }

  if (filters.maxScore !== null) {
    reviewQuery = reviewQuery.lte("positivity_score", filters.maxScore);
  }

  const { data, error, count } = await reviewQuery
    .order("reviewed_at", { ascending: filters.sort === "oldest" })
    .order("id", { ascending: filters.sort === "oldest" })
    .range(from, to);

  if (error) {
    return {
      ...emptyDashboardData(filters, error.message),
      sourceOptions,
      categoryOptions,
      recentPublishedArticles,
    };
  }

  const reviewRows = (data ?? []) as unknown as ArticleReviewDbRow[];
  const originalUrls = Array.from(
    new Set(reviewRows.map((row) => row.original_url).filter(Boolean)),
  );
  const publishedByOriginalUrl = new Map<string, PublishedArticleDbRow>();

  if (originalUrls.length > 0) {
    const { data: articleData } = await client
      .from("articles")
      .select(PUBLISHED_ARTICLE_SELECT_COLUMNS)
      .in("original_url", originalUrls);

    for (const article of (articleData ??
      []) as unknown as PublishedArticleDbRow[]) {
      publishedByOriginalUrl.set(article.original_url, article);
    }
  }

  const reviews = reviewRows.map((row) =>
    mapReviewRow(row, publishedByOriginalUrl),
  );
  const totalMatchingReviews = count ?? reviews.length;

  return {
    isConfigured: true,
    errorMessage: null,
    generatedAt: new Date().toISOString(),
    filters,
    summary: summarizeVisibleReviews(filters, reviews, totalMatchingReviews),
    reviews,
    recentPublishedArticles,
    sourceOptions,
    categoryOptions,
    hasPreviousPage: filters.page > 0,
    hasNextPage: to + 1 < totalMatchingReviews,
    previousPageHref: buildHref(filters, Math.max(0, filters.page - 1)),
    nextPageHref: buildHref(filters, filters.page + 1),
    reviewSql: buildReviewSql(filters),
    recentPublishedArticlesSql: buildRecentPublishedArticlesSql(),
  };
}
