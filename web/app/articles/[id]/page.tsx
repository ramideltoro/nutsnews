import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleById, SITE_URL } from "@/lib/articles";

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
    <main className="min-h-screen bg-neutral-950 px-4 py-6 text-neutral-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <article className="mx-auto max-w-2xl">
        <nav className="mb-6">
          <Link href="/" className="text-sm font-semibold text-amber-300">
            ← Back to NutsNews
          </Link>
        </nav>

        <header className="rounded-3xl border border-amber-500/20 bg-neutral-900 p-6 shadow-2xl shadow-amber-950/20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
            {article.category ?? "Uplifting"} · {article.source} ·{" "}
            {formatDate(article.published_on_site_at)}
          </p>

          <h1 className="text-4xl font-bold leading-tight text-white">
            {article.title}
          </h1>

          {article.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.image_url}
              alt=""
              className="mt-6 h-64 w-full rounded-2xl object-cover"
              fetchPriority="high"
            />
          ) : null}
        </header>

        <section className="mt-6 rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
          <p className="text-lg leading-8 text-neutral-200">
            {article.ai_summary}
          </p>

          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-400/10 p-4 text-sm leading-6 text-neutral-300">
            NutsNews provides a short original summary and sends readers back to
            the original publisher for the complete story.
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={article.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-neutral-950 hover:bg-amber-300"
            >
              Read full story at {article.source}
            </a>

            <Link
              href="/about"
              className="rounded-full border border-amber-400/40 px-5 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-400/10"
            >
              About NutsNews
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}