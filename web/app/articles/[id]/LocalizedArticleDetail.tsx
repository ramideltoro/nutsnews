"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { SiteFooter } from "@/app/components/SiteFooter";
import { OptimizedArticleImage } from "@/app/components/OptimizedArticleImage";
import { useSelectedLanguage } from "@/app/components/useSelectedLanguage";
import { ARTICLE_DETAIL_IMAGE_SIZES } from "@/lib/imageDelivery";
import {
  DEFAULT_LANGUAGE_CODE,
  type LanguageCode,
} from "@/lib/languages";
import type { Article } from "@/lib/articles";
import { getPublisherAttribution } from "@/lib/publisherAttribution";

type LocalizedArticleDetailProps = {
  initialArticle: Article;
};

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

function isArticle(value: unknown): value is Article {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Article>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.source === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.original_url === "string" &&
    (typeof candidate.ai_summary === "string" || candidate.ai_summary === null)
  );
}

function isUsableLocalizedArticle(
  article: Article | null,
  languageCode: LanguageCode,
): article is Article {
  if (!article || languageCode === DEFAULT_LANGUAGE_CODE) {
    return false;
  }

  return (
    article.translation_available === true &&
    article.language_code === languageCode &&
    article.requested_language_code === languageCode
  );
}

export function LocalizedArticleDetail({
  initialArticle,
}: LocalizedArticleDetailProps) {
  const selectedLanguage = useSelectedLanguage();
  const [localizedArticle, setLocalizedArticle] = useState<Article | null>(null);
  const visibleArticle = isUsableLocalizedArticle(localizedArticle, selectedLanguage)
    ? localizedArticle
    : initialArticle;
  const visibleLanguageCode = visibleArticle.language_code ?? DEFAULT_LANGUAGE_CODE;
  const publisherAttribution = useMemo(
    () =>
      getPublisherAttribution(
        visibleArticle.source,
        visibleArticle.original_url,
      ),
    [visibleArticle.original_url, visibleArticle.source],
  );
  const siteDate = formatDate(
    visibleArticle.published_on_site_at,
    visibleLanguageCode,
  );

  useEffect(() => {
    if (selectedLanguage === DEFAULT_LANGUAGE_CODE) {
      return;
    }

    const controller = new AbortController();
    const query = new URLSearchParams({ lang: selectedLanguage });

    fetch(`/api/articles/${encodeURIComponent(initialArticle.id)}?${query}`, {
      cache: "default",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        const payload = await response.json();
        return isArticle(payload) ? payload : null;
      })
      .then((article) => {
        if (!controller.signal.aborted) {
          setLocalizedArticle(article);
        }
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        if (!controller.signal.aborted) {
          setLocalizedArticle(null);
        }
      });

    return () => controller.abort();
  }, [initialArticle.id, selectedLanguage]);

  return (
    <main
      lang={visibleLanguageCode}
      className="min-h-screen overflow-hidden bg-neutral-950 px-4 pb-28 pt-6 text-neutral-100"
    >
      <section className="mx-auto w-full max-w-md">
        <nav className="mb-5">
          <Link
            href="/"
            className="inline-flex rounded-full border border-amber-400/20 bg-neutral-900 px-4 py-2 text-sm font-bold text-amber-300 transition hover:bg-amber-400 hover:text-neutral-950"
          >
            &larr; Back to NutsNews
          </Link>
        </nav>

        <article lang={visibleLanguageCode}>
          <header className="overflow-hidden rounded-[2rem] border border-amber-500/20 bg-neutral-900 shadow-2xl shadow-black/40">
            <div className="relative h-64 overflow-hidden bg-neutral-800">
              <OptimizedArticleImage
                src={visibleArticle.image_url}
                alt={visibleArticle.title}
                category={visibleArticle.category}
                eager
                sizes={ARTICLE_DETAIL_IMAGE_SIZES}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/85 via-neutral-950/20 to-transparent" />
            </div>

            <div className="p-6">
              <p
                className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400"
                aria-label={`${visibleArticle.category ?? "Uplifting"} | ${visibleArticle.source} | ${siteDate}`}
              >
                {visibleArticle.category ?? "Uplifting"} &middot;{" "}
                {visibleArticle.source} &middot; {siteDate}
              </p>

              <h1 className="text-4xl font-black leading-tight text-white">
                {visibleArticle.title}
              </h1>
            </div>
          </header>

          <section className="mt-5 rounded-[2rem] border border-white/10 bg-neutral-900 p-6 shadow-xl shadow-black/20">
            <p className="text-lg leading-8 text-neutral-200">
              {visibleArticle.ai_summary}
            </p>

            <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-400/10 p-4 text-sm leading-6 text-neutral-300">
              NutsNews provides a short original summary and sends readers back
              to the original publisher for the complete story.
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={visibleArticle.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-neutral-950 transition hover:bg-amber-300"
                aria-label={`${publisherAttribution.readFullStoryLabel}: ${visibleArticle.title}`}
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
