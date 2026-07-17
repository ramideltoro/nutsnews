import type { Article } from "@/lib/articles";
import {
  DEFAULT_LANGUAGE_CODE,
  isSupportedLanguageCode,
  type LanguageCode,
} from "@/lib/languages";

export const SAVED_STORIES_STORAGE_KEY = "nutsnews.web.saved-stories";
export const SAVED_STORIES_CHANGE_EVENT = "nutsnews:saved-stories-changed";
export const SAVED_STORIES_STORAGE_VERSION = 1;
export const SAVED_STORIES_LIMIT = 100;

export type SavedStoryInput = Pick<
  Article,
  | "id"
  | "source"
  | "title"
  | "original_url"
  | "image_url"
  | "published_at"
  | "published_on_site_at"
  | "ai_summary"
  | "category"
  | "language_code"
>;

export type SavedStory = SavedStoryInput & {
  saved_at: string;
};

type SavedStoriesPayload = {
  version: typeof SAVED_STORIES_STORAGE_VERSION;
  stories: SavedStory[];
};

export type SavedStoryMutationResult = {
  ok: boolean;
  saved: boolean;
  stories: SavedStory[];
  reason?: "invalid_article" | "storage_unavailable" | "persist_failed";
};

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function cleanOptionalText(value: unknown, maxLength: number) {
  return cleanText(value, maxLength) ?? null;
}

function normalizeSavedAt(value: unknown) {
  const cleaned = cleanText(value, 40);
  const parsed = cleaned ? new Date(cleaned) : null;

  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toISOString()
    : new Date().toISOString();
}

function normalizeLanguage(value: unknown): LanguageCode {
  return typeof value === "string" && isSupportedLanguageCode(value)
    ? value
    : DEFAULT_LANGUAGE_CODE;
}

export function getSavedStoryKey(
  story: Pick<SavedStoryInput, "id" | "original_url">,
) {
  const id = cleanText(story.id, 200);

  if (id) {
    return `id:${id}`;
  }

  const originalUrl = cleanText(story.original_url, 1000);
  return originalUrl ? `url:${originalUrl}` : null;
}

function normalizeSavedStory(value: unknown): SavedStory | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = cleanText(value.id, 200);
  const source = cleanText(value.source, 140);
  const title = cleanText(value.title, 240);
  const originalUrl = cleanText(value.original_url, 1000);

  if (!id || !source || !title || !originalUrl) {
    return null;
  }

  return {
    id,
    source,
    title,
    original_url: originalUrl,
    image_url: cleanOptionalText(value.image_url, 1000),
    published_at: cleanOptionalText(value.published_at, 80),
    published_on_site_at: cleanOptionalText(value.published_on_site_at, 80),
    ai_summary: cleanOptionalText(value.ai_summary, 700),
    category: cleanOptionalText(value.category, 120),
    language_code: normalizeLanguage(value.language_code),
    saved_at: normalizeSavedAt(value.saved_at),
  };
}

function normalizeSavedStories(values: unknown[]) {
  const seenKeys = new Set<string>();
  const stories: SavedStory[] = [];

  for (const value of values) {
    const story = normalizeSavedStory(value);
    const storyKey = story ? getSavedStoryKey(story) : null;

    if (!story || !storyKey || seenKeys.has(storyKey)) {
      continue;
    }

    seenKeys.add(storyKey);
    stories.push(story);
  }

  return stories
    .sort((first, second) => second.saved_at.localeCompare(first.saved_at))
    .slice(0, SAVED_STORIES_LIMIT);
}

function parseSavedStoriesPayload(rawPayload: string | null) {
  if (!rawPayload) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawPayload) as unknown;

    if (!isRecord(parsed) || !Array.isArray(parsed.stories)) {
      return [];
    }

    return normalizeSavedStories(parsed.stories);
  } catch {
    return [];
  }
}

export function readSavedStoriesFromSnapshot(rawPayload: string | null) {
  return parseSavedStoriesPayload(rawPayload);
}

