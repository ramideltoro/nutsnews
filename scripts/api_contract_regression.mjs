#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromWeb = createRequire(path.join(repoRoot, "web", "package.json"));
const ts = requireFromWeb("typescript");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function loadRouteModule(relativePath, mocks = {}) {
  const filename = path.join(repoRoot, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) {
      return mocks[specifier];
    }

    throw new Error(`${relativePath} imported unexpected module: ${specifier}`);
  };
  const wrapper = vm.runInThisContext(
    `(function (exports, require, module, __filename, __dirname) { ${outputText}\n})`,
    { filename },
  );

  wrapper(module.exports, localRequire, module, filename, path.dirname(filename));
  return module.exports;
}

function nextServerMock() {
  return {
    NextRequest: Request,
    NextResponse: {
      json(body, init = {}) {
        const headers = new Headers(init.headers ?? {});
        if (!headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }

        return new Response(JSON.stringify(body), {
          status: init.status ?? 200,
          headers,
        });
      },
    },
  };
}

async function json(response) {
  return response.json();
}

function assertNullableString(value, label) {
  assert(
    value === null || typeof value === "string",
    `${label} must be null or string`,
  );
}

function assertNullableNumber(value, label) {
  assert(
    value === null || typeof value === "number",
    `${label} must be null or number`,
  );
}

function assertArticleContract(article, label) {
  assert.equal(typeof article, "object", `${label} must be an object`);
  assert.equal(typeof article.id, "string", `${label}.id must be string`);
  assert.equal(typeof article.source, "string", `${label}.source must be string`);
  assert.equal(typeof article.title, "string", `${label}.title must be string`);
  assert.equal(
    typeof article.original_url,
    "string",
    `${label}.original_url must be string`,
  );
  assertNullableString(article.image_url, `${label}.image_url`);
  assertNullableString(article.published_at, `${label}.published_at`);
  assertNullableString(
    article.published_on_site_at,
    `${label}.published_on_site_at`,
  );
  assertNullableString(article.ai_summary, `${label}.ai_summary`);
  assertNullableString(article.category, `${label}.category`);
  assertNullableNumber(article.positivity_score, `${label}.positivity_score`);
  assert.equal(
    typeof article.language_code,
    "string",
    `${label}.language_code must be string`,
  );
  assert.equal(
    typeof article.requested_language_code,
    "string",
    `${label}.requested_language_code must be string`,
  );
  assert.equal(
    typeof article.translation_available,
    "boolean",
    `${label}.translation_available must be boolean`,
  );
}

function assertArticlesPayloadContract(payload, label) {
  assert(Array.isArray(payload.articles), `${label}.articles must be an array`);
  for (const [index, article] of payload.articles.entries()) {
    assertArticleContract(article, `${label}.articles[${index}]`);
  }
  assert(
    payload.nextPage === null || typeof payload.nextPage === "number",
    `${label}.nextPage must be null or number`,
  );
  assert(
    payload.nextCursor === null || typeof payload.nextCursor === "string",
    `${label}.nextCursor must be null or string`,
  );
  assert.equal(
    typeof payload.dataSource,
    "string",
    `${label}.dataSource must be string`,
  );
  assert.equal(
    typeof payload.languageCode,
    "string",
    `${label}.languageCode must be string`,
  );
}

function article(overrides = {}) {
  return {
    id: "article-1",
    source: "Nuts Publisher",
    title: "Neighbors rebuild a community garden",
    original_url: "https://publisher.example/community-garden",
    image_url: "https://cdn.example/community-garden.jpg",
    published_at: "2026-07-01T10:00:00.000Z",
    published_on_site_at: "2026-07-02T10:00:00.000Z",
    ai_summary: "Neighbors restored a public garden together.",
    category: "Community | Wellness",
    positivity_score: 0.91,
    language_code: "en",
    requested_language_code: "en",
    translation_available: true,
    ...overrides,
  };
}

