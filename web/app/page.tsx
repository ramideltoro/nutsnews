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
    <main className="modern-home-shell min-h-screen overflow-hidden px-4 pb-32 pt-6 text-[var(--theme-text)] sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />

      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="floating-orb floating-orb--one" />
        <div className="floating-orb floating-orb--two" />
        <div className="floating-orb floating-orb--three" />
        <div className="ambient-grid" />
      </div>

      <section className="relative z-10 mx-auto w-full max-w-2xl">
        <header className="mb-7">
          <div className="hero-modern group">
            <div className="hero-modern__shine" />
            <div className="hero-modern__mesh" />
            <div className="hero-modern__ring hero-modern__ring--one" />
            <div className="hero-modern__ring hero-modern__ring--two" />

            <div className="relative z-10">
              <div className="text-center">
                <h1 className="hero-title flex flex-nowrap items-center justify-center gap-2 text-[2.5rem] font-black leading-none tracking-tight sm:gap-4 sm:text-6xl">
                  <span className="text-[var(--theme-heading)]">Nuts</span>
                  <span className="hero-logo-wrap flex h-14 w-14 shrink-0 items-center justify-center sm:h-16 sm:w-16">
                    <Image
                      src="/nutsnews-logo.png"
                      alt="NutsNews logo"
                      width={128}
                      height={128}
                      preload
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <span className="text-[var(--theme-accent)]">News</span>
                </h1>

                <div className="mt-5 text-center">
                  <p className="hero-tagline mx-auto max-w-max" aria-label="Positive News, Simplified">
                    <span className="hero-tagline__spark" aria-hidden="true" />
                    <span className="hero-tagline__text">
                      <span className="hero-tagline__word hero-tagline__word--soft">Positive News,</span>
                      <span className="hero-tagline__word hero-tagline__word--accent">Simplified</span>
                    </span>
                  </p>
                </div>
              </div>
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
