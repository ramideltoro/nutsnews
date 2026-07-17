"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

import { OptimizedArticleImage } from "../components/OptimizedArticleImage";
import {
  SavedStoryButton,
  type SavedStoryButtonCopy,
} from "../components/SavedStoryButton";
import { SiteFooter } from "../components/SiteFooter";
import { useSelectedLanguage } from "../components/useSelectedLanguage";
import { dateLocaleByLanguage } from "../components/ArticleFeed";
import { formatPublisherName, getPublisherAttribution } from "@/lib/publisherAttribution";
import {
  getSavedStoriesServerSnapshot,
  getSavedStoriesStorageSnapshot,
  readSavedStoriesFromSnapshot,
  savedStoryToArticle,
  subscribeToSavedStories,
  type SavedStory,
} from "@/lib/savedStories";
import type { LanguageCode } from "@/lib/languages";

type SavedStoriesCopy = SavedStoryButtonCopy & {
  eyebrow: string;
  title: string;
  deck: string;
  count: (count: number) => string;
  emptyTitle: string;
  emptyBody: string;
  homeLink: string;
  readFullStory: string;
  recently: string;
  savedDate: (date: string) => string;
};

export const savedStoriesCopyByLanguage: Record<LanguageCode, SavedStoriesCopy> = {
  en: {
    eyebrow: "On this device",
    title: "Saved Stories",
    deck: "Stories you saved from the NutsNews feed.",
    count: (count) => `${count} saved ${count === 1 ? "story" : "stories"}`,
    emptyTitle: "No saved stories yet",
    emptyBody: "Save stories from the feed and they will appear here.",
    homeLink: "Back to Top Stories",
    readFullStory: "Read full story",
    recently: "Recently",
    savedDate: (date) => `Saved ${date}`,
    saveStory: "Save",
    savedStory: "Saved",
    saveStoryUnavailable: "Saved stories are unavailable in this browser.",
    saveStoryAria: (title) => `Save story: ${title}`,
    unsaveStoryAria: (title) => `Remove saved story: ${title}`,
  },
  fr: {
    eyebrow: "Sur cet appareil",
    title: "Histoires enregistrées",
    deck: "Les histoires que vous avez enregistrées depuis le fil NutsNews.",
    count: (count) =>
      `${count} histoire${count === 1 ? "" : "s"} enregistrée${count === 1 ? "" : "s"}`,
    emptyTitle: "Aucune histoire enregistrée",
    emptyBody:
      "Enregistrez des histoires depuis le fil et elles apparaîtront ici.",
    homeLink: "Retour à la une",
    readFullStory: "Lire l’article complet",
    recently: "Récemment",
    savedDate: (date) => `Enregistré le ${date}`,
    saveStory: "Enregistrer",
    savedStory: "Enregistré",
    saveStoryUnavailable:
      "Les histoires enregistrées ne sont pas disponibles dans ce navigateur.",
    saveStoryAria: (title) => `Enregistrer l’histoire : ${title}`,
    unsaveStoryAria: (title) => `Retirer l’histoire enregistrée : ${title}`,
  },
  ja: {
    eyebrow: "この端末",
    title: "保存済みストーリー",
    deck: "NutsNewsフィードから保存したストーリーです。",
    count: (count) => `保存済み ${count}件`,
    emptyTitle: "保存済みストーリーはまだありません",
    emptyBody: "フィードでストーリーを保存すると、ここに表示されます。",
    homeLink: "トップストーリーに戻る",
    readFullStory: "元の記事を読む",
    recently: "最近",
    savedDate: (date) => `保存日 ${date}`,
    saveStory: "保存",
    savedStory: "保存済み",
    saveStoryUnavailable:
      "このブラウザでは保存済みストーリーを利用できません。",
    saveStoryAria: (title) => `ストーリーを保存: ${title}`,
    unsaveStoryAria: (title) => `保存済みストーリーを削除: ${title}`,
  },
  "de-CH": {
    eyebrow: "Auf diesem Gerät",
    title: "Gespeicherte Geschichten",
    deck: "Geschichten, die du im NutsNews-Feed gespeichert hast.",
    count: (count) =>
      `${count} gespeicherte Geschichte${count === 1 ? "" : "n"}`,
    emptyTitle: "Noch keine gespeicherten Geschichten",
    emptyBody:
      "Speichere Geschichten aus dem Feed, dann erscheinen sie hier.",
    homeLink: "Zurück zu Top-Geschichten",
    readFullStory: "Ganze Geschichte lesen",
    recently: "Kürzlich",
    savedDate: (date) => `Gespeichert am ${date}`,
    saveStory: "Speichern",
    savedStory: "Gespeichert",
    saveStoryUnavailable:
      "Gespeicherte Geschichten sind in diesem Browser nicht verfügbar.",
    saveStoryAria: (title) => `Geschichte speichern: ${title}`,
    unsaveStoryAria: (title) => `Gespeicherte Geschichte entfernen: ${title}`,
  },
  de: {
    eyebrow: "Auf diesem Gerät",
    title: "Gespeicherte Geschichten",
    deck: "Geschichten, die du im NutsNews-Feed gespeichert hast.",
    count: (count) =>
      `${count} gespeicherte Geschichte${count === 1 ? "" : "n"}`,
    emptyTitle: "Noch keine gespeicherten Geschichten",
    emptyBody:
      "Speichere Geschichten aus dem Feed, dann erscheinen sie hier.",
    homeLink: "Zurück zu Top-Geschichten",
    readFullStory: "Ganze Geschichte lesen",
    recently: "Kürzlich",
    savedDate: (date) => `Gespeichert am ${date}`,
    saveStory: "Speichern",
    savedStory: "Gespeichert",
    saveStoryUnavailable:
      "Gespeicherte Geschichten sind in diesem Browser nicht verfügbar.",
    saveStoryAria: (title) => `Geschichte speichern: ${title}`,
    unsaveStoryAria: (title) => `Gespeicherte Geschichte entfernen: ${title}`,
  },
  el: {
    eyebrow: "Σε αυτή τη συσκευή",
    title: "Αποθηκευμένες ιστορίες",
    deck: "Ιστορίες που αποθηκεύσατε από τη ροή του NutsNews.",
    count: (count) =>
      `${count} αποθηκευμένη ιστορία${count === 1 ? "" : "ες"}`,
    emptyTitle: "Δεν υπάρχουν ακόμα αποθηκευμένες ιστορίες",
    emptyBody:
      "Αποθηκεύστε ιστορίες από τη ροή και θα εμφανιστούν εδώ.",
    homeLink: "Πίσω στις κύριες ιστορίες",
    readFullStory: "Διαβάστε ολόκληρη την ιστορία",
    recently: "Πρόσφατα",
    savedDate: (date) => `Αποθηκεύτηκε ${date}`,
    saveStory: "Αποθήκευση",
    savedStory: "Αποθηκεύτηκε",
    saveStoryUnavailable:
      "Οι αποθηκευμένες ιστορίες δεν είναι διαθέσιμες σε αυτόν τον browser.",
    saveStoryAria: (title) => `Αποθήκευση ιστορίας: ${title}`,
    unsaveStoryAria: (title) =>
      `Αφαίρεση αποθηκευμένης ιστορίας: ${title}`,
  },
};