const cacheHeadersMock = {
  ARTICLE_API_CACHE_HEADERS: {
    "Cache-Control": "public, s-maxage=300",
    "CDN-Cache-Control": "public, s-maxage=3600",
    "Cloudflare-CDN-Cache-Control": "public, s-maxage=3600",
    "Vercel-CDN-Cache-Control": "public, s-maxage=3600",
    "X-NutsNews-Cache-Policy": "public-api-cache-3600s",
  },
  BYPASS_CACHE_HEADERS: {
    "Cache-Control": "no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    "X-NutsNews-Cache-Policy": "bypass-cache",
  },
  PUBLIC_CDN_S_MAXAGE_SECONDS: 3600,
};

const languagesMock = {
  normalizeLanguageCode(value) {
    if (value === "fr" || value === "ja" || value === "de-CH") {
      return value;
    }

    return "en";
  },
};

const loggerMock = {
  async logError() {},
  async logInfoSampled() {},
};

async function testArticlesApiContract() {
  const calls = [];
  const articlesRoute = loadRouteModule("web/app/api/articles/route.ts", {
    "next/server": nextServerMock(),
    "@/lib/articles": {
      CURSOR_PAGE_SIZE: 15,
      PAGE_SIZE: 5,
      async getPublishedArticlesByCursor(cursor, category, languageCode) {
        calls.push({ name: "cursor", cursor, category, languageCode });
        return {
          articles: [
            article({
              id: "article-cursor",
              language_code: "en",
              requested_language_code: "ja",
              translation_available: false,
            }),
          ],
          nextPage: null,
          nextCursor: "next-cursor-token",
          dataSource: "articles_fallback",
          languageCode,
        };
      },
    },
    "@/lib/edgeFeedSnapshot": {
      async getEdgeFeedSnapshotPage() {
        throw new Error("edge fallback should not be used in happy path");
      },
      async getHomeFeedDataWithEdgeFallback(languageCode) {
        calls.push({ name: "home", languageCode });
        return {
          articles: [article()],
          nextPage: null,
          nextCursor: "home-next-cursor",
          dataSource: "public_feed_snapshot",
          languageCode,
          sections: [],
        };
      },
      async getPublishedArticlesWithEdgeFallback(page, category, languageCode) {
        calls.push({ name: "offset", page, category, languageCode });
        return {
          articles: [article({ requested_language_code: languageCode })],
          nextPage: 1,
          nextCursor: "offset-next-cursor",
          dataSource: "public_feed_snapshot",
          languageCode,
          edgeSnapshot: {
            status: "hit",
            updatedAt: "2026-07-04T12:00:00.000Z",
            ageSeconds: 10,
            articleCount: 5,
            version: 1,
          },
        };
      },
    },
    "@/lib/languages": languagesMock,
    "@/lib/cacheHeaders": cacheHeadersMock,
    "@/lib/logger": loggerMock,
  });

  const offsetResponse = await articlesRoute.GET(
    new Request("https://www.nutsnews.com/api/articles?page=0&lang=fr"),
  );
  assert.equal(offsetResponse.status, 200);
  assert.equal(offsetResponse.headers.get("X-NutsNews-Article-Pagination"), "offset");
  assert.equal(offsetResponse.headers.get("X-NutsNews-Article-Language"), "fr");
  const offsetPayload = await json(offsetResponse);
  assertArticlesPayloadContract(offsetPayload, "/api/articles offset");
  assert.equal(offsetPayload.nextPage, 1);
  assert.equal(offsetPayload.nextCursor, "offset-next-cursor");
  assert.equal(offsetPayload.languageCode, "fr");
  assert.equal(offsetPayload.articles[0].requested_language_code, "fr");

  const cursorResponse = await articlesRoute.GET(
    new Request("https://www.nutsnews.com/api/articles?cursor=cursor-token&lang=ja"),
  );
  assert.equal(cursorResponse.status, 200);
  assert.equal(cursorResponse.headers.get("X-NutsNews-Article-Pagination"), "cursor");
  const cursorPayload = await json(cursorResponse);
  assertArticlesPayloadContract(cursorPayload, "/api/articles cursor");
  assert.equal(cursorPayload.nextPage, null);
  assert.equal(cursorPayload.nextCursor, "next-cursor-token");
  assert.equal(cursorPayload.articles[0].language_code, "en");
  assert.equal(cursorPayload.articles[0].requested_language_code, "ja");
  assert.equal(cursorPayload.articles[0].translation_available, false);

  assert.deepEqual(
    calls.map((call) => call.name),
    ["offset", "cursor"],
    "/api/articles must choose offset and cursor pagination helpers",
  );
}

