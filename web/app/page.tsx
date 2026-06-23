import Image from "next/image";
export const revalidate = 300;

import { ArticleFeed } from "./components/ArticleFeed";
import { SiteFooter } from "./components/SiteFooter";
import { getPublishedArticles, SITE_URL } from "@/lib/articles";

export default async function Home() {
  const { articles, nextPage, nextCursor } = await getPublishedArticles();

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
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_34%),linear-gradient(180deg,_#0a0a0a_0%,_#17120a_45%,_#0a0a0a_100%)] px-4 pb-28 pt-6 text-neutral-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />

      <section className="mx-auto w-full max-w-md">
        <header className="mb-5">
          <div className="relative overflow-hidden rounded-[2.25rem] border border-amber-400/20 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.28),_transparent_36%),linear-gradient(135deg,_#171717,_#0a0a0a_58%,_#451a03)] p-6 shadow-2xl shadow-black/50">
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />

            <div className="relative z-10">
              <div className="mb-7 text-center">
                <h1 className="flex flex-nowrap items-center justify-center gap-2 text-[2.25rem] font-black leading-none tracking-tight sm:gap-3 sm:text-5xl">
                  <span className="text-white">Nuts</span>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center">
                    <Image
                      src="/nutsnews-logo.png"
                      alt="NutsNews logo"
                      width={96}
                      height={96}
                      priority
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <span className="text-amber-300">News</span>
                </h1>

                <p className="mt-3 whitespace-nowrap text-[0.7rem] font-bold uppercase tracking-[0.16em] text-amber-200 sm:text-base sm:tracking-[0.24em]">
                  Positive News, Simplified
                </p>
              </div>

              <p className="mx-auto max-w-sm text-center text-base leading-7 text-neutral-300">
                A calm feed of uplifting stories, curated by Artificial Intelligence.
              </p>
            </div>
          </div>
        </header>

        <ArticleFeed
          initialArticles={articles}
          initialNextPage={nextPage}
          initialNextCursor={nextCursor}
        />
      </section>

      <SiteFooter />
    </main>
  );
}
