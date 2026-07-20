import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/components/SiteFooter";
import { getArticleById, getRecentArticleSitemapItems, SITE_URL } from "@/lib/articles";
import { OptimizedArticleImage } from "@/app/components/OptimizedArticleImage";
import { ARTICLE_DETAIL_IMAGE_SIZES } from "@/lib/imageDelivery";
import {
  type LanguageCode,
  normalizeLanguageCode,
} from "@/lib/languages";
import { getPublisherAttribution } from "@/lib/publisherAttribution";

export const revalidate = 3600;

type ArticlePageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    lang?: string | string[];
    language?: string | string[];
    languageCode?: string | string[];
  }>;
};

export async function generateStaticParams() {
  const articles = await getRecentArticleSitemapItems(100);
  return articles.map((article) => ({ id: article.id }));
}

function getFirstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function getArticlePageLanguage(searchParams?: ArticlePageProps["searchParams"]) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return normalizeLanguageCode(
    getFirstSearchParam(resolvedSearchParams.lang) ??
      getFirstSearchParam(resolvedSearchParams.languageCode) ??
      getFirstSearchParam(resolvedSearchParams.language),
  );
}

function formatDate(dateValue: string | null, languageCode: LanguageCode) {
  if (!dateValue) {
    return "Published recently";
  }

  const localeByLanguage: Record<LanguageCode, string> = {
    en: "en-US",
    fr: "fr-FR",
    ja: "ja-JP",
    "de-CH": "de-CH",
    de: "de-DE",
    el: "el-GR",
  };

  return new Intl.DateTimeFormat(localeByLanguage[languageCode], {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateValue));
}

export async function generateMetadata({
                                         params,
                                         searchParams,
                                       }: ArticlePageProps): Promise<Metadata> {
  const { id } = await params;
  const languageCode = await getArticlePageLanguage(searchParams);
  const article = await getArticleById(id, languageCode);

  if (!article) {
    return {
      title: "Story not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const description =
      article.ai_summary ??
      "Read this uplifting story summary on NutsNews and visit the original publisher for the full article.";
  const socialImageUrl = "/opengraph-image";
  const publisherAttribution = getPublisherAttribution(
    article.source,
    article.original_url,
  );

  return {
    title: article.title,
    description: `${description} Original publisher: ${publisherAttribution.publisherName}.`,
    authors: [
      {
        name: publisherAttribution.publisherName,
        url: publisherAttribution.originalUrl,
      },
    ],
    alternates: {
      canonical: `/articles/${article.id}`,
    },
    openGraph: {
      type: "article",
      url: `${SITE_URL}/articles/${article.id}`,
      title: article.title,
      description,
      siteName: "NutsNews",
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.published_on_site_at ?? undefined,
      authors: [publisherAttribution.publisherName],
      images: [
        {
          url: socialImageUrl,
          width: 1200,
          height: 630,
          alt: `${article.title} | NutsNews summary with attribution to ${publisherAttribution.publisherName}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: `${description} Source: ${publisherAttribution.publisherName}.`,
      images: [socialImageUrl],
    },
    other: {
      "nutsnews:publisher": publisherAttribution.publisherName,
      "nutsnews:publisher-url": publisherAttribution.originalUrl,
      "nutsnews:attribution-policy-version": publisherAttribution.policyVersion,
    },
  };
}

export default async function ArticlePage({ params, searchParams }: ArticlePageProps) {
  const { id } = await params;
  const languageCode = await getArticlePageLanguage(searchParams);
  const article = await getArticleById(id, languageCode);

  if (!article) {
    notFound();
  }

  const articleUrl = `${SITE_URL}/articles/${article.id}`;
  const publisherAttribution = getPublisherAttribution(
    article.source,
    article.original_url,
  );

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.ai_summary,
    url: articleUrl,
    image: article.image_url ? [article.image_url] : undefined,
    datePublished: article.published_at ?? article.published_on_site_at,
    dateModified: article.published_on_site_at ?? article.published_at,
    author: {
      "@type": "Organization",
      name: publisherAttribution.publisherName,
      url: publisherAttribution.originalUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "NutsNews",
      url: SITE_URL,
    },
    isBasedOn: article.original_url,
    citation: article.original_url,
    creditText: publisherAttribution.policySummary,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
  };

  return (
      <main
        lang={article.language_code ?? languageCode}
        className="min-h-screen overflow-hidden bg-neutral-950 px-4 pb-28 pt-6 text-neutral-100"
      >
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />

        <section className="mx-auto w-full max-w-md">
          <nav className="mb-5">
            <Link
                href="/"
                className="inline-flex rounded-full border border-amber-400/20 bg-neutral-900 px-4 py-2 text-sm font-bold text-amber-300 transition hover:bg-amber-400 hover:text-neutral-950"
            >
              ← Back to NutsNews
            </Link>
          </nav>

          <article>
            <header className="overflow-hidden rounded-[2rem] border border-amber-500/20 bg-neutral-900 shadow-2xl shadow-black/40">
              <div className="relative h-64 overflow-hidden bg-neutral-800">
                <OptimizedArticleImage
                  src={article.image_url}
                  category={article.category}
                  eager
                  sizes={ARTICLE_DETAIL_IMAGE_SIZES}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/85 via-neutral-950/20 to-transparent" />
              </div>

              <div className="p-6">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">
                  {article.category ?? "Uplifting"} · {article.source} ·{" "}
                  {formatDate(article.published_on_site_at, languageCode)}
                </p>

                <h1 className="text-4xl font-black leading-tight text-white">
                  {article.title}
                </h1>
              </div>
            </header>

            <section className="mt-5 rounded-[2rem] border border-white/10 bg-neutral-900 p-6 shadow-xl shadow-black/20">
              <p className="text-lg leading-8 text-neutral-200">
                {article.ai_summary}
              </p>

              <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-400/10 p-4 text-sm leading-6 text-neutral-300">
                NutsNews provides a short original summary and sends readers back
                to the original publisher for the complete story.
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                    href={article.original_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-neutral-950 transition hover:bg-amber-300"
                    aria-label={`${publisherAttribution.readFullStoryLabel}: ${article.title}`}
                    title={publisherAttribution.policySummary}
                >
                  Read full story
                </a>

                <Link
                    href="/about"
                    className="rounded-full border border-amber-400/30 bg-black/20 px-5 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/10"
                >
                  About NutsNews
                </Link>
              </div>
            </section>
          </article>
        </section>

        <SiteFooter />
      </main>
  );
}
