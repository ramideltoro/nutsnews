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

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const ARTICLE_DATA_SOURCES = new Set([
  "public_feed_snapshot",
  "articles_fallback",
  "edge_feed_snapshot",
]);
const EDGE_SNAPSHOT_STATUSES = new Set(["hit", "miss", "unconfigured", "unbound", "empty", "error"]);
const LANGUAGE_CODES = new Set(["en", "fr", "ja", "de-CH", "de", "el"]);
const HOME_SECTION_IDS = [
  "community",
  "animals",
  "science",
  "wellness",
  "travel",
  "culture",
  "achievements",
];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function walkFiles(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(relativePath));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

function loadModule(relativePath, mocks = {}) {
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
  const loadedModule = { exports: {} };
  const nativeRequire = createRequire(filename);
  const localRequire = (specifier) => {
    if (Object.hasOwn(mocks, specifier)) {
      return mocks[specifier];
    }

    if (specifier.startsWith("node:")) {
      return nativeRequire(specifier);
    }

    throw new Error(`${relativePath} imported unexpected module: ${specifier}`);
  };
  const wrapper = vm.runInThisContext(
    `(function (exports, require, module, __filename, __dirname) { ${outputText}\n})`,
    { filename },
  );

  wrapper(loadedModule.exports, localRequire, loadedModule, filename, path.dirname(filename));
  return loadedModule.exports;
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

async function responseJson(response) {
  return response.json();
}

function assertRequiredKeys(value, keys, label) {
  assert.equal(typeof value, "object", `${label} must be an object`);
  assert.notEqual(value, null, `${label} must not be null`);

  for (const key of keys) {
    assert(Object.hasOwn(value, key), `${label} is missing required key ${key}`);
  }
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

function assertStatus(response, expected, label) {
  assert.equal(response.status, expected, `${label} returned an incompatible HTTP status`);
}

function assertMethodExports(routeModule, expectedMethods, label) {
  const actualMethods = Object.keys(routeModule)
    .filter((key) => HTTP_METHODS.has(key))
    .sort();

  assert.deepEqual(actualMethods, [...expectedMethods].sort(), `${label} exported incompatible HTTP methods`);
}

function assertArticleContract(value, label) {
  assertRequiredKeys(
    value,
    [
      "id",
      "source",
      "title",
      "original_url",
      "image_url",
      "published_at",
      "published_on_site_at",
      "ai_summary",
      "category",
      "positivity_score",
      "language_code",
      "requested_language_code",
      "translation_available",
    ],
    label,
  );
  assert.equal(typeof value.id, "string", `${label}.id must be string`);
  assert.equal(typeof value.source, "string", `${label}.source must be string`);
  assert.equal(typeof value.title, "string", `${label}.title must be string`);
  assert.equal(typeof value.original_url, "string", `${label}.original_url must be string`);
  assertNullableString(value.image_url, `${label}.image_url`);
  assertNullableString(value.published_at, `${label}.published_at`);
  assertNullableString(value.published_on_site_at, `${label}.published_on_site_at`);
  assertNullableString(value.ai_summary, `${label}.ai_summary`);
  assertNullableString(value.category, `${label}.category`);
  assertNullableNumber(value.positivity_score, `${label}.positivity_score`);
  assert.equal(typeof value.language_code, "string", `${label}.language_code must be string`);
  assert.equal(
    typeof value.requested_language_code,
    "string",
    `${label}.requested_language_code must be string`,
  );
  assert.equal(
    typeof value.translation_available,
    "boolean",
    `${label}.translation_available must be boolean`,
  );
  assert(LANGUAGE_CODES.has(value.language_code), `${label}.language_code has an unsupported enum value`);
  assert(
    LANGUAGE_CODES.has(value.requested_language_code),
    `${label}.requested_language_code has an unsupported enum value`,
  );
}

function assertEdgeSnapshotContract(value, label) {
  assertRequiredKeys(
    value,
    ["status", "updatedAt", "ageSeconds", "articleCount", "version"],
    label,
  );
  assert(EDGE_SNAPSHOT_STATUSES.has(value.status), `${label}.status has an unsupported enum value`);
  assertNullableString(value.updatedAt, `${label}.updatedAt`);
  assertNullableNumber(value.ageSeconds, `${label}.ageSeconds`);
  assertNullableNumber(value.articleCount, `${label}.articleCount`);
  assertNullableNumber(value.version, `${label}.version`);
}

function assertArticlePayloadContract(payload, label) {
  assertRequiredKeys(
    payload,
    ["articles", "nextPage", "nextCursor", "dataSource", "languageCode"],
    label,
  );
  assert(Array.isArray(payload.articles), `${label}.articles must be an array`);

  for (const [index, articleValue] of payload.articles.entries()) {
    assertArticleContract(articleValue, `${label}.articles[${index}]`);
  }

  assert(
    payload.nextPage === null || typeof payload.nextPage === "number",
    `${label}.nextPage must be number or null`,
  );
  assert(
    payload.nextCursor === null || typeof payload.nextCursor === "string",
    `${label}.nextCursor must be string or null`,
  );
  assert(ARTICLE_DATA_SOURCES.has(payload.dataSource), `${label}.dataSource has an unsupported enum value`);
  assert(LANGUAGE_CODES.has(payload.languageCode), `${label}.languageCode has an unsupported enum value`);

  if (Object.hasOwn(payload, "edgeSnapshot") && payload.edgeSnapshot !== null) {
    assertEdgeSnapshotContract(payload.edgeSnapshot, `${label}.edgeSnapshot`);
  }
}

function assertHomeSectionsContract(sections, label) {
  assert(Array.isArray(sections), `${label} must be an array`);
  assert.deepEqual(
    sections.map((section) => section.id),
    HOME_SECTION_IDS,
    `${label} must preserve stable section ordering and enum values`,
  );

  for (const [index, section] of sections.entries()) {
    assertRequiredKeys(section, ["id", "articles"], `${label}[${index}]`);
    assert(Array.isArray(section.articles), `${label}[${index}].articles must be an array`);

    for (const [articleIndex, articleValue] of section.articles.entries()) {
      assertArticleContract(articleValue, `${label}[${index}].articles[${articleIndex}]`);
    }
  }
}

function assertArticleErrorPayload(payload, label, { home = false } = {}) {
  const expected = ["articles", "nextPage", "nextCursor", "error"];

  if (home) {
    expected.push("sections");
  }

  assertRequiredKeys(payload, expected, label);
  assert.deepEqual(payload.articles, [], `${label}.articles must be empty`);
  assert.equal(payload.nextPage, null, `${label}.nextPage must be null`);
  assert.equal(payload.nextCursor, null, `${label}.nextCursor must be null`);
  assert.equal(typeof payload.error, "string", `${label}.error must be string`);

  if (home) {
    assert.deepEqual(payload.sections, [], `${label}.sections must be empty`);
  }
}

function assertSearchPayloadContract(payload, label) {
  assertRequiredKeys(
    payload,
    ["articles", "nextPage", "query", "page", "pageSize", "languageCode"],
    label,
  );
  assert(Array.isArray(payload.articles), `${label}.articles must be an array`);

  for (const [index, articleValue] of payload.articles.entries()) {
    assertArticleContract(articleValue, `${label}.articles[${index}]`);
  }

  assert(
    payload.nextPage === null || typeof payload.nextPage === "number",
    `${label}.nextPage must be number or null`,
  );
  assert.equal(typeof payload.query, "string", `${label}.query must be string`);
  assert.equal(typeof payload.page, "number", `${label}.page must be number`);
  assert.equal(typeof payload.pageSize, "number", `${label}.pageSize must be number`);
  assert(LANGUAGE_CODES.has(payload.languageCode), `${label}.languageCode has an unsupported enum value`);
}

function assertErrorPayload(payload, label) {
  assertRequiredKeys(payload, ["error"], label);
  assert.equal(typeof payload.error, "string", `${label}.error must be string`);
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
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    "CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    "Cloudflare-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    "Vercel-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    "X-NutsNews-Cache-Policy": "public-api-cache-3600s",
    "X-NutsNews-Cache-Issue": "7",
  },
  BYPASS_CACHE_HEADERS: {
    "Cache-Control": "no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    "X-NutsNews-Cache-Policy": "bypass-cache",
    "X-NutsNews-Cache-Issue": "7",
  },
  PUBLIC_CDN_S_MAXAGE_SECONDS: 3600,
};

const languagesMock = {
  normalizeLanguageCode(value) {
    const normalized = value?.trim();
    return LANGUAGE_CODES.has(normalized) ? normalized : "en";
  },
};

const loggerMock = {
  async logError() {},
  async logInfo() {},
  async logInfoSampled() {},
  async logWarn() {},
};

function articleResult({
  articles = [article(), article({ id: "article-2", title: "A second ordered story" })],
  nextPage = 1,
  nextCursor = "next-cursor-token",
  dataSource = "public_feed_snapshot",
  languageCode = "en",
  edgeSnapshot,
} = {}) {
  return {
    articles,
    nextPage,
    nextCursor,
    dataSource,
    languageCode,
    ...(edgeSnapshot ? { edgeSnapshot } : {}),
  };
}

function homeSections(languageCode = "en") {
  return HOME_SECTION_IDS.map((id, index) => ({
    id,
    articles: [
      article({
        id: `section-${id}`,
        title: `A ${id} story`,
        requested_language_code: languageCode,
      }),
    ],
  }));
}

function maintenanceHomeFeed(languageCode = "en") {
  return {
    ...articleResult({
      articles: [],
      nextPage: null,
      nextCursor: null,
      dataSource: "articles_fallback",
      languageCode,
    }),
    sections: HOME_SECTION_IDS.map((id) => ({ id, articles: [] })),
    degradation: {
      mode: "maintenance",
      reason: "home_feed_exception",
      message: "NutsNews is showing a maintenance state while the public feed dependencies recover.",
      services: {
        supabase: "unavailable",
        edgeSnapshot: "unavailable",
        worker: "unknown",
        localAi: "unknown",
        translations: "unknown",
      },
      loggedAt: "2026-07-16T00:00:00.000Z",
    },
  };
}

function loadArticlesRoute(overrides = {}) {
  return loadModule("web/app/api/articles/route.ts", {
    "next/server": nextServerMock(),
    "@/lib/articles": {
      CURSOR_PAGE_SIZE: 15,
      PAGE_SIZE: 5,
      getPublishedArticlesByCursor: async () => articleResult(),
      ...overrides.articles,
    },
    "@/lib/edgeFeedSnapshot": {
      createMaintenanceHomeFeedPayload: (languageCode) =>
        maintenanceHomeFeed(languageCode),
      getEdgeFeedSnapshotPage: async () => null,
      getHomeFeedDataWithEdgeFallback: async (languageCode) => ({
        ...articleResult({ languageCode, nextPage: null, nextCursor: "home-next-cursor" }),
        sections: homeSections(languageCode),
      }),
      getPublishedArticlesWithEdgeFallback: async (_page, _category, languageCode) =>
        articleResult({ languageCode }),
      ...overrides.edgeFeedSnapshot,
    },
    "@/lib/languages": languagesMock,
    "@/lib/cacheHeaders": cacheHeadersMock,
    "@/lib/logger": loggerMock,
  });
}

function testArticleSerializationBaseline() {
  const source = read("web/lib/articles.ts");
  const selectMatch = source.match(/const ARTICLE_SELECT\s*=\s*"([^"]+)"/);
  assert(selectMatch, "Article query projection must remain explicit");
  assert.deepEqual(
    selectMatch[1].split(",").map((field) => field.trim()),
    [
      "id",
      "source",
      "title",
      "original_url",
      "image_url",
      "published_at",
      "published_on_site_at",
      "ai_summary",
      "category",
      "positivity_score",
    ],
    "Database/query changes must not silently remove or rename serialized article fields",
  );
  assert.match(
    source,
    /getRecentArticleSitemapItems[\s\S]*backend_postgres_primary[\s\S]*load-recent-article-sitemap-items/,
    "Recent sitemap helper must use the backend DB API when backend PostgreSQL is primary.",
  );
  assert.match(
    source,
    /getPublishedArticleSitemapCount[\s\S]*backend_postgres_primary[\s\S]*load-published-article-sitemap-count/,
    "Sitemap count helper must use the backend DB API when backend PostgreSQL is primary.",
  );
  assert.match(
    source,
    /getArticleSitemapItemsPage[\s\S]*backend_postgres_primary[\s\S]*load-article-sitemap-items-page/,
    "Article sitemap page helper must use the backend DB API when backend PostgreSQL is primary.",
  );

  const articleTypeMatch = source.match(/export type Article = \{([\s\S]*?)\n\};/);
  assert(articleTypeMatch, "Article response type must remain declared");
  const articleType = articleTypeMatch[1];
  const expectedTypeFields = {
    id: "string",
    source: "string",
    title: "string",
    original_url: "string",
    image_url: "string \\| null",
    published_at: "string \\| null",
    published_on_site_at: "string \\| null",
    ai_summary: "string \\| null",
    category: "string \\| null",
    positivity_score: "number \\| null",
  };

  for (const [field, type] of Object.entries(expectedTypeFields)) {
    assert(
      new RegExp(`\\b${field}\\??:\\s*${type};`).test(articleType),
      `Article response type must preserve ${field} as ${type.replaceAll("\\\\", "")}`,
    );
  }
}

