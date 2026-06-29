import Image from "next/image";

export const revalidate = 300;

import { ArticleFeed } from "./components/ArticleFeed";
import { SiteFooter } from "./components/SiteFooter";
import { getPublishedArticles, SITE_URL } from "@/lib/articles";

const primarySections = [
  "Top Stories",
  "Community",
  "Animals",
  "Science",
  "Wellness",
  "Travel",
  "Culture",
  "Achievements",
];

const trendingSections = [
  "Feel-good moments",
  "Kindness",
  "Nature",
  "Breakthroughs",
  "Creative lives",
];

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
    <main className="newspaper-home-shell min-h-screen text-[var(--theme-text)]">
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
          </div>

          <nav className="newspaper-primary-nav" aria-label="Primary sections">
            {primarySections.map((section) => (
              <a key={section} href="#top-stories">
                {section}
              </a>
            ))}
          </nav>

          <div className="newspaper-trending-bar" aria-label="Trending topics">
            <span>Trending</span>
            {trendingSections.map((section) => (
              <a key={section} href="#top-stories">
                {section}
              </a>
            ))}
          </div>
        </header>

        <ArticleFeed
          initialArticles={articles}
          initialNextPage={nextPage}
          initialNextCursor={nextCursor}
        />
      </div>

      <SiteFooter />
    </main>
  );
}
