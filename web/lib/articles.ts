import { cache } from "react";
import { unstable_cache } from "next/cache";
import {
  dedupeArticlesByIdentity,
  getArticleIdentityKey,
} from "@/lib/articleIdentity";
import { getSupabase } from "@/lib/supabase";
import { validateTranslatedSummary } from "@/lib/translationQuality";
import {
  DEFAULT_LANGUAGE_CODE,
  type LanguageCode,
  normalizeLanguageCode,
} from "@/lib/languages";
import {
  ARTICLE_SITEMAP_PAGE_SIZE,
  ROOT_SITEMAP_RECENT_ARTICLE_LIMIT,
  getArticleSitemapRange,
} from "@/lib/sitemapConfig";

export const PAGE_SIZE = 5;
export const CURSOR_PAGE_SIZE = 15;
export const SEARCH_PAGE_SIZE = 20;
export const CATEGORY_SECTION_SIZE = 8;
export const HOME_FEED_SNAPSHOT_SCAN_LIMIT = 250;

export const HOME_FEED_SECTIONS = [
  { id: "community", query: "community" },
  { id: "animals", query: "animals" },
  { id: "science", query: "science" },
  { id: "wellness", query: "wellness" },
  { id: "travel", query: "travel" },
  { id: "culture", query: "culture" },
  { id: "achievements", query: "achievement" },
] as const;
export const SITE_URL = "https://www.nutsnews.com";
export const PUBLIC_FEED_SNAPSHOT_TABLE = "public_feed_snapshot";

export type Article = {
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
  language_code?: LanguageCode;
  requested_language_code?: LanguageCode;
  translation_available?: boolean;
};

export type PublishedArticleDataSource = "public_feed_snapshot" | "articles_fallback" | "edge_feed_snapshot";
export type FeedDependencyState = "available" | "degraded" | "unavailable" | "unknown";
export type FeedDegradationStatus = {
  mode: "degraded" | "maintenance";
  reason: string;
  message: string;
  services: {
    supabase: FeedDependencyState;
    edgeSnapshot: FeedDependencyState;
    worker: FeedDependencyState;
    localAi: FeedDependencyState;
    translations: FeedDependencyState;
  };
  loggedAt: string;
};

export type SearchArticlesResult = {
  articles: Article[];
  nextPage: number | null;
  query: string;
  page: number;
  pageSize: number;
  languageCode: LanguageCode;
};

const ARTICLE_SELECT =
  "id, source, title, original_url, image_url, published_at, published_on_site_at, ai_summary, category, positivity_score";

type ArticleSummaryRow = {
  original_url: string;
  language_code: string;
  title: string;
  summary: string;
};

function cleanCategory(category?: string | null) {
  const cleanedCategory = category?.trim();

  if (!cleanedCategory || cleanedCategory.toLowerCase() === "all") {
    return null;
  }

  return cleanedCategory;
}

