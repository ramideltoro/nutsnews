import { supabase } from "@/lib/supabase";

type Article = {
  id: string;
  source: string;
  title: string;
  original_url: string;
  image_url: string | null;
  published_at: string | null;
  ai_summary: string | null;
  category: string | null;
  positivity_score: number | null;
};

async function getArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(
      "id, source, title, original_url, image_url, published_at, ai_summary, category, positivity_score",
    )
    .eq("status", "published")
    .order("positivity_score", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(100);

  if (error) {
    return [];
  }

  return data ?? [];
}

export default async function Home() {
  const articles = await getArticles();

  return (
    <main className="min-h-screen bg-neutral-950 text-amber-50">
      <section className="mx-auto min-h-screen w-full max-w-md px-5 py-8">
        <header className="mb-8">
          <p className="mb-2 text-sm font-medium text-amber-400">
            Peaceful stories from around the world
          </p>

          <h1 className="text-4xl font-bold tracking-tight text-amber-100">
            HappyNews
          </h1>

          <p className="mt-3 text-base leading-7 text-neutral-300">
            A calm daily feed of uplifting, inspiring, and human stories.
          </p>
        </header>

        {articles.length === 0 && (
          <div className="rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 text-neutral-300">
            No uplifting stories are available yet. Please check back soon.
          </div>
        )}

        <div className="space-y-5">
          {articles.map((article) => (
            <article
              key={article.id}
              className="rounded-3xl border border-amber-500/20 bg-neutral-900 p-5 shadow-lg shadow-black/20"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/20">
                  {article.category ?? "Uplifting"}
                </span>

                <span className="text-xs font-medium text-neutral-400">
                  {article.source}
                </span>
              </div>

              <h2 className="text-xl font-semibold leading-snug text-amber-50">
                {article.title}
              </h2>

              <p className="mt-3 text-sm leading-6 text-neutral-300">
                {article.ai_summary}
              </p>

              <a
                href={article.original_url}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 shadow-sm hover:bg-amber-400"
              >
                Read full story
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}