function formatSiteDate(dateValue: string | null, languageCode: LanguageCode) {
  if (!dateValue) {
    return savedStoriesCopyByLanguage[languageCode].recently;
  }

  const parsedDate = new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return savedStoriesCopyByLanguage[languageCode].recently;
  }

  return new Intl.DateTimeFormat(dateLocaleByLanguage[languageCode], {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsedDate);
}

function SavedStoryCard({
  story,
  index,
  copy,
  languageCode,
}: {
  story: SavedStory;
  index: number;
  copy: SavedStoriesCopy;
  languageCode: LanguageCode;
}) {
  const article = savedStoryToArticle(story);
  const publisherAttribution = getPublisherAttribution(
    article.source,
    article.original_url,
  );
  const publishedDate = formatSiteDate(article.published_on_site_at, languageCode);
  const savedDate = formatSiteDate(story.saved_at, languageCode);

  return (
    <article
      data-testid="nutsnews-saved-story-card"
      className="saved-story-card"
      lang={article.language_code ?? languageCode}
    >
      <a
        href={article.original_url}
        target="_blank"
        rel="noopener noreferrer"
        className="saved-story-card__image"
        aria-label={`${publisherAttribution.readFullStoryLabel}: ${article.title}`}
      >
        <OptimizedArticleImage
          src={article.image_url}
          category={article.category}
          eager={index < 2}
          sizes="(min-width: 768px) 260px, 100vw"
        />
      </a>

      <div className="saved-story-card__body">
        <div className="saved-story-card__meta">
          <span>{formatPublisherName(article.source)}</span>
          <span>{publishedDate}</span>
          <span>{copy.savedDate(savedDate)}</span>
        </div>

        <h2 className="saved-story-card__title">
          <a
            href={article.original_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {article.title}
          </a>
        </h2>

        {article.ai_summary ? (
          <p className="saved-story-card__summary">{article.ai_summary}</p>
        ) : null}

        <div className="saved-story-card__actions">
          <a
            href={article.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="read-story-button saved-story-card__read"
            aria-label={`${publisherAttribution.readFullStoryLabel}: ${article.title}`}
          >
            {copy.readFullStory}
          </a>
          <SavedStoryButton article={article} copy={copy} />
        </div>
      </div>
    </article>
  );
}

export function SavedStoriesPage() {
  const selectedLanguage = useSelectedLanguage();
  const copy = savedStoriesCopyByLanguage[selectedLanguage];
  const storageSnapshot = useSyncExternalStore(
    subscribeToSavedStories,
    getSavedStoriesStorageSnapshot,
    getSavedStoriesServerSnapshot,
  );
  const stories = useMemo(
    () => readSavedStoriesFromSnapshot(storageSnapshot),
    [storageSnapshot],
  );

  const storyCount = useMemo(() => copy.count(stories.length), [copy, stories.length]);

  return (
    <main
      lang={selectedLanguage}
      className="newspaper-home-shell saved-stories-page min-h-screen text-[var(--theme-text)]"
    >
      <div className="newspaper-page-wrap">
        <header className="saved-stories-header">
          <p className="saved-stories-header__eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.deck}</p>
          <div className="saved-stories-header__actions">
            <Link href="/#top-stories" className="read-story-button">
              {copy.homeLink}
            </Link>
            <span aria-live="polite">{storyCount}</span>
          </div>
        </header>

        <section
          className="saved-stories-list"
          data-testid="nutsnews-saved-stories-list"
          aria-label={copy.title}
        >
          {stories.length === 0 ? (
            <div className="saved-stories-empty">
              <h2>{copy.emptyTitle}</h2>
              <p>{copy.emptyBody}</p>
              <Link href="/#top-stories" className="read-story-button">
                {copy.homeLink}
              </Link>
            </div>
          ) : null}

          {stories.map((story, index) => (
            <SavedStoryCard
              key={story.id}
              story={story}
              index={index}
              copy={copy}
              languageCode={selectedLanguage}
            />
          ))}
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
