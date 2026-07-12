import Image from "next/image";
import { unstable_cache } from "next/cache";

// The immutable image is built with neutral data fixtures, so the page shell
// must be rendered by the running target instead of being prerendered empty.
export const dynamic = "force-dynamic";
export const revalidate = 900;

import { ArticleFeed } from "./components/ArticleFeed";
import { HomeArrivalAnimation } from "./components/HomeArrivalAnimation";
import { NewspaperPrimaryNav } from "./components/NewspaperPrimaryNav";
import { SiteFooter } from "./components/SiteFooter";
import { SITE_URL } from "@/lib/articles";
import { getHomeFeedDataWithEdgeFallback } from "@/lib/edgeFeedSnapshot";

const getCachedHomeFeed = unstable_cache(
  async () => getHomeFeedDataWithEdgeFallback(),
  ["homepage-initial-feed"],
  { revalidate: 900 },
);

export default async function Home() {
  const { articles, nextPage, nextCursor, sections } =
    await getCachedHomeFeed();

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
    <main
      id="top"
      className="newspaper-home-shell min-h-screen text-[var(--theme-text)]"
    >
      <HomeArrivalAnimation />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />

      <div className="newspaper-page-wrap">
        <header className="newspaper-site-header" aria-label="NutsNews header">
          <div className="newspaper-masthead">
            <h1 className="newspaper-logo" aria-label="NutsNews">
              <span>Nuts</span>
              <span className="newspaper-logo__mark">
                <Image
                  src="/nutsnews-logo.png"
                  alt=""
                  width={96}
                  height={96}
                  priority
                  className="h-full w-full object-contain"
                />
              </span>
              <span>News</span>
            </h1>
            <p className="newspaper-tagline">Positive news, Simplified</p>
          </div>

          <NewspaperPrimaryNav />
        </header>

        <ArticleFeed
          initialArticles={articles}
          initialNextPage={nextPage}
          initialNextCursor={nextCursor}
          initialCategorySections={sections}
        />
      </div>

      <SiteFooter />
    </main>
  );
}
