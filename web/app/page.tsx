import { unstable_cache } from "next/cache";
import { connection } from "next/server";

export const revalidate = 900;

import { ArticleFeed } from "./components/ArticleFeed";
import { HomeArrivalAnimation } from "./components/HomeArrivalAnimation";
import { HomeSiteHeader } from "./components/HomeSiteHeader";
import { SiteFooter } from "./components/SiteFooter";
import { SITE_URL } from "@/lib/articles";
import {
  createMaintenanceHomeFeedPayload,
  getHomeFeedDataWithEdgeFallback,
} from "@/lib/edgeFeedSnapshot";
import { logError } from "@/lib/logger";

const getCachedHomeFeed = unstable_cache(
  async () => getHomeFeedDataWithEdgeFallback(),
  ["homepage-initial-feed"],
  { revalidate: 900 },
);

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function shouldBypassHomeFeedCacheForQualification(
  searchParams: Record<string, string | string[] | undefined> | undefined,
) {
  const qualification = getStringSearchParam(searchParams?.qualification)?.trim();

  return (
    process.env.NUTSNEWS_RUNTIME_ENV === "staging" &&
    typeof qualification === "string" &&
    /^nutsnews-test-[a-z0-9-]+$/i.test(qualification)
  );
}

async function getSafeHomeFeedData(useUncachedFeed: boolean) {
  try {
    return useUncachedFeed
      ? await getHomeFeedDataWithEdgeFallback()
      : await getCachedHomeFeed();
  } catch (error) {
    await logError(
      "web.home_page.home_feed_failed",
      "Home page returned maintenance feed after home feed data failed.",
      error,
      {
        route: "/",
      },
    );

    return createMaintenanceHomeFeedPayload(null, {
      reason: "home_page_feed_exception",
    });
  }
}

export default async function Home({ searchParams }: HomePageProps) {
  // The immutable container image is built with neutral fixtures. Defer this
  // route only outside Vercel so the running image reads its target's feed,
  // while Vercel retains its established prerender/ISR behavior.
  if (process.env.VERCEL !== "1") {
    await connection();
  }

  const resolvedSearchParams = await searchParams;
  const shouldBypassCache =
    shouldBypassHomeFeedCacheForQualification(resolvedSearchParams);
  const { articles, nextPage, nextCursor, sections, degradation } =
    await getSafeHomeFeedData(shouldBypassCache);

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
        <HomeSiteHeader />

        <ArticleFeed
          initialArticles={articles}
          initialNextPage={nextPage}
          initialNextCursor={nextCursor}
          initialCategorySections={sections}
          initialDegradation={degradation ?? null}
        />
      </div>

      <SiteFooter />
    </main>
  );
}