async function testSearchApiContract() {
  const searchRoute = loadRouteModule("web/app/api/search/route.ts", {
    "next/server": nextServerMock(),
    "@/lib/articles": {
      SEARCH_PAGE_SIZE: 20,
      async searchPublishedArticles(query, page, pageSize, languageCode) {
        if (query.length < 2) {
          return {
            articles: [],
            nextPage: null,
            query,
            page,
            pageSize,
            languageCode,
          };
        }

        return {
          articles: [article({ id: "search-1", requested_language_code: languageCode })],
          nextPage: null,
          query,
          page,
          pageSize,
          languageCode,
        };
      },
    },
    "@/lib/cacheHeaders": cacheHeadersMock,
    "@/lib/languages": languagesMock,
    "@/lib/logger": loggerMock,
    "@/lib/runtimeFeatureFlags": {
      async isRuntimeFeatureFlagEnabled() {
        return true;
      },
    },
  });

  const emptyResponse = await searchRoute.GET(
    new Request("https://www.nutsnews.com/api/search?q=a&page=2&limit=7&lang=de-CH"),
  );
  assert.equal(emptyResponse.status, 200);
  const emptyPayload = await json(emptyResponse);
  assert.deepEqual(emptyPayload.articles, []);
  assert.equal(emptyPayload.nextPage, null);
  assert.equal(emptyPayload.query, "a");
  assert.equal(emptyPayload.page, 2);
  assert.equal(emptyPayload.pageSize, 7);
  assert.equal(emptyPayload.languageCode, "de-CH");

  const resultResponse = await searchRoute.GET(
    new Request("https://www.nutsnews.com/api/search?q=community%20wins&limit=3&lang=fr"),
  );
  assert.equal(resultResponse.status, 200);
  assert.equal(resultResponse.headers.get("X-NutsNews-Search-Fields"), "title,ai_summary,source,category");
  const resultPayload = await json(resultResponse);
  assert(Array.isArray(resultPayload.articles), "/api/search.articles must be an array");
  assertArticleContract(resultPayload.articles[0], "/api/search.articles[0]");
  assert.equal(resultPayload.query, "community wins");
  assert.equal(resultPayload.page, 0);
  assert.equal(resultPayload.pageSize, 3);
  assert.equal(resultPayload.languageCode, "fr");
}

