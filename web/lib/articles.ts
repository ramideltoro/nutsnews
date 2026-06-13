import { cache } from "react";

import { logError, logInfo } from "@/lib/logger";
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

export async function getPublishedArticles(page = 0, category?: string | null) {
  const startedAt = Date.now();
  const safePage = Number.isFinite(page) && page >= 0 ? page : 0;
  const from = safePage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const selectedCategory = cleanCategory(category);

  let query = supabase
      .from("articles")
      .select(ARTICLE_SELECT)
      .eq("status", "published");

  if (selectedCategory) {
    query = query.ilike("category", `%${selectedCategory}%`);
  }

  const { data, error } = await query
      .order("published_on_site_at", { ascending: false })
      .order("positivity_score", { ascending: false })
      .range(from, to);

  if (error) {
    await logError(
        "supabase.articles.load_failed",
        "Failed to load published articles from Supabase",
        error,
        {
          page: safePage,
          category: selectedCategory ?? "all",
          from,
          to,
          durationMs: Date.now() - startedAt,
        },
    );

    return {
      articles: [] as Article[],
      nextPage: null as number | null,
    };
  }

  await logInfo("supabase.articles.loaded", "Loaded published articles", {
    page: safePage,
    category: selectedCategory ?? "all",
    count: data?.length ?? 0,
    nextPage: data && data.length === PAGE_SIZE ? safePage + 1 : null,
    durationMs: Date.now() - startedAt,
  });

  return {
    articles: (data ?? []) as Article[],
    nextPage: data && data.length === PAGE_SIZE ? safePage + 1 : null,
  };
}

export async function getPublishedCategories(limit = 1000) {
  const startedAt = Date.now();

  const { data, error } = await supabase
      .from("articles")
      .select("category")
      .eq("status", "published")
      .not("category", "is", null)
      .limit(limit);

  if (error) {
    await logError(
        "supabase.categories.load_failed",
        "Failed to load article categories from Supabase",
        error,
        {
          limit,
          durationMs: Date.now() - startedAt,
        },
    );

    return [];
  }

  const categories = new Set<string>();

  data?.forEach((article) => {
    getCategoryBadges(article.category).forEach((category) => {
      categories.add(category);
    });
  });

  const categoryList = Array.from(categories).sort((a, b) =>
      a.localeCompare(b),
  );

  await logInfo("supabase.categories.loaded", "Loaded published categories", {
    count: categoryList.length,
    limit,
    durationMs: Date.now() - startedAt,
  });

  return categoryList;
}

export const getArticleById = cache(async (id: string) => {
  const startedAt = Date.now();

  const { data, error } = await supabase
      .from("articles")
      .select(ARTICLE_SELECT)
      .eq("status", "published")
      .eq("id", id)
      .single();

  if (error) {
    await logError(
        "supabase.article.load_failed",
        "Failed to load article by ID from Supabase",
        error,
        {
          articleId: id,
          durationMs: Date.now() - startedAt,
        },
    );

    return null;
  }

  await logInfo("supabase.article.loaded", "Loaded article by ID", {
    articleId: id,
    source: data?.source,
    category: data?.category,
    durationMs: Date.now() - startedAt,
  });

  return data as Article;
});

export async function getRecentArticleSitemapItems(limit = 1000) {
  const startedAt = Date.now();

  const { data, error } = await supabase
      .from("articles")
      .select("id, published_on_site_at, published_at")
      .eq("status", "published")
      .order("published_on_site_at", { ascending: false })
      .limit(limit);

  if (error) {
    await logError(
        "supabase.sitemap_articles.load_failed",
        "Failed to load sitemap articles from Supabase",
        error,
        {
          limit,
          durationMs: Date.now() - startedAt,
        },
    );

    return [];
  }

  await logInfo(
      "supabase.sitemap_articles.loaded",
      "Loaded sitemap article items",
      {
        count: data?.length ?? 0,
        limit,
        durationMs: Date.now() - startedAt,
      },
  );

  return data ?? [];
}