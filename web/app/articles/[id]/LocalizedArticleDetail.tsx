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

export const articleDetailCopyByLanguage: Record<
  LanguageCode,
  {
    publishedRecently: string;
    fallbackCategory: string;
    backToHome: string;
    summaryNote: string;
    readFullStory: string;
    readFullStoryAtPrefix: string;
    readFullStoryAtSuffix: string;
    aboutNutsNews: string;
  }
> = {
  en: {
    publishedRecently: "Published recently",
    fallbackCategory: "Uplifting",
    backToHome: "Back to NutsNews",
    summaryNote:
      "NutsNews provides a short original summary and sends readers back to the original publisher for the complete story.",
    readFullStory: "Read full story",
    readFullStoryAtPrefix: "Read full story at ",
    readFullStoryAtSuffix: "",
    aboutNutsNews: "About NutsNews",
  },
  fr: {
    publishedRecently: "Publié récemment",
    fallbackCategory: "Positif",
    backToHome: "Retour à NutsNews",
    summaryNote:
      "NutsNews propose un court résumé original et renvoie les lecteurs vers l’éditeur d’origine pour l’article complet.",
    readFullStory: "Lire l’article complet",
    readFullStoryAtPrefix: "Lire l’article complet chez ",
    readFullStoryAtSuffix: "",
    aboutNutsNews: "À propos de NutsNews",
  },
  ja: {
    publishedRecently: "最近公開",
    fallbackCategory: "前向き",
    backToHome: "NutsNewsに戻る",
    summaryNote:
      "NutsNewsは短い独自の要約を提供し、記事全体は元の配信元で読めるよう読者を案内します。",
    readFullStory: "元記事を読む",
    readFullStoryAtPrefix: "元記事を",
    readFullStoryAtSuffix: "で読む",
    aboutNutsNews: "NutsNewsについて",
  },
  "de-CH": {
    publishedRecently: "Kürzlich veröffentlicht",
    fallbackCategory: "Aufmunternd",
    backToHome: "Zurück zu NutsNews",
    summaryNote:
      "NutsNews bietet eine kurze eigene Zusammenfassung und leitet Leserinnen und Leser für die vollständige Geschichte zum ursprünglichen Verlag zurück.",
    readFullStory: "Vollständige Geschichte lesen",
    readFullStoryAtPrefix: "Vollständige Geschichte bei ",
    readFullStoryAtSuffix: " lesen",
    aboutNutsNews: "Über NutsNews",
  },
  de: {
    publishedRecently: "Kürzlich veröffentlicht",
    fallbackCategory: "Aufmunternd",
    backToHome: "Zurück zu NutsNews",
    summaryNote:
      "NutsNews bietet eine kurze eigene Zusammenfassung und leitet Leserinnen und Leser für die vollständige Geschichte zum ursprünglichen Verlag zurück.",
    readFullStory: "Vollständige Geschichte lesen",
    readFullStoryAtPrefix: "Vollständige Geschichte bei ",
    readFullStoryAtSuffix: " lesen",
    aboutNutsNews: "Über NutsNews",
  },
  el: {
    publishedRecently: "Δημοσιεύτηκε πρόσφατα",
    fallbackCategory: "Αισιόδοξο",
    backToHome: "Επιστροφή στο NutsNews",
    summaryNote:
      "Το NutsNews προσφέρει μια σύντομη πρωτότυπη σύνοψη και στέλνει τους αναγνώστες στον αρχικό εκδότη για την πλήρη ιστορία.",
    readFullStory: "Διαβάστε την πλήρη ιστορία",
    readFullStoryAtPrefix: "Διαβάστε την πλήρη ιστορία στο ",
    readFullStoryAtSuffix: "",
    aboutNutsNews: "Σχετικά με το NutsNews",
  },
};

function formatDate(
  dateValue: string | null,
  languageCode: LanguageCode,
  copy: (typeof articleDetailCopyByLanguage)[LanguageCode],
) {
  if (!dateValue) {
    return copy.publishedRecently;
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
  const copy =
    articleDetailCopyByLanguage[visibleLanguageCode] ??
    articleDetailCopyByLanguage.en;
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
    copy,
  );
  const categoryLabel = visibleArticle.category ?? copy.fallbackCategory;
  const readFullStoryLabel = [
    copy.readFullStoryAtPrefix,
    publisherAttribution.publisherName,
    copy.readFullStoryAtSuffix,
  ].join("");

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
            &larr; {copy.backToHome}
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
                aria-label={`${categoryLabel} | ${visibleArticle.source} | ${siteDate}`}
              >
                {categoryLabel} &middot; {visibleArticle.source} &middot;{" "}
                {siteDate}
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
              {copy.summaryNote}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={visibleArticle.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-neutral-950 transition hover:bg-amber-300"
                aria-label={`${readFullStoryLabel}: ${visibleArticle.title}`}
                title={copy.summaryNote}
              >
                {copy.readFullStory}
              </a>

              <Link
                href="/about"
                className="rounded-full border border-amber-400/30 bg-black/20 px-5 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/10"
              >
                {copy.aboutNutsNews}
              </Link>
            </div>
          </section>
        </article>
      </section>

      <SiteFooter />
    </main>
  );
}