function testInventoryCompleteness() {
  const inventory = readJson("api-contracts/inventory.json");
  assert.equal(inventory.schemaVersion, 1, "API inventory schema version must be explicit");
  assert(Array.isArray(inventory.endpoints), "API inventory endpoints must be an array");
  assert.equal(inventory.endpoints.length, 18, "API inventory must include every supported custom response endpoint");

  const inventoryFiles = inventory.endpoints.map((endpoint) => endpoint.routeFile).sort();
  assert.equal(new Set(inventoryFiles).size, inventoryFiles.length, "API inventory route files must be unique");

  const appRoot = path.join(repoRoot, "web", "app");
  const discoveredFiles = walkFiles(appRoot)
    .filter((filename) => /(?:route\.ts|sitemap\.ts|robots\.ts|opengraph-image\.tsx)$/.test(filename))
    .map((filename) => path.relative(repoRoot, filename))
    .sort();
  assert.deepEqual(
    inventoryFiles,
    discoveredFiles,
    "Every custom route, metadata response, and Open Graph image must have an inventory entry",
  );

  for (const endpoint of inventory.endpoints) {
    assertRequiredKeys(
      endpoint,
      [
        "id",
        "method",
        "path",
        "request",
        "auth",
        "successStatus",
        "successResponseShape",
        "errorStatuses",
        "errorShape",
        "pagination",
        "iosCallSites",
        "testFile",
      ],
      `inventory.${endpoint.id}`,
    );
    assert(Array.isArray(endpoint.method) && endpoint.method.length > 0, `inventory.${endpoint.id}.method must be non-empty`);
    assert(endpoint.method.every((method) => HTTP_METHODS.has(method)), `inventory.${endpoint.id} has an unsupported method`);
    assert(Array.isArray(endpoint.successStatus) && endpoint.successStatus.length > 0, `inventory.${endpoint.id} must declare success statuses`);
    assert(Array.isArray(endpoint.errorStatuses), `inventory.${endpoint.id}.errorStatuses must be an array`);
    assert.equal(
      endpoint.testFile,
      "scripts/api_contract_compatibility_regression.mjs",
      `inventory.${endpoint.id} must map to the comprehensive suite`,
    );
  }

  const iosEntries = inventory.endpoints.filter((endpoint) => endpoint.iosCallSites.length > 0);
  assert.deepEqual(
    iosEntries.map((endpoint) => endpoint.id).sort(),
    ["articles", "search"],
    "All and only current iOS API calls must be mapped to contract coverage",
  );
  assert(
    iosEntries.every((endpoint) => endpoint.iosCallSites.every((callSite) => callSite.file && callSite.lines)),
    "Every iOS call-site mapping must identify source evidence",
  );
}

