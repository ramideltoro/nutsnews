#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "web/lib/publisherAttribution.ts",
  "web/app/components/ArticleFeed.tsx",
  "web/app/components/SiteFooter.tsx",
  "web/app/articles/[id]/page.tsx",
  "web/app/articles/[id]/opengraph-image.tsx",
  "web/app/contact/page.tsx",
  "web/app/contact/LocalizedContactPage.tsx",
  "web/package.json",
];

for (const file of requiredFiles) {
  assert.equal(
    existsSync(path.join(root, file)),
    true,
    `Missing required file: ${file}`,
  );
}

function read(file) {
  return readFileSync(path.join(root, file), "utf8");
}

function assertIncludes(file, needle) {
  assert(
    read(file).includes(needle),
    `${file} must include publisher attribution token: ${needle}`,
  );
}

function assertExcludes(file, needle) {
  assert(
    !read(file).includes(needle),
    `${file} must not include publisher attribution regression token: ${needle}`,
  );
}

assertIncludes("web/lib/publisherAttribution.ts", "PUBLISHER_ATTRIBUTION_POLICY_VERSION");
assertIncludes("web/lib/publisherAttribution.ts", "PUBLISHER_ATTRIBUTION_POLICY_SUMMARY");
assertIncludes("web/lib/publisherAttribution.ts", "PUBLISHER_REMOVAL_CONTACT_PATH");
assertIncludes("web/lib/publisherAttribution.ts", "formatPublisherName");
assertIncludes("web/lib/publisherAttribution.ts", "getPublisherAttribution");
assertIncludes("web/lib/publisherAttribution.ts", "Google\\s+News");
assertIncludes("web/lib/publisherAttribution.ts", "topic=publisher-removal");

assertIncludes("web/app/components/ArticleFeed.tsx", "formatPublisherName");
assertIncludes("web/app/components/ArticleFeed.tsx", "getPublisherAttribution");
assertIncludes("web/app/components/ArticleFeed.tsx", "publisherAttribution.readFullStoryLabel");
assertIncludes("web/app/components/ArticleFeed.tsx", 'rel="noopener noreferrer"');

assertIncludes("web/app/components/SiteFooter.tsx", "formatPublisherName");
assertIncludes("web/app/components/SiteFooter.tsx", "getPublisherAttribution");
assertIncludes("web/app/components/SiteFooter.tsx", "publisherAttribution.readFullStoryLabel");
assertIncludes("web/app/components/SiteFooter.tsx", 'rel="noopener noreferrer"');

assertIncludes("web/app/articles/[id]/page.tsx", "getPublisherAttribution");
assertIncludes("web/app/articles/[id]/page.tsx", "authors: [");
assertIncludes("web/app/articles/[id]/page.tsx", "nutsnews:publisher");
assertIncludes("web/app/articles/[id]/page.tsx", "nutsnews:publisher-url");
assertIncludes("web/app/articles/[id]/page.tsx", "nutsnews:attribution-policy-version");
assertIncludes("web/app/articles/[id]/page.tsx", "citation: article.original_url");
assertIncludes("web/app/articles/[id]/page.tsx", "creditText: publisherAttribution.policySummary");
assertIncludes("web/app/articles/[id]/page.tsx", 'const socialImageUrl = "/opengraph-image"');

assertIncludes("web/app/articles/[id]/opengraph-image.tsx", "Publisher credited");
assertIncludes("web/app/articles/[id]/opengraph-image.tsx", "Positive news");
assertExcludes("web/app/articles/[id]/opengraph-image.tsx", "getArticleById");

assertIncludes("web/app/contact/page.tsx", "source removal requests");
assertIncludes("web/app/contact/LocalizedContactPage.tsx", "publisher correction");
assertIncludes("web/app/contact/LocalizedContactPage.tsx", "source removal request");

const packageJson = JSON.parse(read("web/package.json"));
assert.equal(
  packageJson.scripts?.["test:publisher-attribution"],
  "node ../scripts/publisher_attribution_regression.mjs",
  "web/package.json must expose test:publisher-attribution",
);

console.log("Publisher attribution regression checks passed.");
