import Link from "next/link";
import { ArticleFeed } from "./components/ArticleFeed";
import { SiteFooter } from "./components/SiteFooter";
import { getPublishedArticles, SITE_URL } from "@/lib/articles";

export default async function Home() {
  const { articles, nextPage } = await getPublishedArticles(0);

  const homeJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "NutsNews",
    url: SITE_URL,
    description:
      "A positive news feed curated by AI with short uplifting summaries and links to original publishers.",
    mainEntity: articles.map((article) => ({
      "@type": "Article",
      headline: article.title,
      url: `${SITE_URL}/articles/${article.id}`,
      datePublished: article.published_at ?? article.published_on_site_at,
      dateModified: article.published_on_site_at ?? article.published_at,
      image: article.image_url ? [article.image_url] : undefined,
      publisher: {
        "@type": "Organization",
        name: "NutsNews",
      },
      isBasedOn: article.original_url,
    })),
  };

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-6 pb-28 text-neutral-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />

      <section className="mx-auto max-w-2xl">
        <header className="mb-8 rounded-3xl border border-amber-500/20 bg-neutral-900 p-6 shadow-2xl shadow-amber-950/20">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-amber-400">
            Positive news, simplified
          </p>

          <h1 className="text-4xl font-bold tracking-tight text-white">
            Nuts News
          </h1>

          <p className="mt-3 text-base leading-7 text-neutral-300">
            A positive news feed curated by Artificial Intelligence
          </p>

          <nav className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link
              href="/about"
              className="rounded-full bg-amber-400 px-4 py-2 font-semibold text-neutral-950 hover:bg-amber-300"
            >
              About NutsNews
            </Link>
          </nav>
        </header>

        <ArticleFeed initialArticles={articles} initialNextPage={nextPage} />
      </section>

      <SiteFooter />
    </main>
  );
}