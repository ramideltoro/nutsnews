import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getArticleById, getRecentArticleSitemapItems, SITE_URL } from "@/lib/articles";
import { getPublisherAttribution } from "@/lib/publisherAttribution";
import { LocalizedArticleDetail } from "./LocalizedArticleDetail";

export const revalidate = 3600;

type ArticlePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateStaticParams() {
  const articles = await getRecentArticleSitemapItems(100);
  return articles.map((article) => ({ id: article.id }));
}

export async function generateMetadata({
                                         params,
                                       }: ArticlePageProps): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleById(id);

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

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { id } = await params;
  const article = await getArticleById(id);

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
      <>
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />

        <LocalizedArticleDetail initialArticle={article} />
      </>
  );
}