async function testArticlesContract() {
  const calls = [];
  const articlesRoute = loadArticlesRoute({
    articles: {
      async getPublishedArticlesByCursor(cursor, category, languageCode) {
        calls.push({ helper: "cursor", cursor, category, languageCode });
        return articleResult({
          articles: [article({ id: "cursor-1", requested_language_code: languageCode, translation_available: false })],
          nextPage: null,
          nextCursor: "cursor-next",
          dataSource: "articles_fallback",
          languageCode,
        });
      },
    },
    edgeFeedSnapshot: {
      async getPublishedArticlesWithEdgeFallback(page, category, languageCode) {
        calls.push({ helper: "offset", page, category, languageCode });
        return articleResult({
          languageCode,
          articles: [
            article({ id: "ordered-1", requested_language_code: languageCode }),
            article({ id: "ordered-2", title: "Second", requested_language_code: languageCode }),
          ],
          nextPage: 4,
          nextCursor: "offset-next",
          edgeSnapshot: {
            status: "hit",
            updatedAt: "2026-07-05T12:00:00.000Z",
            ageSeconds: 12,
            articleCount: 30,
            version: 2,
          },
        });
      },
      async getHomeFeedDataWithEdgeFallback(languageCode) {
        calls.push({ helper: "home", languageCode });
        return {
          ...articleResult({
            languageCode,
            articles: [article({ id: "home-main", requested_language_code: languageCode })],
            nextPage: null,
            nextCursor: "home-next",
          }),
          sections: homeSections(languageCode),
        };
      },
    },
  });
  assertMethodExports(articlesRoute, ["GET"], "/api/articles");

  const offsetResponse = await articlesRoute.GET(
    new Request("https://www.nutsnews.com/api/articles?page=3.9&category=Wellness&lang=fr&limit=5"),
  );
  assertStatus(offsetResponse, 200, "/api/articles offset");
  assert.equal(offsetResponse.headers.get("x-nutsnews-article-pagination"), "offset");
  assert.equal(offsetResponse.headers.get("x-nutsnews-article-page-size"), "5");
  assert.equal(offsetResponse.headers.get("x-nutsnews-article-language"), "fr");
  assert.equal(offsetResponse.headers.get("x-nutsnews-article-data-source"), "public_feed_snapshot");
  assert.equal(offsetResponse.headers.get("x-nutsnews-feed-snapshot"), "hit");
  assert.equal(offsetResponse.headers.get("x-nutsnews-edge-snapshot-version"), "2");
  assert.match(offsetResponse.headers.get("cache-control") ?? "", /s-maxage=300/);
  const offsetPayload = await responseJson(offsetResponse);
  assertArticlePayloadContract(offsetPayload, "/api/articles offset");
  assert.equal(offsetPayload.nextPage, 4, "Offset pagination must retain numeric nextPage for iOS");
  assert.equal(offsetPayload.nextCursor, "offset-next");
  assert.deepEqual(
    offsetPayload.articles.map((value) => value.id),
    ["ordered-1", "ordered-2"],
    "Article ordering must pass through the serialized response unchanged",
  );
  assert.deepEqual(calls.at(-1), { helper: "offset", page: 3, category: "Wellness", languageCode: "fr" });

  const widgetResponse = await articlesRoute.GET(
    new Request("https://www.nutsnews.com/api/articles?page=-1&limit=5"),
  );
  assertStatus(widgetResponse, 200, "/api/articles widget query");
  const widgetPayload = await responseJson(widgetResponse);
  assertArticlePayloadContract(widgetPayload, "/api/articles widget payload");
  assert(widgetPayload.articles.length > 0, "Widget response must retain a usable first article");
  assert.deepEqual(calls.at(-1), { helper: "offset", page: 0, category: null, languageCode: "en" });

  const cursorResponse = await articlesRoute.GET(
    new Request("https://www.nutsnews.com/api/articles?cursor=opaque-cursor&category=Animals&lang=ja"),
  );
  assertStatus(cursorResponse, 200, "/api/articles cursor");
  assert.equal(cursorResponse.headers.get("x-nutsnews-article-pagination"), "cursor");
  const cursorPayload = await responseJson(cursorResponse);
  assertArticlePayloadContract(cursorPayload, "/api/articles cursor payload");
  assert.equal(cursorPayload.nextPage, null, "Cursor contract keeps nextPage null");
  assert.equal(cursorPayload.nextCursor, "cursor-next");
  assert.deepEqual(calls.at(-1), { helper: "cursor", cursor: "opaque-cursor", category: "Animals", languageCode: "ja" });

  const homeResponse = await articlesRoute.GET(
    new Request("https://www.nutsnews.com/api/articles?home=1&cursor=ignored&lang=de-CH"),
  );
  assertStatus(homeResponse, 200, "/api/articles home");
  assert.equal(homeResponse.headers.get("x-nutsnews-article-pagination"), "home");
  assert.match(homeResponse.headers.get("x-nutsnews-cache-policy") ?? "", /public-home-feed-cache/);
  const homePayload = await responseJson(homeResponse);
  assertArticlePayloadContract(homePayload, "/api/articles home payload");
  assertRequiredKeys(homePayload, ["sections"], "/api/articles home payload");
  assertHomeSectionsContract(homePayload.sections, "/api/articles home sections");
  assert.deepEqual(calls.at(-1), { helper: "home", languageCode: "de-CH" });

  const emptyRoute = loadArticlesRoute({
    edgeFeedSnapshot: {
      async getPublishedArticlesWithEdgeFallback(_page, _category, languageCode) {
        return articleResult({
          languageCode,
          articles: [],
          nextPage: null,
          nextCursor: null,
        });
      },
    },
  });
  const emptyResponse = await emptyRoute.GET(
    new Request("https://www.nutsnews.com/api/articles?page=1000"),
  );
  assertStatus(emptyResponse, 200, "/api/articles empty page");
  const emptyPayload = await responseJson(emptyResponse);
  assertArticlePayloadContract(emptyPayload, "/api/articles empty page payload");
  assert.deepEqual(emptyPayload.articles, []);
  assert.equal(emptyPayload.nextPage, null);
  assert.equal(emptyPayload.nextCursor, null);

  const invalidFixtureRoute = loadArticlesRoute({
    edgeFeedSnapshot: {
      async getPublishedArticlesWithEdgeFallback(_page, _category, languageCode) {
        return articleResult({
          languageCode,
          articles: [article({ id: 42, title: undefined, requested_language_code: languageCode })],
        });
      },
    },
  });
  const invalidFixturePayload = await responseJson(
    await invalidFixtureRoute.GET(new Request("https://www.nutsnews.com/api/articles")),
  );
  assert.throws(
    () => assertArticlePayloadContract(invalidFixturePayload, "missing/type-incompatible article fixture"),
    /id must be string|missing required key title/,
    "The contract must reject removed or incompatible required article fields",
  );
  assert.throws(
    () => assertStatus({ status: 201 }, 200, "incompatible status fixture"),
    /incompatible HTTP status/,
    "The contract must reject incompatible success statuses",
  );

  const edgeRecoveredRoute = loadArticlesRoute({
    edgeFeedSnapshot: {
      async getPublishedArticlesWithEdgeFallback() {
        throw new Error("primary store unavailable");
      },
      async getEdgeFeedSnapshotPage({ requestedLanguageCode }) {
        return articleResult({
          dataSource: "edge_feed_snapshot",
          languageCode: requestedLanguageCode,
          articles: [article({ id: "edge-1", requested_language_code: requestedLanguageCode })],
          nextPage: 1,
          nextCursor: null,
          edgeSnapshot: {
            status: "hit",
            updatedAt: "2026-07-05T12:00:00.000Z",
            ageSeconds: 9,
            articleCount: 10,
            version: 3,
          },
        });
      },
    },
  });
  const edgeRecoveredResponse = await edgeRecoveredRoute.GET(
    new Request("https://www.nutsnews.com/api/articles?lang=fr"),
  );
  assertStatus(edgeRecoveredResponse, 200, "/api/articles edge recovery");
  const edgeRecoveredPayload = await responseJson(edgeRecoveredResponse);
  assertArticlePayloadContract(edgeRecoveredPayload, "/api/articles edge recovery payload");
  assert.equal(edgeRecoveredPayload.dataSource, "edge_feed_snapshot");
  assertRequiredKeys(edgeRecoveredPayload, ["edgeSnapshot"], "/api/articles edge recovery payload");
  assert.equal(edgeRecoveredPayload.edgeSnapshot.status, "hit");
  assert.equal(typeof edgeRecoveredPayload.edgeSnapshot.version, "number");
  assert.equal(edgeRecoveredResponse.headers.get("x-nutsnews-edge-snapshot"), "hit");
  assert.equal(edgeRecoveredResponse.headers.get("x-nutsnews-edge-snapshot-version"), "3");

  const failedRoute = loadArticlesRoute({
    edgeFeedSnapshot: {
      async getPublishedArticlesWithEdgeFallback() {
        throw new Error("primary store unavailable");
      },
      async getEdgeFeedSnapshotPage() {
        return null;
      },
    },
  });
  const failedResponse = await failedRoute.GET(new Request("https://www.nutsnews.com/api/articles"));
  assertStatus(failedResponse, 500, "/api/articles error");
  assert.match(failedResponse.headers.get("cache-control") ?? "", /no-store/);
  assertArticleErrorPayload(await responseJson(failedResponse), "/api/articles error payload");
}

