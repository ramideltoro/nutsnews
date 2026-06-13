import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/app/components/SiteFooter";
import { getArticleById, SITE_URL } from "@/lib/articles";

export const revalidate = 3600;

type ArticlePageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(dateValue: string | null) {
  if (!dateValue) {
    return "Published recently";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateValue));
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

  return {
    title: article.title,
    description,
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
      images: article.image_url ? [article.image_url] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: article.image_url ? [article.image_url] : undefined,
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
      name: article.source,
    },
    publisher: {
      "@type": "Organization",
      name: "NutsNews",
      url: SITE_URL,
    },
    isBasedOn: article.original_url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
  };

  return (
      <main className="min-h-screen overflow-hidden bg-neutral-950 px-4 pb-28 pt-6 text-neutral-100">
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
              {article.image_url ? (
                  <div className="relative h-64 overflow-hidden bg-neutral-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={article.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                        fetchPriority="high"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/85 via-neutral-950/20 to-transparent" />
                  </div>
              ) : null}

              <div className="p-6">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">
                  {article.category ?? "Uplifting"} · {article.source} ·{" "}
                  {formatDate(article.published_on_site_at)}
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