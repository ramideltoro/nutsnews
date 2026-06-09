import { NextResponse } from "next/server";
import { getPublishedArticles } from "@/lib/articles";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page") ?? "0";
  const page = Number(pageParam);

  const result = await getPublishedArticles(page);

  return NextResponse.json(result);
}