export function getCategoryBadges(category: string | null) {
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

type ArticleCursor = {
  publishedOnSiteAt: string;
  id: string;
};

export type PublicFeedEdgeSnapshotMetadata = {
  status: "hit" | "miss" | "unconfigured" | "unbound" | "empty" | "error";
  updatedAt: string | null;
  ageSeconds: number | null;
  articleCount: number | null;
  version: number | null;
  endpoint?: string | null;
  message?: string | null;
};

export type PublishedArticlesResult = {
  articles: Article[];
  nextPage: number | null;
  nextCursor: string | null;
  dataSource: PublishedArticleDataSource;
  languageCode: LanguageCode;
  edgeSnapshot?: PublicFeedEdgeSnapshotMetadata | null;
};

export type HomeFeedSectionId = (typeof HOME_FEED_SECTIONS)[number]["id"];

export type HomeFeedSection = {
  id: HomeFeedSectionId;
  articles: Article[];
};

export type HomeFeedPayload = PublishedArticlesResult & {
  sections: HomeFeedSection[];
  degradation?: FeedDegradationStatus | null;
};

function encodeArticleCursor(article: Article) {
  const publishedOnSiteAt = article.published_on_site_at;

  if (!publishedOnSiteAt) {
    return null;
  }

  return Buffer.from(
    JSON.stringify({
      publishedOnSiteAt,
      id: article.id,
    } satisfies ArticleCursor),
    "utf8",
  ).toString("base64url");
}

function decodeArticleCursor(cursor?: string | null): ArticleCursor | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<ArticleCursor>;

    if (!parsed.publishedOnSiteAt || !parsed.id) {
      return null;
    }

    return {
      publishedOnSiteAt: parsed.publishedOnSiteAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function basePublishedArticleQuery(category?: string | null) {
  const selectedCategory = cleanCategory(category);
  const supabase = getSupabase();
  let query = supabase
    .from("articles")
    .select(ARTICLE_SELECT)
    .eq("status", "published")
    .not("image_url", "is", null)
    .neq("image_url", "");

  if (selectedCategory) {
    query = query.ilike("category", `%${selectedCategory}%`);
  }

  return query;
}

function basePublicFeedSnapshotQuery(category?: string | null) {
  const selectedCategory = cleanCategory(category);
  const supabase = getSupabase();
  let query = supabase.from(PUBLIC_FEED_SNAPSHOT_TABLE).select(ARTICLE_SELECT);

  if (selectedCategory) {
    query = query.ilike("category", `%${selectedCategory}%`);
  }

  return query;
}

async function applyArticleSummaries(
  articles: Article[],
  requestedLanguageCode: LanguageCode,
): Promise<Article[]> {
  if (requestedLanguageCode === DEFAULT_LANGUAGE_CODE || articles.length === 0) {
    return articles.map((article) => ({
      ...article,
      language_code: DEFAULT_LANGUAGE_CODE,
      requested_language_code: requestedLanguageCode,
      translation_available: true,
    }));
  }

  const originalUrls = articles
    .map((article) => article.original_url)
    .filter(Boolean);

  if (originalUrls.length === 0) {
    return articles.map((article) => ({
      ...article,
      language_code: DEFAULT_LANGUAGE_CODE,
      requested_language_code: requestedLanguageCode,
      translation_available: false,
    }));
  }

  const { data, error } = await getSupabase()
    .from("article_summaries")
    .select("original_url, language_code, title, summary")
    .eq("language_code", requestedLanguageCode)
    .in("original_url", originalUrls);

  if (error) {
    console.error("Failed to load localized article summaries. Falling back to English:", error);
    return articles.map((article) => ({
      ...article,
      language_code: DEFAULT_LANGUAGE_CODE,
      requested_language_code: requestedLanguageCode,
      translation_available: false,
    }));
  }

  const summariesByUrl = new Map(
    ((data ?? []) as ArticleSummaryRow[]).map((summary) => [summary.original_url, summary]),
  );

  return articles.map((article) => {
    const localizedSummary = summariesByUrl.get(article.original_url);

    if (!localizedSummary) {
      return {
        ...article,
        language_code: DEFAULT_LANGUAGE_CODE,
        requested_language_code: requestedLanguageCode,
        translation_available: false,
      };
    }

    const quality = validateTranslatedSummary(
      {
        language_code: localizedSummary.language_code,
        title: localizedSummary.title,
        summary: localizedSummary.summary,
        sourceTitle: article.title,
        sourceSummary: article.ai_summary,
      },
      requestedLanguageCode,
    );

    if (!quality.usable) {
      console.warn(
        "Localized article summary failed quality checks. Falling back to English:",
        {
          originalUrl: article.original_url,
          requestedLanguageCode,
          warnings: quality.warnings.map((warning) => warning.code),
        },
      );

      return {
        ...article,
        language_code: DEFAULT_LANGUAGE_CODE,
        requested_language_code: requestedLanguageCode,
        translation_available: false,
      };
    }

    return {
      ...article,
      title: localizedSummary.title || article.title,
      ai_summary: localizedSummary.summary || article.ai_summary,
      language_code: requestedLanguageCode,
      requested_language_code: requestedLanguageCode,
      translation_available: true,
    };
  });
}

async function shapePublishedArticlesResult({
  data,
  page,
  includeNextPage,
  dataSource,
  languageCode,
  pageSize = PAGE_SIZE,
}: {
  data: Article[] | null;
  page: number;
  includeNextPage: boolean;
  dataSource: PublishedArticleDataSource;
  languageCode: LanguageCode;
  pageSize?: number;
}): Promise<PublishedArticlesResult> {
  const rows = data ?? [];
  const uniqueRows = dedupeArticlesByIdentity(rows);
  const hasMore = rows.length > pageSize || uniqueRows.length > pageSize;
  const baseArticles = uniqueRows.slice(0, pageSize);
  const articles = await applyArticleSummaries(baseArticles, languageCode);
  const lastArticle = baseArticles.at(-1);

  return {
    articles,
    nextPage: includeNextPage && hasMore ? page + 1 : null,
    nextCursor: hasMore && lastArticle ? encodeArticleCursor(lastArticle) : null,
    dataSource,
    languageCode,
  };
}

async function getPublishedArticlesFromSnapshot(
  safePage: number,
  category?: string | null,
  languageCode: LanguageCode = DEFAULT_LANGUAGE_CODE,
): Promise<PublishedArticlesResult | null> {
  const from = safePage * PAGE_SIZE;
  const to = from + PAGE_SIZE;

  const { data, error } = await basePublicFeedSnapshotQuery(category)
    .order("snapshot_rank", { ascending: true })
    .range(from, to);

  if (error) {
    console.warn("Public feed snapshot unavailable. Falling back to articles table or edge snapshot.", {
      code: error?.code,
      message: error?.message,
    });
    return null;
  }

  return shapePublishedArticlesResult({
    data: (data ?? []) as Article[],
    page: safePage,
    includeNextPage: true,
    dataSource: "public_feed_snapshot",
    languageCode,
  });
}

async function getPublishedArticlesFromSourceTable(
  safePage: number,
  category?: string | null,
  languageCode: LanguageCode = DEFAULT_LANGUAGE_CODE,
): Promise<PublishedArticlesResult> {
  const from = safePage * PAGE_SIZE;
  const to = from + PAGE_SIZE;

  const { data, error } = await basePublishedArticleQuery(category)
    .order("published_on_site_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    console.warn("Fallback articles table unavailable. Edge snapshot fallback may still serve articles.", {
      code: error?.code,
      message: error?.message,
    });

    return {
      articles: [],
      nextPage: null,
      nextCursor: null,
      dataSource: "articles_fallback",
      languageCode,
    };
  }

  return shapePublishedArticlesResult({
    data: (data ?? []) as Article[],
    page: safePage,
    includeNextPage: true,
    dataSource: "articles_fallback",
    languageCode,
  });
}

