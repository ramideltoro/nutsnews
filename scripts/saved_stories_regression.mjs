import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(source, fragment, label) {
  assert.match(
    source,
    new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `${label} must include ${fragment}`,
  );
}

function assertExcludes(source, fragment, label) {
  assert.doesNotMatch(
    source,
    new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `${label} must not include ${fragment}`,
  );
}

const savedStories = read("web/lib/savedStories.ts");
const savedButton = read("web/app/components/SavedStoryButton.tsx");
const savedPage = read("web/app/saved/SavedStoriesPage.tsx");
const savedRoute = read("web/app/saved/page.tsx");
const articleFeed = read("web/app/components/ArticleFeed.tsx");
const siteFooter = read("web/app/components/SiteFooter.tsx");
const privacyPolicy = read("web/app/privacy/LocalizedPrivacyPolicyPage.tsx");
const privacyRoute = read("web/app/privacy/page.tsx");
const componentTests = read("web/tests/component/public-ui.test.tsx");
const i18nTests = read("web/tests/i18n/ui-copy.test.ts");
const packageJson = JSON.parse(read("web/package.json"));

for (const fragment of [
  "SAVED_STORIES_STORAGE_KEY",
  "nutsnews.web.saved-stories",
  "SAVED_STORIES_CHANGE_EVENT",
  "SAVED_STORIES_LIMIT = 100",
  "window.localStorage",
  "SavedStoryInput",
  "createSavedStory",
  "readSavedStories",
  "readSavedStoriesFromSnapshot",
  "subscribeToSavedStories",
  "getSavedStoriesStorageSnapshot",
  "toggleSavedStory",
  "savedStoryToArticle",
]) {
  assertIncludes(savedStories, fragment, "saved stories storage helper");
}

for (const fragment of ["fetch(", "getSupabase", "document.cookie"]) {
  assertExcludes(savedStories, fragment, "saved stories storage helper");
}

for (const fragment of [
  "SavedStoryButton",
  "aria-pressed={isSaved}",
  "useSyncExternalStore",
  "subscribeToSavedStories",
  "toggleSavedStory(article)",
]) {
  assertIncludes(savedButton, fragment, "saved story button");
}

for (const fragment of [
  "<SavedStoryButton",
  "wp-article-card__save",
  "saveStoryAria",
  "unsaveStoryAria",
]) {
  assertIncludes(articleFeed, fragment, "article feed saved controls");
}

for (const fragment of [
  "href=\"/saved\"",
  "saved: \"Saved\"",
]) {
  assertIncludes(siteFooter, fragment, "footer saved link");
}

for (const fragment of [
  "readSavedStoriesFromSnapshot(storageSnapshot)",
  "SavedStoriesPage",
  "useSyncExternalStore",
  "subscribeToSavedStories",
  "data-testid=\"nutsnews-saved-story-card\"",
  "savedStoriesCopyByLanguage",
  "<SiteFooter />",
]) {
  assertIncludes(savedPage, fragment, "saved stories page");
}

for (const fragment of ["fetch(", "getSupabase", "/api/"]) {
  assertExcludes(savedPage, fragment, "saved stories page");
}

for (const fragment of [
  "robots",
  "index: false",
  "canonical: \"/saved\"",
]) {
  assertIncludes(savedRoute, fragment, "saved route metadata");
}

for (const fragment of [
  "saved website stories",
  "saved-story card data",
  "liked or saved stories",
  "saved stories, searches",
]) {
  assertIncludes(privacyPolicy, fragment, "privacy saved stories disclosure");
}

assertIncludes(privacyRoute, "saved stories", "privacy metadata");
assertIncludes(componentTests, "SAVED_STORIES_STORAGE_KEY", "component tests");
assertIncludes(componentTests, "SavedStoriesPage", "component tests");
assertIncludes(i18nTests, "savedStoriesCopyByLanguage", "i18n tests");

assert.equal(
  packageJson.scripts?.["test:saved-stories"],
  "node ../scripts/saved_stories_regression.mjs",
  "web/package.json is missing test:saved-stories",
);

console.log("Saved stories regression checks passed.");
