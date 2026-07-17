"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import {
  getSavedStoriesServerSnapshot,
  getSavedStoriesStorageSnapshot,
  getSavedStoryKey,
  readSavedStoriesFromSnapshot,
  subscribeToSavedStories,
  toggleSavedStory,
  type SavedStoryInput,
} from "@/lib/savedStories";

export type SavedStoryButtonCopy = {
  saveStory: string;
  savedStory: string;
  saveStoryUnavailable: string;
  saveStoryAria: (title: string) => string;
  unsaveStoryAria: (title: string) => string;
};

function BookmarkIcon({
  className = "",
  filled,
}: {
  className?: string;
  filled: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function SavedStoryButton({
  article,
  copy,
  className = "",
}: {
  article: SavedStoryInput;
  copy: SavedStoryButtonCopy;
  className?: string;
}) {
  const [hasStorageError, setHasStorageError] = useState(false);
  const articleKey = getSavedStoryKey(article);
  const storageSnapshot = useSyncExternalStore(
    subscribeToSavedStories,
    getSavedStoriesStorageSnapshot,
    getSavedStoriesServerSnapshot,
  );
  const isSaved = useMemo(() => {
    if (!articleKey) {
      return false;
    }

    return readSavedStoriesFromSnapshot(storageSnapshot).some(
      (story) => getSavedStoryKey(story) === articleKey,
    );
  }, [articleKey, storageSnapshot]);

  function handleToggleSaved() {
    const result = toggleSavedStory(article);

    if (!result.ok) {
      setHasStorageError(true);
      return;
    }

    setHasStorageError(false);
  }

  return (
    <button
      type="button"
      data-testid="nutsnews-save-story-button"
      className={`saved-story-button ${
        isSaved ? "saved-story-button--active" : ""
      } ${className}`.trim()}
      aria-label={
        isSaved
          ? copy.unsaveStoryAria(article.title)
          : copy.saveStoryAria(article.title)
      }
      aria-pressed={isSaved}
      disabled={!articleKey || hasStorageError}
      title={hasStorageError ? copy.saveStoryUnavailable : undefined}
      onClick={handleToggleSaved}
    >
      <BookmarkIcon className="saved-story-button__icon" filled={isSaved} />
      <span>{isSaved ? copy.savedStory : copy.saveStory}</span>
    </button>
  );
}
