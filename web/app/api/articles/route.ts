import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 5;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const pageParam = searchParams.get("page") ?? "0";
  const page = Number(pageParam);

  const safePage = Number.isFinite(page) && page >= 0 ? page : 0;

  const from = safePage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from("articles")
    .select(
      "id, source, title, original_url, image_url, published_at, published_on_site_at, ai_summary, category, positivity_score",
    )
    .eq("status", "published")
    .order("published_on_site_at", { ascending: false })
    .order("positivity_score", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load articles" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    articles: data ?? [],
    nextPage: data && data.length === PAGE_SIZE ? safePage + 1 : null,
  });
}