export async function getPublishedArticles(
  page = 0,
  category?: string | null,
  requestedLanguageCode?: string | null,
): Promise<PublishedArticlesResult> {
  const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
  const languageCode = normalizeLanguageCode(requestedLanguageCode);

  const snapshotResult = await getPublishedArticlesFromSnapshot(safePage, category, languageCode);

  if (!snapshotResult) {
    return getPublishedArticlesFromSourceTable(safePage, category, languageCode);
  }

  // Production can occasionally have a short or stale public_feed_snapshot.
  // If the snapshot does not prove that another page exists, verify against the
  // canonical articles table before telling the client pagination is finished.
  if (snapshotResult.nextPage === null) {
    const sourceResult = await getPublishedArticlesFromSourceTable(safePage, category, languageCode);

    if (
      sourceResult.nextPage !== null ||
      sourceResult.articles.length > snapshotResult.articles.length
    ) {
      return sourceResult;
    }
  }

  return snapshotResult;
}

export async function getPublishedArticlesForSection(
  category: string,
  requestedLanguageCode?: string | null,
  limit = CATEGORY_SECTION_SIZE,
): Promise<Article[]> {
  const selectedCategory = cleanCategory(category);
  const languageCode = normalizeLanguageCode(requestedLanguageCode);
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.floor(limit), 1), 24)
    : CATEGORY_SECTION_SIZE;

  if (!selectedCategory) {
    return [];
  }

  const { data: snapshotData, error: snapshotError } =
    await basePublicFeedSnapshotQuery(selectedCategory)
      .order("snapshot_rank", { ascending: true })
      .limit(safeLimit);

  if (!snapshotError && snapshotData && snapshotData.length > 0) {
    return applyArticleSummaries(
      dedupeArticlesByIdentity(snapshotData as Article[]).slice(0, safeLimit),
      languageCode,
    );
  }

  if (snapshotError) {
    console.warn("Category public feed snapshot unavailable. Falling back to articles table or edge snapshot.", {
      code: snapshotError?.code,
      message: snapshotError?.message,
    });
  }

  const { data, error } = await basePublishedArticleQuery(selectedCategory)
    .order("published_on_site_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.warn("Category fallback articles table unavailable. Edge snapshot fallback may still serve articles.", {
      code: error?.code,
      message: error?.message,
    });
    return [];
  }

  return applyArticleSummaries(
    dedupeArticlesByIdentity((data ?? []) as Article[]).slice(0, safeLimit),
    languageCode,
  );
}