async function testHomeFeedContract() {
  const calls = [];
  const homeRoute = loadModule("web/app/api/home-feed/route.ts", {
    "next/server": nextServerMock(),
    "@/lib/cacheHeaders": cacheHeadersMock,
    "@/lib/edgeFeedSnapshot": {
      createMaintenanceHomeFeedPayload: (languageCode) =>
        maintenanceHomeFeed(languageCode),
      async getHomeFeedDataWithEdgeFallback(languageCode) {
        calls.push(languageCode);
        return {
          ...articleResult({
            languageCode,
            articles: [article({ id: "home-1", requested_language_code: languageCode })],
            nextPage: null,
            nextCursor: "home-next",
          }),
          sections: homeSections(languageCode),
        };
      },
    },
    "@/lib/languages": languagesMock,
    "@/lib/logger": loggerMock,
  });
  assertMethodExports(homeRoute, ["GET"], "/api/home-feed");
  const response = await homeRoute.GET(new Request("https://www.nutsnews.com/api/home-feed?lang=ja"));
  assertStatus(response, 200, "/api/home-feed");
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=300/);
  assert.match(response.headers.get("x-nutsnews-cache-policy") ?? "", /public-home-feed-cache/);
  const payload = await responseJson(response);
  assertArticlePayloadContract(payload, "/api/home-feed payload");
  assertRequiredKeys(payload, ["sections"], "/api/home-feed payload");
  assertHomeSectionsContract(payload.sections, "/api/home-feed sections");
  assert.deepEqual(calls, ["ja"]);

  const emptyHomeRoute = loadModule("web/app/api/home-feed/route.ts", {
    "next/server": nextServerMock(),
    "@/lib/cacheHeaders": cacheHeadersMock,
    "@/lib/edgeFeedSnapshot": {
      createMaintenanceHomeFeedPayload: (languageCode) =>
        maintenanceHomeFeed(languageCode),
      async getHomeFeedDataWithEdgeFallback(languageCode) {
        return {
          ...articleResult({ languageCode, articles: [], nextPage: null, nextCursor: null }),
          sections: HOME_SECTION_IDS.map((id) => ({ id, articles: [] })),
        };
      },
    },
    "@/lib/languages": languagesMock,
    "@/lib/logger": loggerMock,
  });
  const emptyHomeResponse = await emptyHomeRoute.GET(
    new Request("https://www.nutsnews.com/api/home-feed"),
  );
  assertStatus(emptyHomeResponse, 200, "/api/home-feed empty result");
  const emptyHomePayload = await responseJson(emptyHomeResponse);
  assertArticlePayloadContract(emptyHomePayload, "/api/home-feed empty payload");
  assertHomeSectionsContract(emptyHomePayload.sections, "/api/home-feed empty sections");
  assert.deepEqual(emptyHomePayload.articles, []);

  const failedRoute = loadModule("web/app/api/home-feed/route.ts", {
    "next/server": nextServerMock(),
    "@/lib/cacheHeaders": cacheHeadersMock,
    "@/lib/edgeFeedSnapshot": {
      createMaintenanceHomeFeedPayload: (languageCode) =>
        maintenanceHomeFeed(languageCode),
      async getHomeFeedDataWithEdgeFallback() {
        throw new Error("feed unavailable");
      },
    },
    "@/lib/languages": languagesMock,
    "@/lib/logger": loggerMock,
  });
  const failedResponse = await failedRoute.GET(new Request("https://www.nutsnews.com/api/home-feed"));
  assertStatus(failedResponse, 200, "/api/home-feed maintenance");
  assert.match(failedResponse.headers.get("cache-control") ?? "", /s-maxage=300/);
  assert.equal(failedResponse.headers.get("x-nutsnews-degradation-mode"), "maintenance");
  assert.equal(failedResponse.headers.get("x-nutsnews-degradation-reason"), "home_feed_exception");
  const failedPayload = await responseJson(failedResponse);
  assertArticlePayloadContract(failedPayload, "/api/home-feed maintenance payload");
  assertHomeSectionsContract(failedPayload.sections, "/api/home-feed maintenance sections");
  assert.equal(failedPayload.degradation?.mode, "maintenance");
  assert.equal(failedPayload.degradation?.reason, "home_feed_exception");
}

