import { cache } from "react";
import { supabase } from "@/lib/supabase";

export const PAGE_SIZE = 5;
export const SITE_URL = "https://www.nutsnews.com";

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
};

const ARTICLE_SELECT =
    "id, source, title, original_url, image_url, published_at, published_on_site_at, ai_summary, category, positivity_score";

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

export type PublishedArticlesResult = {
  articles: Article[];
  nextPage: number | null;
  nextCursor: string | null;
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

function shapePublishedArticlesResult({
  data,
  page,
  includeNextPage,
}: {
  data: Article[] | null;
  page: number;
  includeNextPage: boolean;
}): PublishedArticlesResult {
  const rows = data ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const articles = rows.slice(0, PAGE_SIZE);
  const lastArticle = articles.at(-1);

  return {
    articles,
    nextPage: includeNextPage && hasMore ? page + 1 : null,
    nextCursor: hasMore && lastArticle ? encodeArticleCursor(lastArticle) : null,
  };
}

export async function getPublishedArticles(page = 0, category?: string | null): Promise<PublishedArticlesResult> {
  const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
  const from = safePage * PAGE_SIZE;
  const to = from + PAGE_SIZE;

  const { data, error } = await basePublishedArticleQuery(category)
    .order("published_on_site_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Failed to load published articles:", error);

    return {
      articles: [] as Article[],
      nextPage: null as number | null,
      nextCursor: null as string | null,
    };
  }

  return shapePublishedArticlesResult({
    data: (data ?? []) as Article[],
    page: safePage,
    includeNextPage: true,
  });
}

export async function getPublishedArticlesByCursor(
  cursor?: string | null,
  category?: string | null,
): Promise<PublishedArticlesResult> {
  const decodedCursor = decodeArticleCursor(cursor);
  let query = basePublishedArticleQuery(category);

  if (decodedCursor) {
    query = query.or(
      `published_on_site_at.lt.${decodedCursor.publishedOnSiteAt},and(published_on_site_at.eq.${decodedCursor.publishedOnSiteAt},id.lt.${decodedCursor.id})`,
    );
  }

  const { data, error } = await query
    .order("published_on_site_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (error) {
    console.error("Failed to load cursor-paginated published articles:", error);

    return {
      articles: [] as Article[],
      nextPage: null,
      nextCursor: null,
    };
  }

  return shapePublishedArticlesResult({
    data: (data ?? []) as Article[],
    page: 0,
    includeNextPage: false,
  });
}

export async function getPublishedCategories(limit = 1000) {
  const { data, error } = await supabase
      .from("articles")
      .select("category")
      .eq("status", "published")
      .not("image_url", "is", null)
      .neq("image_url", "")
      .not("category", "is", null)
      .limit(limit);

  if (error) {
    console.error("Failed to load article categories:", error);
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

export const getArticleById = cache(async (id: string) => {
  const { data, error } = await supabase
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

  return data as Article;
});

export async function getRecentArticleSitemapItems(limit = 1000) {
  const { data, error } = await supabase
      .from("articles")
      .select("id, published_on_site_at, published_at")
      .eq("status", "published")
      .not("image_url", "is", null)
      .neq("image_url", "")
      .order("published_on_site_at", { ascending: false })
      .limit(limit);

  if (error) {
    console.error("Failed to load sitemap articles:", error);
    return [];
  }

  return data ?? [];
}