export function getSavedStoriesStorageSnapshot() {
  const storage = getBrowserStorage();

  if (!storage) {
    return "";
  }

  try {
    return storage.getItem(SAVED_STORIES_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function getSavedStoriesServerSnapshot() {
  return "";
}

export function subscribeToSavedStories(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  function handleSavedStoriesChanged() {
    onStoreChange();
  }

  function handleStorage(event: StorageEvent) {
    if (event.key === SAVED_STORIES_STORAGE_KEY) {
      onStoreChange();
    }
  }

  window.addEventListener(SAVED_STORIES_CHANGE_EVENT, handleSavedStoriesChanged);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(
      SAVED_STORIES_CHANGE_EVENT,
      handleSavedStoriesChanged,
    );
    window.removeEventListener("storage", handleStorage);
  };
}

function emitSavedStoriesChanged(stories: SavedStory[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(SAVED_STORIES_CHANGE_EVENT, {
      detail: { stories },
    }),
  );
}

function persistSavedStories(
  stories: SavedStory[],
): Omit<SavedStoryMutationResult, "saved"> {
  const storage = getBrowserStorage();

  if (!storage) {
    return {
      ok: false,
      stories: [],
      reason: "storage_unavailable",
    };
  }

  const normalizedStories = normalizeSavedStories(stories);
  const payload: SavedStoriesPayload = {
    version: SAVED_STORIES_STORAGE_VERSION,
    stories: normalizedStories,
  };

  try {
    storage.setItem(SAVED_STORIES_STORAGE_KEY, JSON.stringify(payload));
    emitSavedStoriesChanged(normalizedStories);

    return {
      ok: true,
      stories: normalizedStories,
    };
  } catch {
    return {
      ok: false,
      stories: readSavedStories(),
      reason: "persist_failed",
    };
  }
}

export function canUseSavedStoriesStorage() {
  return getBrowserStorage() !== null;
}

export function readSavedStories() {
  const storage = getBrowserStorage();

  if (!storage) {
    return [];
  }

  try {
    return readSavedStoriesFromSnapshot(
      storage.getItem(SAVED_STORIES_STORAGE_KEY),
    );
  } catch {
    return [];
  }
}

export function createSavedStory(article: SavedStoryInput): SavedStory | null {
  const story = normalizeSavedStory({
    id: article.id,
    source: article.source,
    title: article.title,
    original_url: article.original_url,
    image_url: article.image_url,
    published_at: article.published_at,
    published_on_site_at: article.published_on_site_at,
    ai_summary: article.ai_summary,
    category: article.category,
    language_code: article.language_code,
    saved_at: new Date().toISOString(),
  });

  return story && getSavedStoryKey(story) ? story : null;
}

export function isStorySaved(article: Pick<SavedStoryInput, "id" | "original_url">) {
  const articleKey = getSavedStoryKey(article);

  if (!articleKey) {
    return false;
  }

  return readSavedStories().some(
    (story) => getSavedStoryKey(story) === articleKey,
  );
}

export function saveStory(article: SavedStoryInput): SavedStoryMutationResult {
  const story = createSavedStory(article);
  const storyKey = story ? getSavedStoryKey(story) : null;

  if (!story || !storyKey) {
    return {
      ok: false,
      saved: false,
      stories: readSavedStories(),
      reason: "invalid_article",
    };
  }

  const nextStories = [
    story,
    ...readSavedStories().filter(
      (savedStory) => getSavedStoryKey(savedStory) !== storyKey,
    ),
  ];
  const result = persistSavedStories(nextStories);

  return {
    ...result,
    saved: result.ok,
  };
}

export function unsaveStory(
  article: Pick<SavedStoryInput, "id" | "original_url">,
): SavedStoryMutationResult {
  const articleKey = getSavedStoryKey(article);

  if (!articleKey) {
    return {
      ok: false,
      saved: false,
      stories: readSavedStories(),
      reason: "invalid_article",
    };
  }

  const nextStories = readSavedStories().filter(
    (story) => getSavedStoryKey(story) !== articleKey,
  );
  const result = persistSavedStories(nextStories);

  return {
    ...result,
    saved: false,
  };
}

export function toggleSavedStory(article: SavedStoryInput) {
  return isStorySaved(article) ? unsaveStory(article) : saveStory(article);
}

export function savedStoryToArticle(story: SavedStory): Article {
  return {
    id: story.id,
    source: story.source,
    title: story.title,
    original_url: story.original_url,
    image_url: story.image_url,
    published_at: story.published_at,
    published_on_site_at: story.published_on_site_at,
    ai_summary: story.ai_summary,
    category: story.category,
    positivity_score: null,
    language_code: story.language_code,
  };
}