function articleMatchesSection(article: Article, query: string) {
  return article.category?.toLowerCase().includes(query.toLowerCase()) ?? false;
}

async function backfillEmptyHomeFeedSections(
  sections: HomeFeedSection[],
  seenArticleKeys: Set<string>,
  requestedLanguageCode?: string | null,
): Promise<HomeFeedSection[]> {
  const emptySectionIds = new Set(
    sections
      .filter((section) => section.articles.length === 0)
      .map((section) => section.id),
  );

  if (emptySectionIds.size === 0) {
    return sections;
  }

  // The global homepage snapshot scan is deliberately bounded. A category can
  // still have matching rows outside that window, so query only empty sections
  // before presenting an empty state to readers.
  const backfills = await Promise.all(
    HOME_FEED_SECTIONS.filter((section) => emptySectionIds.has(section.id)).map(
      async (section) => [
        section.id,
        await getPublishedArticlesForSection(section.query, requestedLanguageCode),
      ] as const,
    ),
  );
  const backfillBySectionId = new Map(backfills);

  return sections.map((section) => {
    const backfillArticles = backfillBySectionId.get(section.id);

    if (!backfillArticles) {
      return section;
    }

    const uniqueArticles: Article[] = [];

    for (const article of backfillArticles) {
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

export async function getHomeFeedFromSnapshot(
  requestedLanguageCode?: string | null,
): Promise<HomeFeedPayload | null> {
  const languageCode = normalizeLanguageCode(requestedLanguageCode);
  const { data, error } = await basePublicFeedSnapshotQuery()
    .order("snapshot_rank", { ascending: true })
    .limit(HOME_FEED_SNAPSHOT_SCAN_LIMIT);

  if (error || !data || data.length === 0) {
    if (error) {
      console.warn("Homepage snapshot unavailable. Falling back to legacy feed reads.", {
        code: error?.code,
        message: error?.message,
      });
    }

    return null;
  }

  const rows = dedupeArticlesByIdentity(data as Article[]);
  const mainBaseArticles = rows.slice(0, PAGE_SIZE);
  const seenArticleKeys = new Set(
    mainBaseArticles
      .map((article) => getArticleIdentityKey(article))
      .filter((articleKey): articleKey is string => Boolean(articleKey)),
  );
  const sectionBaseArticles = HOME_FEED_SECTIONS.map((section) => {
    const sectionArticles: Article[] = [];

    for (const article of rows) {
      if (
        sectionArticles.length >= CATEGORY_SECTION_SIZE ||
        !articleMatchesSection(article, section.query)
      ) {
        continue;
      }

      const articleKey = getArticleIdentityKey(article);

      if (articleKey && seenArticleKeys.has(articleKey)) {
        continue;
      }

      sectionArticles.push(article);

      if (articleKey) {
        seenArticleKeys.add(articleKey);
      }
    }

    return {
      id: section.id,
      articles: sectionArticles,
    };
  });

  const completedSections = await backfillEmptyHomeFeedSections(
    sectionBaseArticles,
    seenArticleKeys,
    requestedLanguageCode,
  );
  const uniqueArticlesByKey = new Map<string, Article>();

  for (const article of mainBaseArticles) {
    const articleKey = getArticleIdentityKey(article);

    if (articleKey) {
      uniqueArticlesByKey.set(articleKey, article);
    }
  }

  for (const section of completedSections) {
    for (const article of section.articles) {
      const articleKey = getArticleIdentityKey(article);

      if (articleKey) {
        uniqueArticlesByKey.set(articleKey, article);
      }
    }
  }

  const localizedArticles = await applyArticleSummaries(
    Array.from(uniqueArticlesByKey.values()),
    languageCode,
  );
  const localizedByKey = new Map(
    localizedArticles
      .map((article) => {
        const articleKey = getArticleIdentityKey(article);
        return articleKey ? [articleKey, article] as const : null;
      })
      .filter((entry): entry is readonly [string, Article] => Boolean(entry)),
  );
  const lastMainArticle = mainBaseArticles.at(-1);

  return {
    articles: mainBaseArticles.map((article) => {
      const articleKey = getArticleIdentityKey(article);
      return articleKey ? localizedByKey.get(articleKey) ?? article : article;
    }),
    nextPage: null,
    nextCursor:
      rows.length > PAGE_SIZE && lastMainArticle
        ? encodeArticleCursor(lastMainArticle)
        : null,
    dataSource: "public_feed_snapshot",
    languageCode,
    sections: completedSections.map((section) => ({
      id: section.id,
      articles: section.articles.map(
        (article) => {
          const articleKey = getArticleIdentityKey(article);
          return articleKey ? localizedByKey.get(articleKey) ?? article : article;
        },
      ),
    })),
  };
}

async function getPublishedArticlesByCursorFromSourceTable(
  decodedCursor: ArticleCursor | null,
  category?: string | null,
  languageCode: LanguageCode = DEFAULT_LANGUAGE_CODE,
): Promise<PublishedArticlesResult> {
  let query = basePublishedArticleQuery(category);

  if (decodedCursor) {
    query = query.or(
      `published_on_site_at.lt.${decodedCursor.publishedOnSiteAt},and(published_on_site_at.eq.${decodedCursor.publishedOnSiteAt},id.lt.${decodedCursor.id})`,
    );
  }

  const { data, error } = await query
    .order("published_on_site_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CURSOR_PAGE_SIZE + 1);

  if (error) {
    console.error("Failed to load cursor-paginated published articles from fallback articles table:", error);

    return {
      articles: [],
      nextPage: null,
      nextCursor: null,
      dataSource: "articles_fallback",
      languageCode,
    };
  }

  return shapePublishedArticlesResult({
    data: (data ?? []) as Article[],
    page: 0,
    includeNextPage: false,
    dataSource: "articles_fallback",
    languageCode,
    pageSize: CURSOR_PAGE_SIZE,
  });
}

export async function getPublishedArticlesByCursor(
  cursor?: string | null,
  category?: string | null,
  requestedLanguageCode?: string | null,
): Promise<PublishedArticlesResult> {
  const decodedCursor = decodeArticleCursor(cursor);
  const languageCode = normalizeLanguageCode(requestedLanguageCode);

  // Cursor pagination is used as a backwards-compatible fallback for older
  // cached homepage payloads. Use the canonical articles table here so it does
  // not depend on the current state or ordering of the materialized snapshot.
  return getPublishedArticlesByCursorFromSourceTable(decodedCursor, category, languageCode);
}


export async function searchPublishedArticles(
  searchQuery: string,
  page = 0,
  pageSize = SEARCH_PAGE_SIZE,
  requestedLanguageCode?: string | null,
): Promise<SearchArticlesResult> {
  const query = searchQuery.trim().replace(/\s+/g, " ").slice(0, 80);
  const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
  const safePageSize = Number.isFinite(pageSize)
    ? Math.min(Math.max(Math.floor(pageSize), 1), 50)
    : SEARCH_PAGE_SIZE;
  const languageCode = normalizeLanguageCode(requestedLanguageCode);

  if (query.length < 2) {
    return {
      articles: [],
      nextPage: null,
      query,
      page: safePage,
      pageSize: safePageSize,
      languageCode,
    };
  }

  const { data, error } = await getSupabase().rpc("search_articles", {
    search_query: query,
    page_size: safePageSize + 1,
    page_offset: safePage * safePageSize,
  });

  if (error) {
    console.error("Failed to search published articles:", error);
    throw error;
  }

  const rows = (data ?? []) as Article[];
  const baseArticles = rows.slice(0, safePageSize);
  const articles = await applyArticleSummaries(baseArticles, languageCode);

  return {
    articles,
    nextPage: rows.length > safePageSize ? safePage + 1 : null,
    query,
    page: safePage,
    pageSize: safePageSize,
    languageCode,
  };
}

export async function getPublishedCategories(limit = 1000) {
  const supabase = getSupabase();
  const { data: snapshotData, error: snapshotError } = await supabase
    .from(PUBLIC_FEED_SNAPSHOT_TABLE)
    .select("category")
    .not("category", "is", null)
    .limit(limit);

  if (!snapshotError) {
    const categories = new Set<string>();

    snapshotData?.forEach((article) => {
      getCategoryBadges(article.category).forEach((category) => {
        categories.add(category);
      });
    });

    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }

  console.error("Failed to load article categories from public feed snapshot. Falling back to articles table:", snapshotError);

  const { data, error } = await supabase
    .from("articles")
    .select("category")
    .eq("status", "published")
    .not("image_url", "is", null)
    .neq("image_url", "")
    .not("category", "is", null)
    .limit(limit);

  if (error) {
    console.error("Failed to load article categories from fallback articles table:", error);
    return [];
  }

  const categories = new Set<string>();

  data?.forEach((article) => {
    getCategoryBadges(article.category).forEach((category) => {
      categories.add(category);
    });
  });

  return Array.from(categories).sort((a, b) => a.localeCompare(b));
}

const getCachedArticleById = unstable_cache(async (id: string, requestedLanguageCode?: string | null) => {
  const languageCode = normalizeLanguageCode(requestedLanguageCode);
  const { data, error } = await getSupabase()
    .from("articles")
    .select(ARTICLE_SELECT)
    .eq("status", "published")
    .eq("id", id)
    .not("image_url", "is", null)
    .neq("image_url", "")
    .single();

  if (error) {
    console.error("Failed to load article:", error);
    return null;
  }

  const [article] = await applyArticleSummaries([data as Article], languageCode);
  return article ?? null;
}, ["published-article-by-id"], {
  revalidate: 3600,
});

export const getArticleById = cache(getCachedArticleById);

export async function getRecentArticleSitemapItems(limit = ROOT_SITEMAP_RECENT_ARTICLE_LIMIT) {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.floor(limit), 1), ARTICLE_SITEMAP_PAGE_SIZE)
    : ROOT_SITEMAP_RECENT_ARTICLE_LIMIT;

  const { data, error } = await getSupabase()
    .from("articles")
    .select("id, published_on_site_at, published_at")
    .eq("status", "published")
    .not("image_url", "is", null)
    .neq("image_url", "")
    .order("published_on_site_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error("Failed to load sitemap articles:", error);
    return [];
  }

  return data ?? [];
}

export async function getPublishedArticleSitemapCount() {
  const { count, error } = await getSupabase()
    .from("articles")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .not("image_url", "is", null)
    .neq("image_url", "");

  if (error) {
    console.error("Failed to count sitemap articles:", error);
    return 0;
  }

  return count ?? 0;
}

export async function getArticleSitemapItemsPage(shardId: number) {
  const { from, to } = getArticleSitemapRange(shardId);
  const { data, error } = await getSupabase()
    .from("articles")
    .select("id, published_on_site_at, published_at")
    .eq("status", "published")
    .not("image_url", "is", null)
    .neq("image_url", "")
    .order("published_on_site_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Failed to load sitemap article shard:", {
      shardId,
      from,
      to,
      error,
    });
    return [];
  }

  return data ?? [];
}
