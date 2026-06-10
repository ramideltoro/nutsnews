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

export async function getPublishedArticles(page = 0, category?: string | null) {
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
    console.error("Failed to load published articles:", error);

    return {
      articles: [] as Article[],
      nextPage: null as number | null,
    };
  }

  return {
    articles: (data ?? []) as Article[],
    nextPage: data && data.length === PAGE_SIZE ? safePage + 1 : null,
  };
}

export async function getPublishedCategories(limit = 1000) {
  const { data, error } = await supabase
    .from("articles")
    .select("category")
    .eq("status", "published")
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
    .order("published_on_site_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to load sitemap articles:", error);
    return [];
  }

  return data ?? [];
}