async function testSearchContract() {
  const calls = [];
  const searchRoute = loadModule("web/app/api/search/route.ts", {
    "next/server": nextServerMock(),
    "@/lib/articles": {
      SEARCH_PAGE_SIZE: 20,
      async searchPublishedArticles(query, page, limit, languageCode) {
        calls.push({ query, page, limit, languageCode });

        if (query === "explode") {
          throw new Error("search unavailable");
        }

        if (query.length < 2) {
          return { articles: [], nextPage: null, query, page, pageSize: limit, languageCode };
        }

        return {
          articles: [
            article({ id: "search-1", requested_language_code: languageCode }),
            article({ id: "search-2", title: "Second result", requested_language_code: languageCode }),
          ],
          nextPage: page + 1,
          query,
          page,
          pageSize: limit,
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
  assertMethodExports(searchRoute, ["GET"], "/api/search");

  const response = await searchRoute.GET(
    new Request("https://www.nutsnews.com/api/search?q=%20community%20%20wins%20&page=2.9&limit=99&lang=fr"),
  );
  assertStatus(response, 200, "/api/search");
  assert.equal(response.headers.get("x-nutsnews-search-fields"), "title,ai_summary,source,category");
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=60/);
  const payload = await responseJson(response);
  assertSearchPayloadContract(payload, "/api/search payload");
  assert.equal(payload.query, "community wins");
  assert.equal(payload.page, 2);
  assert.equal(payload.pageSize, 50);
  assert.equal(payload.nextPage, 3);
  assert.deepEqual(
    payload.articles.map((value) => value.id),
    ["search-1", "search-2"],
    "Search result ordering must remain stable",
  );
  assert.deepEqual(calls.at(-1), { query: "community wins", page: 2, limit: 50, languageCode: "fr" });

  const emptyResponse = await searchRoute.GET(
    new Request("https://www.nutsnews.com/api/search?q=a&page=-4&limit=0&lang=unsupported"),
  );
  assertStatus(emptyResponse, 200, "/api/search short query");
  const emptyPayload = await responseJson(emptyResponse);
  assertSearchPayloadContract(emptyPayload, "/api/search short query payload");
  assert.deepEqual(emptyPayload.articles, []);
  assert.equal(emptyPayload.nextPage, null);
  assert.deepEqual(calls.at(-1), { query: "a", page: 0, limit: 20, languageCode: "en" });

  const failedResponse = await searchRoute.GET(
    new Request("https://www.nutsnews.com/api/search?q=explode&page=7&limit=3&lang=ja"),
  );
  assertStatus(failedResponse, 500, "/api/search error");
  assert.match(failedResponse.headers.get("cache-control") ?? "", /no-store/);
  const failedPayload = await responseJson(failedResponse);
  assertRequiredKeys(
    failedPayload,
    ["articles", "nextPage", "query", "page", "pageSize", "languageCode", "error"],
    "/api/search error payload",
  );
  assert(Array.isArray(failedPayload.articles), "/api/search error articles must be an array");
  assertErrorPayload(failedPayload, "/api/search error payload");
  assert.deepEqual(failedPayload.articles, []);
  assert.equal(failedPayload.nextPage, null);
  assert.equal(failedPayload.query, "explode");
  assert.equal(failedPayload.page, 7);
  assert.equal(failedPayload.pageSize, 3);
  assert.equal(failedPayload.languageCode, "ja");
}

function contactRequest(body, options = {}) {
  const headers = new Headers(options.headers ?? {});

  if (!headers.has("content-type") && options.contentType !== false) {
    headers.set("content-type", "application/json");
  }

  return new Request("https://www.nutsnews.com/api/contact", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function validContactBody(overrides = {}) {
  return {
    email: "reader@example.com",
    message: "This message is long enough for validation.",
    turnstileToken: "turnstile-token",
    ...overrides,
  };
}

async function withEnvironment(values, callback) {
  const previous = new Map(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );

  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    return await callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function loadContactRoute(recordQuotaUsageEvent = async () => {}) {
  return loadModule("web/app/api/contact/route.ts", {
    "next/server": nextServerMock(),
    "@/lib/cacheHeaders": cacheHeadersMock,
    "@/lib/quotaUsage": { recordQuotaUsageEvent },
    "@/lib/runtimeSafety": { assertExternalSideEffect() {} },
  });
}

function engagementRequest(body, { headers = {}, contentType = true } = {}) {
  return new Request("https://www.nutsnews.com/api/engagement", {
    method: "POST",
    headers: {
      ...(contentType ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function validEngagementBody(overrides = {}) {
  return {
    eventType: "outbound_click",
    articleId: "11111111-1111-4111-8111-111111111111",
    source: "Good News Network",
    category: "community",
    ...overrides,
  };
}

function loadEngagementRoute(recordArticleEngagementEvent = async () => ({
  recorded: true,
  reason: "recorded",
})) {
  return loadModule("web/app/api/engagement/route.ts", {
    "next/server": nextServerMock(),
    "@/lib/cacheHeaders": cacheHeadersMock,
    "@/lib/articleEngagement": { recordArticleEngagementEvent },
  });
}

function assertEngagementPayload(payload, label) {
  assertRequiredKeys(payload, ["ok", "recorded", "reason"], label);
  assert.equal(payload.ok, true, `${label}.ok must be true`);
  assert.equal(typeof payload.recorded, "boolean", `${label}.recorded must be boolean`);
  assert(
    ["recorded", "runtime_disabled", "database_error"].includes(payload.reason),
    `${label}.reason has an unsupported enum value`,
  );
}

async function testEngagementContract() {
  const recordedEvents = [];
  const route = loadEngagementRoute(async (event) => {
    recordedEvents.push(event);
    return {
      recorded: true,
      reason: "recorded",
    };
  });
  assertMethodExports(route, ["POST"], "/api/engagement");

  const successResponse = await route.POST(
    engagementRequest(validEngagementBody()),
  );
  assertStatus(successResponse, 202, "/api/engagement success");
  assertEngagementPayload(await responseJson(successResponse), "/api/engagement success body");
  assert.equal(recordedEvents.length, 1, "Valid engagement event must call the recorder once");
  assert.deepEqual(recordedEvents[0], {
    eventType: "outbound_click",
    articleId: "11111111-1111-4111-8111-111111111111",
    source: "Good News Network",
    category: "community",
  });

  const categoryResponse = await route.POST(
    engagementRequest(validEngagementBody({
      eventType: "category_interest",
      articleId: undefined,
    })),
  );
  assertStatus(categoryResponse, 202, "/api/engagement category interest");
  assertEngagementPayload(await responseJson(categoryResponse), "/api/engagement category interest body");

  const blockedRoute = loadEngagementRoute(async () => ({
    recorded: false,
    reason: "runtime_disabled",
  }));
  const blockedResponse = await blockedRoute.POST(
    engagementRequest(validEngagementBody()),
  );
  assertStatus(blockedResponse, 202, "/api/engagement runtime blocked");
  assert.deepEqual(await responseJson(blockedResponse), {
    ok: true,
    recorded: false,
    reason: "runtime_disabled",
  });

  const disallowedOriginResponse = await route.POST(
    engagementRequest(validEngagementBody(), {
      headers: { origin: "https://untrusted.example" },
    }),
  );
  assertStatus(disallowedOriginResponse, 403, "/api/engagement disallowed origin");
  assertErrorPayload(await responseJson(disallowedOriginResponse), "/api/engagement disallowed origin body");

  const nonJsonResponse = await route.POST(
    engagementRequest("plain text", {
      contentType: false,
      headers: { "content-type": "text/plain" },
    }),
  );
  assertStatus(nonJsonResponse, 415, "/api/engagement content type");
  assertErrorPayload(await responseJson(nonJsonResponse), "/api/engagement content type body");

  const malformedResponse = await route.POST(engagementRequest("{not valid json"));
  assertStatus(malformedResponse, 400, "/api/engagement malformed JSON");
  assertErrorPayload(await responseJson(malformedResponse), "/api/engagement malformed JSON body");

  const tooLargeResponse = await route.POST(
    engagementRequest({
      ...validEngagementBody(),
      source: "x".repeat(3_000),
    }),
  );
  assertStatus(tooLargeResponse, 413, "/api/engagement request size");
  assertErrorPayload(await responseJson(tooLargeResponse), "/api/engagement request size body");

  const unsupportedEventResponse = await route.POST(
    engagementRequest(validEngagementBody({ eventType: "profile_view" })),
  );
  assertStatus(unsupportedEventResponse, 400, "/api/engagement unsupported event");
  assertErrorPayload(await responseJson(unsupportedEventResponse), "/api/engagement unsupported event body");

  const invalidArticleResponse = await route.POST(
    engagementRequest(validEngagementBody({ articleId: "not-a-uuid" })),
  );
  assertStatus(invalidArticleResponse, 400, "/api/engagement invalid article");
  assertErrorPayload(await responseJson(invalidArticleResponse), "/api/engagement invalid article body");
}

async function testContactContract() {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const fetchCalls = [];
  globalThis.fetch = async (...argumentsList) => {
    fetchCalls.push(argumentsList);
    throw new Error("The contact contract suite must not make a real network request.");
  };
  console.error = () => {};
  console.warn = () => {};

  try {
    await withEnvironment(
      { TURNSTILE_SECRET_KEY: undefined, RESEND_API_KEY: undefined },
      async () => {
        const route = loadContactRoute();
        assertMethodExports(route, ["POST"], "/api/contact");

        const disallowedOriginResponse = await route.POST(
          contactRequest(validContactBody(), { headers: { origin: "https://untrusted.example" } }),
        );
        assertStatus(disallowedOriginResponse, 403, "/api/contact disallowed origin");
        assertErrorPayload(await responseJson(disallowedOriginResponse), "/api/contact disallowed origin body");

        const nonJsonResponse = await route.POST(
          contactRequest("plain text", { contentType: false, headers: { "content-type": "text/plain" } }),
        );
        assertStatus(nonJsonResponse, 415, "/api/contact content type");
        assertErrorPayload(await responseJson(nonJsonResponse), "/api/contact content type body");

        const malformedResponse = await route.POST(contactRequest("{not valid json"));
        assertStatus(malformedResponse, 400, "/api/contact malformed JSON");
        assertErrorPayload(await responseJson(malformedResponse), "/api/contact malformed JSON body");

        const tooLargeResponse = await route.POST(
          contactRequest({ message: "x".repeat(9_000) }),
        );
        assertStatus(tooLargeResponse, 413, "/api/contact request size");
        assertErrorPayload(await responseJson(tooLargeResponse), "/api/contact request size body");

        const invalidEmailResponse = await route.POST(
          contactRequest(validContactBody({ email: "not-an-email" })),
        );
        assertStatus(invalidEmailResponse, 400, "/api/contact invalid email");
        assertErrorPayload(await responseJson(invalidEmailResponse), "/api/contact invalid email body");

        const invalidMessageResponse = await route.POST(
          contactRequest(validContactBody({ message: "short" })),
        );
        assertStatus(invalidMessageResponse, 400, "/api/contact invalid message");
        assertErrorPayload(await responseJson(invalidMessageResponse), "/api/contact invalid message body");

        const invalidTokenResponse = await route.POST(
          contactRequest(validContactBody({ turnstileToken: "" })),
        );
        assertStatus(invalidTokenResponse, 400, "/api/contact missing token");
        assertErrorPayload(await responseJson(invalidTokenResponse), "/api/contact missing token body");

        const honeypotResponse = await route.POST(
          contactRequest(validContactBody({ website: "https://bot.example" })),
        );
        assertStatus(honeypotResponse, 200, "/api/contact honeypot");
        assert.deepEqual(await responseJson(honeypotResponse), { ok: true });

        const missingConfigurationResponse = await route.POST(
          contactRequest(validContactBody({ email: "unconfigured@example.com" }), {
            headers: { "cf-connecting-ip": "203.0.113.1" },
          }),
        );
        assertStatus(missingConfigurationResponse, 503, "/api/contact missing configuration");
        assertErrorPayload(await responseJson(missingConfigurationResponse), "/api/contact missing configuration body");
        assert.equal(fetchCalls.length, 0, "Validation/configuration paths must not call external providers");
      },
    );

    const quotaEvents = [];
    await withEnvironment(
      { TURNSTILE_SECRET_KEY: "test-turnstile-secret", RESEND_API_KEY: "test-resend-key" },
      async () => {
        globalThis.fetch = async (...argumentsList) => {
          fetchCalls.push(argumentsList);

          if (fetchCalls.length % 2 === 1) {
            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ id: "email-1" }), { status: 200 });
        };
        const successfulRoute = loadContactRoute(async (event) => quotaEvents.push(event));
        const successResponse = await successfulRoute.POST(
          contactRequest(validContactBody({ email: "success@example.com" }), {
            headers: { "cf-connecting-ip": "203.0.113.2" },
          }),
        );
        assertStatus(successResponse, 200, "/api/contact provider success");
        assert.deepEqual(await responseJson(successResponse), { ok: true });
        assert.equal(quotaEvents.length, 1, "Successful email delivery must record quota usage once");

        const invalidTurnstileRoute = loadContactRoute();
        globalThis.fetch = async () =>
          new Response(JSON.stringify({ success: false }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        const invalidTurnstileResponse = await invalidTurnstileRoute.POST(
          contactRequest(validContactBody({ email: "turnstile@example.com" }), {
            headers: { "cf-connecting-ip": "203.0.113.3" },
          }),
        );
        assertStatus(invalidTurnstileResponse, 400, "/api/contact rejected Turnstile");
        assertErrorPayload(await responseJson(invalidTurnstileResponse), "/api/contact rejected Turnstile body");

        const providerFailureRoute = loadContactRoute();
        let providerCall = 0;
        globalThis.fetch = async () => {
          providerCall += 1;
          return providerCall === 1
            ? new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { "content-type": "application/json" },
              })
            : new Response("provider unavailable", { status: 502 });
        };
        const providerFailureResponse = await providerFailureRoute.POST(
          contactRequest(validContactBody({ email: "provider-failure@example.com" }), {
            headers: { "cf-connecting-ip": "203.0.113.4" },
          }),
        );
        assertStatus(providerFailureResponse, 502, "/api/contact provider failure");
        assertErrorPayload(await responseJson(providerFailureResponse), "/api/contact provider failure body");

        const rateLimitedRoute = loadContactRoute();
        globalThis.fetch = async () =>
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        let alternating = false;
        globalThis.fetch = async () => {
          alternating = !alternating;
          return alternating
            ? new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { "content-type": "application/json" },
              })
            : new Response(JSON.stringify({ id: "email-rate" }), { status: 200 });
        };
        const rateRequestOptions = { headers: { "cf-connecting-ip": "203.0.113.5" } };

        for (let attempt = 0; attempt < 3; attempt += 1) {
          const rateResponse = await rateLimitedRoute.POST(
            contactRequest(validContactBody({ email: "rate@example.com" }), rateRequestOptions),
          );
          assertStatus(rateResponse, 200, `/api/contact rate-limit allowed attempt ${attempt + 1}`);
        }

        const limitedResponse = await rateLimitedRoute.POST(
          contactRequest(validContactBody({ email: "rate@example.com" }), rateRequestOptions),
        );
        assertStatus(limitedResponse, 429, "/api/contact rate limit");
        assertErrorPayload(await responseJson(limitedResponse), "/api/contact rate limit body");
        assert.match(limitedResponse.headers.get("retry-after") ?? "", /^\d+$/);
        assert.match(limitedResponse.headers.get("cache-control") ?? "", /no-store/);
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
}

async function testHealthContract() {
  await withEnvironment(
    {
      NUTSNEWS_SOURCE_COMMIT: "source/commit-1",
      NEXT_PUBLIC_NUTSNEWS_SOURCE_COMMIT: undefined,
      VERCEL_GIT_COMMIT_SHA: undefined,
      NUTSNEWS_BUILD_ID: "build-42",
      NEXT_PUBLIC_NUTSNEWS_BUILD_ID: undefined,
      NUTSNEWS_DEPLOYMENT_TARGET: "ci-container",
      VERCEL: undefined,
      VERCEL_ENV: undefined,
    },
    async () => {
      const healthRoute = loadModule("web/app/healthz/route.ts");
      assertMethodExports(healthRoute, ["GET"], "/healthz");
      const response = healthRoute.GET();
      assertStatus(response, 200, "/healthz");
      const payload = await responseJson(response);
      assertRequiredKeys(payload, ["ok", "service", "sourceCommit", "buildId", "deploymentTarget"], "/healthz payload");
      assert.equal(payload.ok, true);
      assert.equal(payload.service, "nutsnews-web");
      assert.equal(payload.sourceCommit, "source/commit-1");
      assert.equal(payload.buildId, "build-42");
      assert.equal(payload.deploymentTarget, "ci-container");
      assert.equal(response.headers.get("x-nutsnews-source-commit"), payload.sourceCommit);
      assert.equal(response.headers.get("x-nutsnews-build-id"), payload.buildId);
      assert.equal(response.headers.get("x-nutsnews-deployment-target"), payload.deploymentTarget);
      assert.match(response.headers.get("cache-control") ?? "", /must-revalidate/);
      assert.match(response.headers.get("cdn-cache-control") ?? "", /s-maxage=60/);
    },
  );

  await withEnvironment(
    {
      NUTSNEWS_SOURCE_COMMIT: "unsafe value with spaces",
      NUTSNEWS_BUILD_ID: undefined,
      NUTSNEWS_DEPLOYMENT_TARGET: undefined,
      VERCEL: undefined,
    },
    async () => {
      const healthRoute = loadModule("web/app/healthz/route.ts");
      const payload = await responseJson(healthRoute.GET());
      assert.equal(payload.sourceCommit, "unknown", "Health identity values must reject unsafe environment input");
      assert.equal(payload.buildId, "unknown", "Build ID must fall back to the safe source identity");
      assert.equal(payload.deploymentTarget, "unknown", "Deployment target must use a safe fallback");
    },
  );
}

async function testRuntimePublicConfigContract() {
  let connectionCalls = 0;
  const runtimeConfig = {
    runtimeEnv: "staging",
    sideEffectsMode: "disabled",
    supabaseUrl: "https://staging-project.supabase.co",
    supabaseAnonKey: "staging-public-anon-key",
    turnstileSiteKey: "staging-turnstile-site-key",
    sentryDsn: "https://staging-sentry.invalid/1",
    gaId: "G-STAGINGRUNTIME",
    iosAppStoreUrl: null,
    sourceCommit: "source-commit",
    buildId: "build-id",
    deploymentTarget: "ci-container",
    expectedImageDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    configGeneration: "ci-config-generation-1",
    telemetryEnabled: false,
  };
  const runtimeConfigRoute = loadModule("web/app/api/runtime-config/route.ts", {
    "next/server": {
      ...nextServerMock(),
      async connection() {
        connectionCalls += 1;
      },
    },
    "@/lib/runtimePublicConfig": {
      getRuntimePublicConfig() {
        return runtimeConfig;
      },
    },
  });
  assertMethodExports(runtimeConfigRoute, ["GET"], "/api/runtime-config");
  const response = await runtimeConfigRoute.GET();
  assertStatus(response, 200, "/api/runtime-config");
  assert.equal(connectionCalls, 1, "Runtime configuration must opt into request-time evaluation");
  assert.deepEqual(await responseJson(response), runtimeConfig);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.get("x-nutsnews-cache-policy"), "runtime-public-config-no-store");
}

async function testReadinessContract() {
  let connectionCalls = 0;
  let readinessCalls = 0;
  const readinessRoute = loadModule("web/app/readyz/route.ts", {
    "next/server": {
      ...nextServerMock(),
      async connection() {
        connectionCalls += 1;
      },
    },
    "@/lib/cacheHeaders": cacheHeadersMock,
    "@/lib/runtimeReadiness": {
      async evaluateRuntimeReadiness() {
        readinessCalls += 1;
        return {
          ready: readinessCalls === 2,
          runtimeEnv: "staging",
          sideEffectsMode: "disabled",
          databaseProviderMode: "supabase_primary",
          productionWritesPaused: false,
          code: readinessCalls === 2 ? "ready" : "staging_production_project_rejected",
          sourceCommit: "source-commit",
          buildId: "build-id",
          deploymentTarget: "vps-staging",
          expectedImageDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          configGeneration: `config-generation-${readinessCalls}`,
        };
      },
    },
    "@/lib/supabase": {
      getSupabase() {
        throw new Error("readiness route must use its evaluator-provided dependency reader");
      },
    },
  });
  assertMethodExports(readinessRoute, ["GET"], "/readyz");
  const response = await readinessRoute.GET(new Request("https://nutsnews.test/readyz?cache-bust=one"));
  assertStatus(response, 503, "/readyz rejected staging identity");
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(connectionCalls, 1, "/readyz must evaluate at request time");
  assert.equal(response.headers.get("x-nutsnews-source-commit"), "source-commit");
  assert.equal(response.headers.get("x-nutsnews-build-id"), "build-id");
  assert.equal(response.headers.get("x-nutsnews-deployment-target"), "vps-staging");
  assert.equal(response.headers.get("x-nutsnews-runtime-environment"), "staging");
  assert.equal(response.headers.get("x-nutsnews-config-generation"), "config-generation-1");
  assert.equal(
    response.headers.get("x-nutsnews-expected-image-digest"),
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
  assert.deepEqual(await responseJson(response), {
    ok: false,
    service: "nutsnews-web",
    runtimeEnv: "staging",
    sideEffectsMode: "disabled",
    databaseProviderMode: "supabase_primary",
    productionWritesPaused: false,
    code: "staging_production_project_rejected",
  });

  const secondResponse = await readinessRoute.GET(
    new Request("https://nutsnews.test/readyz?cache-bust=two", {
      headers: { "x-nutsnews-deployment-target": "production-vps" },
    }),
  );
  assertStatus(secondResponse, 200, "/readyz qualified second request");
  assert.equal(connectionCalls, 2, "/readyz must not serve a cached route result");
  assert.equal(
    secondResponse.headers.get("x-nutsnews-config-generation"),
    "config-generation-2",
    "/readyz must not retain a previous readiness identity",
  );
}

async function testLogTestContract() {
  const events = [];
  const logRoute = loadModule("web/app/api/log-test/route.ts", {
    "next/server": nextServerMock(),
    "@/lib/cacheHeaders": cacheHeadersMock,
    "@/lib/logger": {
      async logInfo(event, ...rest) {
        events.push(["info", event, ...rest]);
      },
      async logWarn(event, ...rest) {
        events.push(["warn", event, ...rest]);
      },
    },
    "@/lib/runtimeSafety": { assertProductionOperation() {} },
  });
  assertMethodExports(logRoute, ["GET"], "/api/log-test");
  const response = await logRoute.GET();
  assertStatus(response, 200, "/api/log-test");
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  const payload = await responseJson(response);
  assertRequiredKeys(payload, ["ok", "message", "searchInBetterStackFor"], "/api/log-test payload");
  assert.equal(payload.ok, true);
  assert.equal(typeof payload.message, "string");
  assertRequiredKeys(payload.searchInBetterStackFor, ["service", "event", "level"], "/api/log-test search fields");
  assert(
    Object.values(payload.searchInBetterStackFor).every((value) => typeof value === "string"),
    "/api/log-test nested search fields must be strings",
  );
  assert.deepEqual(
    events.map((event) => event[1]),
    ["api.log_test.started", "api.log_test.sample_warning", "api.log_test.completed"],
    "/api/log-test must preserve the diagnostic event sequence",
  );
}

async function testAuthContract() {
  const handlerGet = () => new Response("GET");
  const handlerPost = () => new Response("POST");
  class RuntimeSafetyError extends Error {}
  const guardedRequests = [];
  const authRoute = loadModule("web/app/api/auth/[...nextauth]/route.ts", {
    "@/auth": { handlers: { GET: handlerGet, POST: handlerPost } },
    "next/server": nextServerMock(),
    "@/lib/runtimeSafety": {
      RuntimeSafetyError,
      assertOAuthCallback(operation, requestUrl) {
        guardedRequests.push([operation, requestUrl]);
      },
    },
  });
  assertMethodExports(authRoute, ["GET", "POST"], "/api/auth/[...nextauth]");
  const callbackUrl = "https://0.0.0.0:3000/api/auth/session";
  const callbackHeaders = {
    host: "staging.nutsnews.com",
    "x-forwarded-proto": "https",
  };
  assert.equal(
    await (await authRoute.GET(new Request(callbackUrl, { headers: callbackHeaders }))).text(),
    "GET",
    "Auth GET must delegate after the runtime safety guard permits it",
  );
  assert.equal(
    await (await authRoute.POST(new Request(callbackUrl, { method: "POST", headers: callbackHeaders }))).text(),
    "POST",
    "Auth POST must delegate after the runtime safety guard permits it",
  );
  assert.deepEqual(
    guardedRequests,
    [
      [
        "oauth-callback",
        {
          url: callbackUrl,
          host: "staging.nutsnews.com",
          forwardedProto: "https",
        },
      ],
      [
        "oauth-callback",
        {
          url: callbackUrl,
          host: "staging.nutsnews.com",
          forwardedProto: "https",
        },
      ],
    ],
    "Auth GET and POST must pass exact proxy request identity to the callback guard",
  );

  const blockedAuthRoute = loadModule("web/app/api/auth/[...nextauth]/route.ts", {
    "@/auth": { handlers: { GET: handlerGet, POST: handlerPost } },
    "next/server": nextServerMock(),
    "@/lib/runtimeSafety": {
      RuntimeSafetyError,
      assertOAuthCallback() {
        throw new RuntimeSafetyError("blocked");
      },
    },
  });

  for (const method of ["GET", "POST"]) {
    const response = await blockedAuthRoute[method](
      new Request("https://staging.nutsnews.com/api/auth/session", { method }),
    );
    assertStatus(response, 503, `Auth ${method} blocked identity`);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }

  let capturedConfiguration;
  const googleProvider = { id: "google" };
  const authModule = loadModule("web/auth.ts", {
    "next-auth": {
      __esModule: true,
      default(configuration) {
        capturedConfiguration = configuration;
        return {
          handlers: { GET: handlerGet, POST: handlerPost },
          auth: () => null,
          signIn: () => null,
          signOut: () => null,
        };
      },
    },
    "next-auth/providers/google": { __esModule: true, default: googleProvider },
    "@/lib/adminAuth": {
      isAllowedAdminEmail(email) {
        return email === "admin@example.com";
      },
    },
  });
  assert.equal(authModule.handlers.GET, handlerGet);
  assert.equal(capturedConfiguration.providers[0], googleProvider);
  assert.equal(capturedConfiguration.session.strategy, "jwt");
  assert.equal(capturedConfiguration.pages.signIn, "/admin/login");
  assert.equal(capturedConfiguration.pages.error, "/admin/access-denied");
  assert.equal(
    await capturedConfiguration.callbacks.signIn({ user: { email: "admin@example.com" } }),
    true,
    "Allowed admin email must be permitted to establish a session",
  );
  assert.equal(
    await capturedConfiguration.callbacks.signIn({ user: { email: "reader@example.com" } }),
    "/admin/access-denied",
    "Unauthorized email must be redirected to access denied",
  );
}

async function testMetadataAndOpenGraphContracts() {
  const sitemapCalls = [];
  const articlesMock = {
    SITE_URL: "https://www.nutsnews.com",
    async getRecentArticleSitemapItems(limit) {
      sitemapCalls.push(limit);
      return [
        {
          id: "article-1",
          published_on_site_at: "2026-07-02T10:00:00.000Z",
          published_at: "2026-07-01T10:00:00.000Z",
        },
      ];
    },
    async getPublishedArticleSitemapCount() {
      return 1501;
    },
    async getArticleSitemapItemsPage(shardId) {
      return [
        {
          id: `article-page-${shardId}`,
          published_on_site_at: "2026-07-03T10:00:00.000Z",
          published_at: "2026-07-02T10:00:00.000Z",
        },
      ];
    },
  };
  const sitemapConfigMock = {
    ARTICLE_SITEMAP_PAGE_SIZE: 1000,
    ROOT_SITEMAP_RECENT_ARTICLE_LIMIT: 100,
    ROOT_SITEMAP_PATH: "/sitemap.xml",
    SITEMAP_INDEX_PATH: "/sitemap-index.xml",
    getArticleSitemapShardIds(articleCount) {
      return Array.from({ length: Math.ceil(articleCount / 1000) }, (_value, index) => index);
    },
    parseArticleSitemapShardId(value) {
      const numericValue = Number(value);
      return Number.isInteger(numericValue) && numericValue >= 0 && numericValue < 50 ? numericValue : null;
    },
    getArticleSitemapUrl(siteUrl, shardId) {
      return `${siteUrl}/articles/sitemap/${shardId}.xml`;
    },
  };
  const sitemapModule = loadModule("web/app/sitemap.ts", {
    "@/lib/articles": articlesMock,
    "@/lib/sitemapConfig": sitemapConfigMock,
  });
  const aboutSitemapModule = loadModule("web/app/about/sitemap.ts", { "@/lib/articles": articlesMock });
  const articleSitemapModule = loadModule("web/app/articles/sitemap.ts", {
    "@/lib/articles": articlesMock,
    "@/lib/sitemapConfig": sitemapConfigMock,
  });
  const sitemapIndexModule = loadModule("web/app/sitemap-index.xml/route.ts", {
    "@/lib/articles": articlesMock,
    "@/lib/sitemapConfig": sitemapConfigMock,
  });
  const robotsModule = loadModule("web/app/robots.ts", {
    "@/lib/articles": articlesMock,
    "@/lib/sitemapConfig": sitemapConfigMock,
  });

  const sitemap = await sitemapModule.default();
  assert(Array.isArray(sitemap), "Root sitemap must generate an array for framework XML serialization");
  assert.deepEqual(sitemapCalls, [100], "Root sitemap must retain a bounded recent article window");
  const rootSitemapUrls = sitemap.map((entry) => entry.url);
  for (const suffix of ["", "/apps", "/privacy", "/contact", "/articles/article-1"]) {
    assert(rootSitemapUrls.includes(`https://www.nutsnews.com${suffix}`), `Root sitemap is missing ${suffix || "/"}`);
  }
  for (const [index, entry] of sitemap.entries()) {
    assert.equal(typeof entry.url, "string", `sitemap[${index}].url must be string`);
    assert(entry.lastModified instanceof Date, `sitemap[${index}].lastModified must be Date`);
    assert.equal(typeof entry.changeFrequency, "string", `sitemap[${index}].changeFrequency must be string`);
    assert.equal(typeof entry.priority, "number", `sitemap[${index}].priority must be number`);
  }

  const aboutSitemap = await aboutSitemapModule.default();
  const aboutUrls = aboutSitemap.map((entry) => entry.url);
  for (const suffix of ["", "/about", "/articles/article-1"]) {
    assert(aboutUrls.includes(`https://www.nutsnews.com${suffix}`), `About sitemap is missing ${suffix || "/"}`);
  }
  assert.equal(sitemapCalls.at(-1), undefined, "About sitemap must retain its default item-limit behavior");

  assert.deepEqual(await articleSitemapModule.generateSitemaps(), [{ id: 0 }, { id: 1 }]);
  const articleShard = await articleSitemapModule.default({ id: Promise.resolve("1") });
  assert.equal(articleShard[0].url, "https://www.nutsnews.com/articles/article-page-1");
  assert.deepEqual(await articleSitemapModule.default({ id: Promise.resolve("50") }), []);

  const sitemapIndexResponse = await sitemapIndexModule.GET();
  assert.equal(sitemapIndexResponse.status, 200);
  assert.match(sitemapIndexResponse.headers.get("content-type"), /application\/xml/);
  const sitemapIndex = await sitemapIndexResponse.text();
  assert(sitemapIndex.includes("<sitemapindex"), "Sitemap index route must return sitemapindex XML");
  assert(sitemapIndex.includes("https://www.nutsnews.com/sitemap.xml"), "Sitemap index must include root sitemap");
  assert(
    sitemapIndex.includes("https://www.nutsnews.com/articles/sitemap/0.xml"),
    "Sitemap index must include article shard 0",
  );
  assert(
    sitemapIndex.includes("https://www.nutsnews.com/articles/sitemap/1.xml"),
    "Sitemap index must include article shard 1",
  );

  const robots = robotsModule.default();
  assert(Array.isArray(robots.rules), "robots rules must be an array");
  assert.equal(robots.rules[0].userAgent, "*");
  assert.equal(robots.rules[0].allow, "/");
  assert(robots.rules[0].disallow.includes("/api/"), "robots must disallow API crawling");
  assert.deepEqual(robots.sitemap, [
    "https://www.nutsnews.com/sitemap-index.xml",
    "https://www.nutsnews.com/sitemap.xml",
  ]);

  const imageCalls = [];
  class ImageResponse {
    constructor(element, size) {
      this.element = element;
      this.size = size;
      imageCalls.push(this);
    }
  }
  const ogImageMock = {
    OG_IMAGE_SIZE: { width: 1200, height: 630 },
    createOgImage(options) {
      return options;
    },
  };
  const imageMocks = {
    "next/og": { ImageResponse },
    "@/lib/ogImage": ogImageMock,
  };
  const siteImageModule = loadModule("web/app/opengraph-image.tsx", imageMocks);
  const articleImageModule = loadModule("web/app/articles/[id]/opengraph-image.tsx", imageMocks);
  assert.equal(siteImageModule.contentType, "image/png");
  assert.equal(articleImageModule.contentType, "image/png");
  assert.deepEqual(siteImageModule.size, ogImageMock.OG_IMAGE_SIZE);
  assert.deepEqual(articleImageModule.size, ogImageMock.OG_IMAGE_SIZE);
  assert.equal(siteImageModule.alt, "NutsNews social preview image");
  assert.equal(articleImageModule.alt, "NutsNews article social preview image");
  const siteImage = siteImageModule.default();
  const articleImage = articleImageModule.default();
  assert(siteImage instanceof ImageResponse, "Root Open Graph route must return ImageResponse");
  assert(articleImage instanceof ImageResponse, "Article Open Graph route must return ImageResponse");
  assert.equal(imageCalls.length, 2);
  assert.equal(siteImage.element.eyebrow, "Positive news, simplified");
  assert.equal(articleImage.element.eyebrow, "Uplifting story preview");
}

async function testConfiguredCachePolicies() {
  const configModule = loadModule("web/next.config.ts", {
    "@sentry/nextjs": {
      withSentryConfig(config) {
        return config;
      },
    },
    "./lib/cacheHeaders": {
      ARTICLE_API_BROWSER_CACHE_CONTROL: "public, s-maxage=300, stale-while-revalidate=3600",
      PUBLIC_CDN_CACHE_CONTROL: "public, s-maxage=3600, stale-while-revalidate=86400",
      PUBLIC_CDN_S_MAXAGE_SECONDS: 3600,
      PUBLIC_PAGE_CACHE_CONTROL: "public, max-age=0, must-revalidate",
    },
    "./lib/securityHeaders": {
      getSecurityHeaders() {
        return {};
      },
    },
  });
  const config = configModule.default;
  const rules = await config.headers();
  const bySource = new Map(rules.map((rule) => [rule.source, rule.headers]));

  function headerValue(source, headerName) {
    const headers = bySource.get(source);
    assert(headers, `next.config.ts is missing cache rule for ${source}`);
    const header = headers.find((entry) => entry.key.toLowerCase() === headerName.toLowerCase());
    assert(header, `next.config.ts ${source} is missing ${headerName}`);
    return header.value;
  }

  assert.match(headerValue("/api/articles", "Cache-Control"), /s-maxage=300/);
  assert.match(headerValue("/api/home-feed", "X-NutsNews-Cache-Policy"), /public-home-feed-cache/);
  assert.equal(headerValue("/api/contact", "Cache-Control"), "no-store, max-age=0");
  assert.equal(headerValue("/api/engagement", "Cache-Control"), "no-store, max-age=0");
  assert.equal(headerValue("/api/auth/:path*", "Cache-Control"), "no-store, max-age=0");
  assert.equal(headerValue("/api/log-test", "Cache-Control"), "no-store, max-age=0");
  assert.equal(headerValue("/readyz", "Cache-Control"), "no-store, max-age=0");
  assert.match(headerValue("/healthz", "CDN-Cache-Control"), /s-maxage=60/);
  assert.match(headerValue("/sitemap.xml", "X-NutsNews-Cache-Policy"), /public-sitemap-cache/);
  assert.match(headerValue("/sitemap-index.xml", "X-NutsNews-Cache-Policy"), /public-sitemap-index-cache/);
  assert.match(
    headerValue("/articles/sitemap/:path*", "X-NutsNews-Cache-Policy"),
    /public-article-sitemap-cache/,
  );
  assert.match(headerValue("/robots.txt", "X-NutsNews-Cache-Policy"), /public-robots-cache/);
  assert.match(headerValue("/opengraph-image", "X-NutsNews-Cache-Policy"), /public-og-image-cache/);
  assert.match(
    headerValue("/articles/:id/opengraph-image", "X-NutsNews-Cache-Policy"),
    /public-article-og-image-cache/,
  );
}

try {
  testInventoryCompleteness();
  testArticleSerializationBaseline();
  await testArticlesContract();
  await testHomeFeedContract();
  await testSearchContract();
  await testContactContract();
  await testEngagementContract();
  await testHealthContract();
  await testRuntimePublicConfigContract();
  await testReadinessContract();
  await testLogTestContract();
  await testAuthContract();
  await testMetadataAndOpenGraphContracts();
  await testConfiguredCachePolicies();
  console.log("API compatibility contract regression checks passed.");
} catch (error) {
  console.error("API compatibility contract regression checks failed.");
  console.error(error?.stack || error);
  process.exitCode = 1;
}