async function testSitemapAndRobotsContracts() {
  const articlesMock = {
    SITE_URL: "https://www.nutsnews.com",
    async getRecentArticleSitemapItems() {
      return [
        {
          id: "article-1",
          published_on_site_at: "2026-07-02T10:00:00.000Z",
          published_at: "2026-07-01T10:00:00.000Z",
        },
      ];
    },
  };
  const sitemapModule = loadRouteModule("web/app/sitemap.ts", {
    "@/lib/articles": articlesMock,
  });
  const robotsModule = loadRouteModule("web/app/robots.ts", {
    "@/lib/articles": articlesMock,
  });

  const sitemap = await sitemapModule.default();
  assert(Array.isArray(sitemap), "sitemap must return an array");
  const urls = sitemap.map((entry) => entry.url);
  for (const requiredUrl of [
    "https://www.nutsnews.com",
    "https://www.nutsnews.com/apps",
    "https://www.nutsnews.com/privacy",
    "https://www.nutsnews.com/contact",
    "https://www.nutsnews.com/articles/article-1",
  ]) {
    assert(urls.includes(requiredUrl), `sitemap missing ${requiredUrl}`);
  }
  for (const [index, entry] of sitemap.entries()) {
    assert.equal(typeof entry.url, "string", `sitemap[${index}].url must be string`);
    assert(entry.lastModified instanceof Date, `sitemap[${index}].lastModified must be Date`);
    assert.equal(typeof entry.changeFrequency, "string", `sitemap[${index}].changeFrequency must be string`);
    assert.equal(typeof entry.priority, "number", `sitemap[${index}].priority must be number`);
  }

  const robots = robotsModule.default();
  assert(Array.isArray(robots.rules), "robots.rules must be an array");
  assert.equal(robots.rules[0].userAgent, "*");
  assert.equal(robots.rules[0].allow, "/");
  assert(robots.rules[0].disallow.includes("/api/"), "robots must disallow /api/");
  assert.equal(robots.sitemap, "https://www.nutsnews.com/sitemap.xml");
}

async function testContactApiValidationWithoutEmail() {
  const originalFetch = globalThis.fetch;
  const originalTurnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  const originalResendKey = process.env.RESEND_API_KEY;
  const fetchCalls = [];
  globalThis.fetch = async (...args) => {
    fetchCalls.push(args);
    throw new Error("Contact contract tests must not send network requests.");
  };
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.RESEND_API_KEY;

  try {
    const contactRoute = loadRouteModule("web/app/api/contact/route.ts", {
      "next/server": nextServerMock(),
      "@/lib/cacheHeaders": cacheHeadersMock,
      "@/lib/quotaUsage": {
        async recordQuotaUsageEvent() {
          throw new Error("Quota usage should only record after a successful email send.");
        },
      },
    });

    const badEmailResponse = await contactRoute.POST(
      new Request("https://www.nutsnews.com/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "not-an-email",
          message: "This message is long enough.",
          turnstileToken: "token",
        }),
      }),
    );
    assert.equal(badEmailResponse.status, 400);
    assert.equal(typeof (await json(badEmailResponse)).error, "string");

    const honeypotResponse = await contactRoute.POST(
      new Request("https://www.nutsnews.com/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "reader@example.com",
          message: "This message is long enough.",
          website: "https://bot.example",
          turnstileToken: "token",
        }),
      }),
    );
    assert.equal(honeypotResponse.status, 200);
    assert.deepEqual(await json(honeypotResponse), { ok: true });

    const unconfiguredResponse = await contactRoute.POST(
      new Request("https://www.nutsnews.com/api/contact", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.10",
        },
        body: JSON.stringify({
          email: "reader@example.com",
          message: "This message is long enough.",
          turnstileToken: "token",
        }),
      }),
    );
    assert.equal(unconfiguredResponse.status, 503);
    assert.equal(typeof (await json(unconfiguredResponse)).error, "string");
    assert.equal(fetchCalls.length, 0, "contact validation tests must not call fetch or send email");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalTurnstileSecret === undefined) {
      delete process.env.TURNSTILE_SECRET_KEY;
    } else {
      process.env.TURNSTILE_SECRET_KEY = originalTurnstileSecret;
    }

    if (originalResendKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalResendKey;
    }
  }
}

function testScriptIsRegistered() {
  const packageJson = JSON.parse(read("web/package.json"));
  assert.equal(
    packageJson.scripts?.["test:api-contracts"],
    "node ../scripts/api_contract_regression.mjs",
    "web/package.json must expose the API contract regression test.",
  );
}

try {
  await testArticlesApiContract();
  await testSearchApiContract();
  await testSitemapAndRobotsContracts();
  await testContactApiValidationWithoutEmail();
  testScriptIsRegistered();
  console.log("API contract regression checks passed.");
} catch (error) {
  console.error("API contract regression checks failed.");
  console.error(error?.stack || error);
  process.exitCode = 1;
}
