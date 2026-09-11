import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
assert.match(read("web/app/saved/page.tsx"), /permanentRedirect\("\/"\)/);
for (const path of ["web/app/components/ArticleFeed.tsx", "web/app/components/SiteFooter.tsx"]) {
  assert.doesNotMatch(read(path), /SavedStoryButton|href: "\/saved"/);
}
for (const path of ["web/lib/savedStories.ts", "web/app/components/SavedStoryButton.tsx", "web/app/saved/SavedStoriesPage.tsx"]) {
  assert.equal(existsSync(fileURLToPath(new URL("../" + path, import.meta.url))), false);
}
console.log("Retired saved stories regression checks passed.");
