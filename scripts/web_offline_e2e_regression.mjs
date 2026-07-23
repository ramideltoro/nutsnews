#!/usr/bin/env node
import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const webDir = fileURLToPath(new URL("../web/", import.meta.url));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const requireFromWeb = createRequire(new URL("../web/package.json", import.meta.url));
const { chromium, expect } = requireFromWeb("@playwright/test");

const runId = `web-offline-e2e-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const supabasePort = Number(process.env.WEB_E2E_SUPABASE_PORT || 8895);
const mockExternalPort = Number(process.env.WEB_E2E_EXTERNAL_PORT || 8896);
const webPort = Number(process.env.WEB_E2E_WEB_PORT || 3011);
const backendWebPort = Number(process.env.WEB_E2E_BACKEND_WEB_PORT || webPort + 1);
const supabaseUrl = `http://127.0.0.1:${supabasePort}`;
const mockExternalUrl = `http://127.0.0.1:${mockExternalPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const backendWebUrl = `http://127.0.0.1:${backendWebPort}`;

const articleUrlOne = `https://mock.nutsnews.test/story/cotton-candy-planets-${runId}`;
const articleUrlTwo = `https://mock.nutsnews.test/story/therapy-dogs-${runId}`;
const articleUrlThree = `https://mock.nutsnews.test/story/english-only-fallback-${runId}`;
const supportedLanguageCodes = new Set(["en", "fr", "ja", "de-CH", "de", "el"]);

const articles = [
  {
    id: `web-e2e-article-1-${runId}`,
    source: "NutsNews Mock Science",
    title: `Mock super puff planets bring wonder ${runId}`,
    original_url: articleUrlOne,
    image_url: `${mockExternalUrl}/images/super-puff.png`,
    published_at: "2026-06-28T01:00:00+00:00",
    published_on_site_at: "2026-06-28T01:05:00+00:00",
    ai_summary:
      "A cheerful offline regression story about astronomers finding gentle super puff planets.",
    category: "Science | Uplifting",
    positivity_score: 9,
    snapshot_rank: 1,
  },
  {
    id: `web-e2e-article-2-${runId}`,
    source: "NutsNews Mock Animals",
    title: `Mock therapy dogs bring community joy ${runId}`,
    original_url: articleUrlTwo,
    image_url: `${mockExternalUrl}/images/therapy-dogs.png`,
    published_at: "2026-06-28T00:00:00+00:00",
    published_on_site_at: "2026-06-28T00:30:00+00:00",
    ai_summary:
      "Friendly therapy dogs visit a community garden and help neighbors share vegetables, smiles, and a calm moment.",
    category: "Animals | Community | Wellness",
    positivity_score: 8,
    snapshot_rank: 2,
  },
  {
    id: `web-e2e-article-3-${runId}`,
    source: "NutsNews Mock Translation Fallback",
    title: `Mock English-only fallback story ${runId}`,
    original_url: articleUrlThree,
    image_url: `${mockExternalUrl}/images/super-puff.png`,
    published_at: "2026-06-27T23:00:00+00:00",
    published_on_site_at: "2026-06-27T23:30:00+00:00",
    ai_summary:
      "An English-only fallback fixture verifies that missing translations stay explicit instead of masquerading as localized copy.",
    category: "Fallback Only",
    positivity_score: 7,
    snapshot_rank: 3,
  },
];

const articleSummaries = [
  {
    original_url: articleUrlOne,
    language_code: "fr",
    title: `Planètes super légères de test ${runId}`,
    summary:
      "Une histoire de test en français raconte comment des astronomes observent des planètes très légères et partagent une découverte joyeuse avec les lecteurs.",
  },
  {
    original_url: articleUrlTwo,
    language_code: "fr",
    title: `Chiens de thérapie de test ${runId}`,
    summary:
      "Des chiens de thérapie visitent un jardin communautaire simulé, où des voisins partagent des légumes, des sourires et un moment positif ensemble.",
  },
  {
    original_url: articleUrlOne,
    language_code: "ja",
    title: `テスト用の軽い惑星 ${runId}`,
    summary:
      "天文学者がとても軽い惑星を見つけたという、前向きな日本語のテスト記事です。読者に発見の楽しさと穏やかな驚きを伝えます。",
  },
  {
    original_url: articleUrlTwo,
    language_code: "ja",
    title: `テスト用セラピー犬 ${runId}`,
    summary:
      "セラピー犬が地域の庭を訪れ、近所の人たちが野菜と笑顔を分かち合う様子を伝える日本語のテスト記事です。",
  },
  {
    original_url: articleUrlOne,
    language_code: "de-CH",
    title: `Testplaneten mit leichter Form ${runId}`,
    summary:
      "Eine Schweizerdeutsche Testfassung erzählt von Astronomen, die sehr leichte Planeten entdecken und diese freundliche Nachricht mit neugierigen Lesern teilen.",
  },
  {
    original_url: articleUrlTwo,
    language_code: "de-CH",
    title: `Therapiehunde im Test ${runId}`,
    summary:
      "Eine Schweizerdeutsche Testfassung zeigt Therapiehunde in einem Gemeinschaftsgarten, wo Nachbarn Gemüse, Ruhe und ein freundliches Erlebnis teilen.",
  },
  {
    original_url: articleUrlOne,
    language_code: "de",
    title: `Leichte Testplaneten entdeckt ${runId}`,
    summary:
      "Eine deutsche Testfassung erzählt von Astronomen, die sehr leichte Planeten entdecken und diese freundliche Nachricht mit neugierigen Lesern teilen.",
  },
  {
    original_url: articleUrlTwo,
    language_code: "de",
    title: `Therapiehunde bringen Freude ${runId}`,
    summary:
      "Eine deutsche Testfassung zeigt Therapiehunde in einem Gemeinschaftsgarten, wo Nachbarn Gemüse, Ruhe und ein freundliches Erlebnis miteinander teilen.",
  },
  {
    original_url: articleUrlOne,
    language_code: "el",
    title: `Δοκιμαστικοί ελαφριοί πλανήτες ${runId}`,
    summary:
      "Μια ελληνική δοκιμαστική ιστορία μιλά για αστρονόμους που ανακαλύπτουν πολύ ελαφριούς πλανήτες και μοιράζονται μια χαρούμενη ανακάλυψη.",
  },
  {
    original_url: articleUrlTwo,
    language_code: "el",
    title: `Σκύλοι θεραπείας σε δοκιμή ${runId}`,
    summary:
      "Μια ελληνική δοκιμαστική ιστορία δείχνει σκύλους θεραπείας σε κοινοτικό κήπο, όπου γείτονες μοιράζονται λαχανικά, χαμόγελα και ηρεμία.",
  },
];

const protectedAdminRoutes = [
  { path: "/admin", label: "Admin landing" },
  { path: "/admin/readiness", label: "Production Readiness" },
  { path: "/admin/articles", label: "Article Reviews" },
  { path: "/admin/engagement", label: "Article Engagement" },
  { path: "/admin/ai-usage", label: "AI Usage" },
  { path: "/admin/translations", label: "Translation Quality" },
  { path: "/admin/guardrails", label: "Guardrails" },
  { path: "/admin/cache", label: "Cache Observability" },
  { path: "/admin/feature-flags", label: "Runtime Feature Flags" },
  { path: "/admin/edge-snapshot", label: "Edge Snapshot" },
  { path: "/admin/local-ai", label: "Local AI" },
  { path: "/admin/home-server", label: "Home Server" },
  { path: "/admin/failover", label: "DNS Failover" },
  { path: "/admin/shards", label: "Worker Shards" },
  { path: "/admin/feed-health", label: "RSS Feed Health" },
  { path: "/admin/feeds", label: "Feed Management" },
  { path: "/admin/audit", label: "Audit Log" },
];

const backendPrimaryAdminOperations = [
  "load-admin-production-readiness",
  "load-admin-article-reviews",
  "load-admin-article-engagement",
  "load-admin-ai-usage",
  "load-admin-translation-quality",
  "load-admin-guardrails",
  "load-admin-local-ai",
  "load-admin-worker-shards",
  "load-admin-rss-feed-health",
  "load-admin-feed-management",
  "load-admin-audit-log",
];

const forbiddenAdminDashboardPatterns = [
  { label: "framework 404", pattern: /This page could not be found|NEXT_HTTP_ERROR_FALLBACK;404|404: This page could not be found/i },
  { label: "generic client exception", pattern: /Application error|Unhandled Runtime Error|Minified React error|Hydration failed because/i },
  { label: "backend-primary Supabase access error", pattern: /supabase_access_disabled_for_backend_primary|Server-side Supabase access is not configured|Missing SUPABASE_URL|Missing runtime public Supabase/i },
  { label: "admin dashboard setup warning", pattern: /Dashboard Setup Needed/i },
  { label: "admin database operation error", pattern: /Admin database operation/i },
];

const emailDeliveries = [];
const quotaEvents = [];
const backendDatabaseRequests = [];
let nextQuotaEventId = 1;
let supabaseOutageMode = false;

function logStep(message) {
  console.log(`▶ ${message}`);
}

function logOk(message) {
  console.log(`✓ ${message}`);
}

function fail(message) {
  throw new Error(message);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function json(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization,apikey,content-type,prefer,range,x-client-info",
    "access-control-expose-headers": "content-range",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function options(response) {
  response.writeHead(204, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,apikey,content-type,prefer,range,x-client-info,x-nutsnews-db-client",
  });
  response.end();
}

function stripColumns(row) {
  const { snapshot_rank: _snapshotRank, ...article } = row;
  return article;
}

function normalizeMockLanguageCode(value) {
  const languageCode = String(value ?? "").trim();
  return supportedLanguageCodes.has(languageCode) ? languageCode : "en";
}

function localizeEdgeSnapshotArticle(article, requestedLanguageCode) {
  const baseArticle = stripColumns(article);

  if (requestedLanguageCode !== "en") {
    const translatedSummary = articleSummaries.find(
      (summary) =>
        summary.original_url === article.original_url &&
        summary.language_code === requestedLanguageCode &&
        summary.title.trim() &&
        summary.summary.trim(),
    );

    if (translatedSummary) {
      return {
        ...baseArticle,
        title: translatedSummary.title,
        ai_summary: translatedSummary.summary,
        language_code: requestedLanguageCode,
        requested_language_code: requestedLanguageCode,
        translation_available: true,
      };
    }
  }

  return {
    ...baseArticle,
    language_code: "en",
    requested_language_code: requestedLanguageCode,
    translation_available: requestedLanguageCode === "en",
  };
}

function backendArticlesForRequest(body = {}) {
  const page = Number(body.page ?? 0);
  const pageSize = Number(body.pageSize ?? body.limit ?? articles.length);
  const offset = Number(body.offset ?? Math.max(0, page) * Math.max(1, pageSize));
  const requestedLanguageCode = normalizeMockLanguageCode(body.requestedLanguageCode);
  const category = String(body.category ?? "").toLowerCase();
  const query = String(body.query ?? "").toLowerCase();
  const rows = articles
    .filter((article) => !category || article.category.toLowerCase().includes(category))
    .filter((article) =>
      !query ||
      [article.title, article.ai_summary, article.source, article.category]
        .join(" ")
        .toLowerCase()
        .includes(query),
    )
    .sort((a, b) => a.snapshot_rank - b.snapshot_rank)
    .slice(Math.max(0, offset), Math.max(0, offset) + Math.max(1, pageSize))
    .map((article) => localizeEdgeSnapshotArticle(article, requestedLanguageCode));

  return rows;
}

function backendSitemapArticles() {
  return articles.map((article) => ({
    id: article.id,
    published_on_site_at: article.published_on_site_at,
    published_at: article.published_at,
  }));
}

function backendRowsSnapshot(row) {
  return {
    rows: [row],
    rowCount: 1,
    generatedAt: new Date().toISOString(),
  };
}

function backendAdminReadResult(operation) {
  switch (operation) {
    case "load-admin-production-readiness":
      return backendRowsSnapshot({
        articleCount: articles.length,
        publicFeedSnapshotCount: articles.length,
        recentArticles: articles.map(stripColumns),
        workerRun: null,
        articlesLast24Hours: articles.length,
        articlesLast7Days: articles.length,
        translationSummaries: articleSummaries.map(({ original_url, language_code }) => ({
          original_url,
          language_code,
        })),
        translationExpectedCount: articles.length * 5,
      });
    case "load-admin-article-reviews":
      return backendRowsSnapshot({
        sourceOptions: [],
        categoryOptions: [],
        recentPublishedArticleRows: [],
        recentPublishedReviewRows: [],
        versionReportRows: [],
        versionReportError: null,
        reviewRows: [],
        publishedArticlesForReviews: [],
        totalMatchingReviews: 0,
        reviewError: null,
      });
    case "load-admin-article-engagement":
      return backendRowsSnapshot({
        sourceCategoryRows: [],
        sourceCategoryError: null,
        articleRows: [],
        articleError: null,
      });
    case "load-admin-ai-usage":
      return backendRowsSnapshot({ usageRunRows: [] });
    case "load-admin-local-ai":
      return backendRowsSnapshot({ usageRunRows: [], recentReviewRows: [] });
    case "load-admin-translation-quality":
      return backendRowsSnapshot({ articleRows: [], summaryRows: [] });
    case "load-admin-guardrails":
      return backendRowsSnapshot({
        aiUsageRunRows: [],
        workerRunRows: [],
        quotaUsageEventRows: [],
        articleCount: articles.length,
        summaryCount: articleSummaries.length,
        feedCount: 0,
        partialErrors: [],
      });
    case "load-admin-worker-shards":
      return backendRowsSnapshot({ workerRunRows: [] });
    case "load-admin-rss-feed-health":
      return backendRowsSnapshot({ rssFeedRows: [], feedHealthRows: [] });
    case "load-admin-feed-management":
      return backendRowsSnapshot({ feedQualityRows: [] });
    case "load-admin-audit-log":
      return backendRowsSnapshot({ auditEventRows: [] });
    case "load-admin-runtime-feature-flags":
      return {
        rows: [
          {
            key: "reader_archive_search",
            enabled: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            key: "worker_public_feed_edge_snapshot_publish",
            enabled: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        rowCount: 2,
        generatedAt: new Date().toISOString(),
      };
    default:
      return null;
  }
}

function backendDatabaseOperationResult(operation, body = {}) {
  const adminResult = backendAdminReadResult(operation);
  if (adminResult) {
    return adminResult;
  }

  switch (operation) {
    case "load-public-feed-snapshot":
    case "load-published-articles":
    case "load-home-feed-snapshot":
      return backendArticlesForRequest(body);
    case "search-published-articles":
      return backendArticlesForRequest({ ...body, query: body.query ?? body.searchQuery });
    case "load-published-categories":
      return articles.map(({ category }) => ({ category }));
    case "load-article-detail": {
      const requestedLanguageCode = normalizeMockLanguageCode(body.requestedLanguageCode);
      const article = articles.find((row) => row.id === body.id) ?? null;
      return article ? localizeEdgeSnapshotArticle(article, requestedLanguageCode) : null;
    }
    case "load-recent-article-sitemap-items":
    case "load-article-sitemap-items-page":
      return backendSitemapArticles();
    case "load-published-article-sitemap-count":
      return { articleCount: articles.length };
    case "record-quota-usage-event":
    case "record-article-engagement-event":
      return { ok: true };
    default:
      return null;
  }
}

function applyRange(request, rows) {
  const rangeHeader = request.headers.range;

  if (!rangeHeader) {
    return rows;
  }

  const match = String(rangeHeader).match(/(\d+)-(\d+)/);

  if (!match) {
    return rows;
  }

  const start = Number(match[1]);
  const end = Number(match[2]);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return rows;
  }

  return rows.slice(start, end + 1);
}

function createSupabaseMockServer() {
  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        options(response);
        return;
      }

      const url = new URL(request.url ?? "/", supabaseUrl);

      if (
        supabaseOutageMode &&
        ["/rest/v1/public_feed_snapshot", "/rest/v1/articles", "/rest/v1/article_summaries"].includes(url.pathname)
      ) {
        json(response, 503, { error: "Mock Supabase outage for edge snapshot fallback test" });
        return;
      }

      if (url.pathname === "/rest/v1/public_feed_snapshot" && request.method === "HEAD") {
        response.writeHead(200, { "content-range": `0-0/${articles.length}` });
        response.end();
        return;
      }

      if (url.pathname === "/rest/v1/public_feed_snapshot" && request.method === "GET") {
        const rows = applyRange(
          request,
          articles.sort((a, b) => a.snapshot_rank - b.snapshot_rank).map(stripColumns),
        );
        json(response, 200, rows, { "content-range": `0-${rows.length - 1}/${articles.length}` });
        return;
      }

      if (url.pathname === "/rest/v1/articles" && request.method === "HEAD") {
        response.writeHead(200, { "content-range": `0-0/${articles.length}` });
        response.end();
        return;
      }

      if (url.pathname === "/rest/v1/articles" && request.method === "GET") {
        if (request.headers.prefer?.toString().includes("count=exact") || url.searchParams.get("select") === "*") {
          json(response, 200, [], { "content-range": `0-0/${articles.length}` });
          return;
        }

        const rows = applyRange(request, articles.map(stripColumns));
        json(response, 200, rows, { "content-range": `0-${rows.length - 1}/${articles.length}` });
        return;
      }

      if (url.pathname === "/rest/v1/article_summaries" && request.method === "HEAD") {
        response.writeHead(200, { "content-range": `0-0/${articleSummaries.length}` });
        response.end();
        return;
      }

      if (url.pathname === "/rest/v1/article_summaries" && request.method === "GET") {
        if (request.headers.prefer?.toString().includes("count=exact") || url.searchParams.get("select") === "*") {
          json(response, 200, [], { "content-range": `0-0/${articleSummaries.length}` });
          return;
        }

        const languageFilter = url.searchParams.get("language_code") ?? "";
        const languageMatch = languageFilter.match(/^eq\.(.+)$/);
        const languageCode = languageMatch?.[1];
        const rows = languageCode
          ? articleSummaries.filter((summary) => summary.language_code === languageCode)
          : articleSummaries;
        json(response, 200, rows, { "content-range": `0-${rows.length - 1}/${rows.length}` });
        return;
      }

      if (url.pathname === "/rest/v1/rss_feeds" && request.method === "HEAD") {
        response.writeHead(200, { "content-range": "0-0/1" });
        response.end();
        return;
      }

      if (url.pathname === "/rest/v1/rss_feeds" && request.method === "GET") {
        json(response, 200, [], { "content-range": "0-0/1" });
        return;
      }

      if (url.pathname === "/rest/v1/ai_usage_runs" && request.method === "GET") {
        json(response, 200, [], { "content-range": "0-0/0" });
        return;
      }

      if (url.pathname === "/rest/v1/worker_runs" && request.method === "GET") {
        json(response, 200, [], { "content-range": "0-0/0" });
        return;
      }

      if (url.pathname === "/rest/v1/quota_usage_events" && request.method === "GET") {
        json(response, 200, quotaEvents, { "content-range": `0-${quotaEvents.length - 1}/${quotaEvents.length}` });
        return;
      }

      if (url.pathname === "/rest/v1/quota_usage_events" && request.method === "POST") {
        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");
        quotaEvents.push({
          id: nextQuotaEventId++,
          created_at: new Date().toISOString(),
          event_type: payload.event_type,
          event_source: payload.event_source,
          provider: payload.provider,
          quantity: payload.quantity ?? 1,
          metadata: payload.metadata ?? {},
        });
        json(response, 201, [quotaEvents.at(-1)]);
        return;
      }

      if (url.pathname === "/rest/v1/rpc/search_articles" && request.method === "POST") {
        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");
        const query = String(payload.search_query ?? "").toLowerCase();
        const rows = articles
          .filter((article) =>
            [article.title, article.ai_summary, article.source, article.category]
              .join(" ")
              .toLowerCase()
              .includes(query),
          )
          .map(stripColumns);
        json(response, 200, rows);
        return;
      }

      json(response, 404, { error: `Unhandled mock Supabase route ${request.method} ${url.pathname}` });
    } catch (error) {
      json(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  return server;
}

function createExternalMockServer() {
  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        options(response);
        return;
      }

      const url = new URL(request.url ?? "/", mockExternalUrl);

      if (url.pathname.startsWith("/api/app/db/") && request.method === "POST") {
        if (request.headers.authorization !== "Bearer offline-e2e-backend-token") {
          json(response, 401, { error: "Mock backend database token rejected" });
          return;
        }

        const operation = decodeURIComponent(url.pathname.slice("/api/app/db/".length));
        const body = JSON.parse((await readBody(request)) || "{}");
        const payload = backendDatabaseOperationResult(operation, body);
        backendDatabaseRequests.push({ operation, body });

        if (payload === null) {
          json(response, 404, { error: `Unhandled mock backend database operation ${operation}` });
          return;
        }

        json(response, 200, payload);
        return;
      }

      if (url.pathname === "/public-feed-snapshot/status" && request.method === "GET") {
        json(
          response,
          200,
          {
            configured: true,
            enabled: true,
            ready: true,
            kvBound: true,
            status: "hit",
            updatedAt: "2026-06-28T02:00:00.000Z",
            refreshedAt: "2026-06-28T01:59:00.000Z",
            ageSeconds: 120,
            articleCount: articles.length,
            maxArticles: articles.length,
            version: 1,
            shardIndex: 0,
          },
          {
            "x-nutsnews-edge-snapshot": "hit",
            "x-nutsnews-edge-snapshot-updated-at": "2026-06-28T02:00:00.000Z",
            "x-nutsnews-edge-snapshot-age-seconds": "120",
            "x-nutsnews-edge-snapshot-article-count": String(articles.length),
            "x-nutsnews-edge-snapshot-version": "1",
          },
        );
        return;
      }

      if (url.pathname === "/public-feed-snapshot" && request.method === "GET") {
        const page = Number(url.searchParams.get("page") ?? "0");
        const pageSize = Number(url.searchParams.get("pageSize") ?? "5");
        const category = (url.searchParams.get("category") ?? "").toLowerCase();
        const requestedLanguageCode = normalizeMockLanguageCode(url.searchParams.get("lang"));
        const filteredArticles = category
          ? articles.filter((article) => article.category.toLowerCase().includes(category))
          : articles;
        const from = Math.max(0, page) * Math.max(1, pageSize);
        const rows = filteredArticles
          .slice(from, from + Math.max(1, pageSize))
          .map((article) => localizeEdgeSnapshotArticle(article, requestedLanguageCode));

        json(
          response,
          200,
          {
            articles: rows,
            nextPage: filteredArticles.length > from + pageSize ? page + 1 : null,
            nextCursor: null,
            dataSource: "edge_feed_snapshot",
            languageCode: requestedLanguageCode,
            edgeSnapshot: {
              status: "hit",
              updatedAt: "2026-06-28T02:00:00.000Z",
              ageSeconds: 120,
              articleCount: articles.length,
              version: 1,
            },
          },
          {
            "x-nutsnews-edge-snapshot": "hit",
            "x-nutsnews-edge-snapshot-updated-at": "2026-06-28T02:00:00.000Z",
            "x-nutsnews-edge-snapshot-age-seconds": "120",
            "x-nutsnews-edge-snapshot-article-count": String(articles.length),
            "x-nutsnews-edge-snapshot-version": "1",
          },
        );
        return;
      }

      if ((url.pathname === "/images/super-puff.png" || url.pathname === "/images/therapy-dogs.png") && request.method === "GET") {
        const png = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
          "base64",
        );
        response.writeHead(200, {
          "content-type": "image/png",
          "cache-control": "public, max-age=31536000, immutable",
        });
        response.end(png);
        return;
      }

      if (url.pathname === "/turnstile/v0/siteverify" && request.method === "POST") {
        await readBody(request);
        json(response, 200, { success: true, challenge_ts: new Date().toISOString(), hostname: "localhost" });
        return;
      }

      if (url.pathname === "/emails" && request.method === "POST") {
        const body = await readBody(request);
        const payload = JSON.parse(body || "{}");
        emailDeliveries.push(payload);
        json(response, 200, { id: `mock-email-${emailDeliveries.length}` });
        return;
      }

      json(response, 404, { error: `Unhandled external mock route ${request.method} ${url.pathname}` });
    } catch (error) {
      json(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  return server;
}

function listen(server, port, label) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      logOk(`${label} listening on http://127.0.0.1:${port}`);
      resolve();
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function waitForUrl(url, timeoutMs = 60000, child) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (child?.e2eSpawnError) {
      fail(`Next.js failed to start: ${child.e2eSpawnError.message}`);
    }

    if (child && child.exitCode !== null) {
      const output = child.e2eOutput ? `\n\nNext.js output:\n${child.e2eOutput.slice(-4000)}` : "";
      fail(`Next.js dev server exited early with code ${child.exitCode}.${output}`);
    }

    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep waiting.
    }

    await delay(500);
  }

  const output = child?.e2eOutput ? `\n\nNext.js output:\n${child.e2eOutput.slice(-4000)}` : "";
  fail(`Timed out waiting for ${url}.${output}`);
}

function startNextDev({
  port = webPort,
  baseUrl = webUrl,
  envOverrides = {},
} = {}) {
  const child = spawn(npmCommand, ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: webDir,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
      NUTSNEWS_RUNTIME_ENV: "staging",
      NUTSNEWS_SIDE_EFFECTS_MODE: "sandbox",
      NUTSNEWS_DATA_ENVIRONMENT: "staging",
      NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "staging",
      NUTSNEWS_SUPABASE_PROJECT_REF: "offline-e2e-fixture",
      NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "production-fixture",
      NUTSNEWS_SANDBOX_CONTACT: "true",
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "offline-e2e-anon-key",
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: "offline-e2e-service-role-key",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "offline-e2e-turnstile-site-key",
      TURNSTILE_SECRET_KEY: "offline-e2e-turnstile-secret-key",
      TURNSTILE_VERIFY_URL: `${mockExternalUrl}/turnstile/v0/siteverify`,
      RESEND_API_KEY: "offline-e2e-resend-key",
      RESEND_EMAILS_URL: `${mockExternalUrl}/emails`,
      CONTACT_TO_EMAIL: "rami@example.test",
      CONTACT_FROM_EMAIL: "NutsNews Offline E2E <noreply@example.test>",
      AUTH_SECRET: "offline-e2e-auth-secret-not-for-production",
      NEXTAUTH_URL: baseUrl,
      NEXT_PUBLIC_APP_ENV: "staging",
      NUTSNEWS_PUBLIC_APP_ENV: "staging",
      NUTSNEWS_PUBLIC_SIDE_EFFECTS_MODE: "sandbox",
      NUTSNEWS_DATABASE_PROVIDER_MODE: "supabase_primary",
      NUTSNEWS_BACKEND_POSTGRES_PRIMARY_CONFIRMATION: "",
      NUTSNEWS_BACKEND_API_URL: "",
      NUTSNEWS_BACKEND_API_TOKEN: "",
      ACTIONS_READ_TOKEN: "",
      CLOUDFLARE_API_TOKEN: "",
      CLOUDFLARE_ACCOUNT_ID: "",
      CLOUDFLARE_ZONE_ID: "",
      HOME_SERVER_STATS_URL: "",
      HOME_SERVER_STATS_API_KEY: "",
      LOCAL_AI_API_KEY: "",
      NUTSNEWS_FAILOVER_CONTROLLER_STATUS_URL: "",
      NUTSNEWS_FAILOVER_CONTROLLER_ACTION_URL: "",
      NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET: "",
      NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET: "",
      NUTSNEWS_CACHE_OBSERVABILITY_URL: baseUrl,
      NUTSNEWS_CACHE_ARTICLE_PATH: `/articles/${articles[0].id}`,
      NUTSNEWS_EDGE_FEED_SNAPSHOT_URL: mockExternalUrl,
      NUTSNEWS_ADMIN_TEST_AUTH_BYPASS: "true",
      NUTSNEWS_TEST_USER_NAMESPACE: "nutsnews-test-offline-e2e",
      ...envOverrides,
    },
  });

  child.e2eOutput = "";
  child.once("error", (error) => {
    child.e2eSpawnError = error;
    console.error(`Next.js dev server failed to spawn from ${webDir}: ${error.message}`);
  });
  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    child.e2eOutput += text;
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    child.e2eOutput += text;
    process.stderr.write(chunk);
  });

  return child;
}

function signalProcessTree(child, signal) {
  if (!child?.pid) {
    return;
  }

  try {
    if (process.platform === "win32") {
      child.kill(signal);
    } else {
      process.kill(-child.pid, signal);
    }
  } catch (error) {
    if (error?.code !== "ESRCH") {
      throw error;
    }
  }
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  let exited = false;
  const exitPromise = new Promise((resolve) => {
    child.once("exit", () => {
      exited = true;
      resolve();
    });
  });

  signalProcessTree(child, "SIGTERM");
  await Promise.race([exitPromise, delay(5000)]);

  if (!exited) {
    signalProcessTree(child, "SIGKILL");
    await Promise.race([exitPromise, delay(5000)]);
  }
}

async function verifyProtectedAdminDashboardRoutes(page, { providerLabel }) {
  const pageErrors = [];
  const onPageError = (error) => {
    pageErrors.push(`${error.name}: ${error.message}`);
  };

  page.on("pageerror", onPageError);

  try {
    for (const route of protectedAdminRoutes) {
      pageErrors.length = 0;
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      const finalPath = new URL(page.url()).pathname;
      const status = response?.status() ?? 0;

      if (finalPath !== route.path) {
        fail(`${providerLabel} protected admin route ${route.path} redirected to ${finalPath}.`);
      }

      if (status === 404 || status >= 500) {
        fail(`${providerLabel} protected admin route ${route.path} returned HTTP ${status}.`);
      }

      await expect(page.locator("main")).toBeVisible({ timeout: 20000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

      if (pageErrors.length > 0) {
        fail(`${providerLabel} protected admin route ${route.path} raised a client error: ${pageErrors.join("; ")}`);
      }

      const bodyText = await page.locator("body").innerText({ timeout: 10000 });
      for (const { label, pattern } of forbiddenAdminDashboardPatterns) {
        if (pattern.test(bodyText)) {
          fail(`${providerLabel} protected admin route ${route.path} rendered ${label} copy.`);
        }
      }
    }
  } finally {
    page.off("pageerror", onPageError);
  }
}

async function runBrowserChecks() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: webUrl });
  await context.route("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        window.turnstile = {
          render: function(container, options) {
            container.setAttribute('data-mock-turnstile', 'rendered');
            setTimeout(function(){ options && options.callback && options.callback('mock-turnstile-token'); }, 25);
            return 'mock-widget-id';
          },
          reset: function() {},
          remove: function() {}
        };
      `,
    });
  });

  await context.route("**/_next/image**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lV6I8QAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  });

  const page = await context.newPage();

  async function openSettingsPanel() {
    const settingsButton = page.getByTestId("nutsnews-settings-toggle");
    const settingsPanel = page.getByTestId("nutsnews-settings-panel");

    await expect(settingsButton).toBeVisible({ timeout: 20000 });
    await settingsButton.scrollIntoViewIfNeeded();

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (await settingsPanel.isVisible().catch(() => false)) {
        return settingsPanel;
      }

      await settingsButton.click({ force: true });

      try {
        await expect(settingsPanel).toBeVisible({ timeout: 10000 });
        return settingsPanel;
      } catch {
        await settingsButton.evaluate((button) => button.click());
        try {
          await expect(settingsPanel).toBeVisible({ timeout: 10000 });
          return settingsPanel;
        } catch {
          if (attempt === 3) {
            throw new Error("Settings panel did not open after clicking the footer settings button.");
          }
          await delay(500);
        }
      }
    }

    throw new Error("Settings panel did not open.");
  }

  async function closeSettingsPanel() {
    const settingsPanel = page.getByTestId("nutsnews-settings-panel");

    if (!(await settingsPanel.isVisible().catch(() => false))) {
      return;
    }

    const settingsButton = page.getByTestId("nutsnews-settings-toggle");
    await settingsButton.click({ force: true });
    await expect(settingsPanel).toBeHidden({ timeout: 10000 }).catch(() => {});
  }

  async function firstArticleTitle() {
    const firstTitle = page.getByTestId("nutsnews-article-card").first().locator(".wp-article-card__title");
    await expect(firstTitle).not.toHaveText("", { timeout: 10000 });
    return (await firstTitle.innerText()).trim();
  }

  logStep("Verifying homepage rendering");
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toContainText("Nuts");
  await expect(page.locator("h1")).toContainText("News");
  await expect(page.getByText(articles[0].title).first()).toBeVisible();
  logOk("Homepage rendered with mock article");

  logStep("Verifying footer home, search, settings, themes, about, contact, and privacy controls");
  const footerHomeButton = page.getByTestId("nutsnews-footer-home");
  await expect(footerHomeButton).toBeAttached({ timeout: 10000 });
  await page.evaluate(() => {
    const maxScrollTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: Math.min(700, maxScrollTop), behavior: "instant" });
  });
  await expect.poll(async () => page.evaluate(() => window.scrollY), { timeout: 10000 }).toBeGreaterThan(50);
  await footerHomeButton.dispatchEvent("click");
  await expect.poll(async () => page.evaluate(() => window.scrollY), { timeout: 10000 }).toBeLessThanOrEqual(4);
  await expect(page).toHaveURL(/\/(?:#top)?$/);

  await openSettingsPanel();
  await page.getByTestId("nutsnews-settings-theme").click();
  for (const themeId of ["amber", "sakura", "modern-saas", "san-juan", "creative-premium", "moody-cyberpunk"]) {
    await page.getByTestId(`nutsnews-theme-option-${themeId}`).click();
    await expect(page.locator("html")).toHaveAttribute("data-nutsnews-theme", themeId);
  }
  await closeSettingsPanel();
  logOk("Settings menu applied every theme");

  await page.getByTestId("nutsnews-footer-search").click();
  const searchDialog = page.getByTestId("nutsnews-search-dialog");
  await expect(searchDialog).toBeVisible();
  await page.getByTestId("nutsnews-search-input").fill("dogs");
  await page.getByTestId("nutsnews-search-submit").click();
  await expect(page.getByText(articles[1].title).first()).toBeVisible();
  await expect.poll(async () => page.getByTestId("nutsnews-search-result-card").count(), { timeout: 10000 }).toBeGreaterThan(0);
  await searchDialog.getByRole("button", { name: "Close search", exact: true }).click();
  logOk("Footer search for dogs returned a mock article");

  const footer = page.locator("footer");
  const footerNavigationTimeoutMs = 20000;

  async function clickFooterLink(name, path, expectedUrlPattern) {
    const link = footer.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", path);
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await page.waitForURL(expectedUrlPattern, { timeout: footerNavigationTimeoutMs });
  }

  await clickFooterLink("Apps", "/apps", /\/apps$/);
  await expect(page.locator("main").getByText("NutsNews for iPhone is here.", { exact: true })).toBeVisible({
    timeout: footerNavigationTimeoutMs,
  });

  await clickFooterLink("About", "/about", /\/about$/);
  await expect(page.locator("main").getByText("About NutsNews", { exact: true })).toBeVisible({
    timeout: footerNavigationTimeoutMs,
  });

  await clickFooterLink("Privacy", "/privacy", /\/privacy$/);
  await expect(page.locator("main").getByText(/Privacy Policy|NutsNews Privacy Policy/i).first()).toBeVisible({
    timeout: footerNavigationTimeoutMs,
  });

  await clickFooterLink("Contact", "/contact", /\/contact$/);
  await expect(page.locator("main").getByRole("heading", { name: /Send a message/i })).toBeVisible({
    timeout: footerNavigationTimeoutMs,
  });
  logOk("Footer navigation links render public pages");

  logStep("Verifying contact form sends email through mock Resend");
  await page.getByLabel("Your email").fill("reader@example.test");
  await page.getByLabel("Message").fill("This is an offline regression test contact message for NutsNews.");
  await page.waitForFunction(() => document.querySelector('[data-mock-turnstile="rendered"]'));
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Thanks. Your message was sent to NutsNews.")).toBeVisible({ timeout: 10000 });

  if (emailDeliveries.length !== 1) {
    fail(`Expected exactly 1 mock email delivery, got ${emailDeliveries.length}.`);
  }

  if (!emailDeliveries[0]?.reply_to?.includes("reader@example.test")) {
    fail("Mock email delivery did not include the submitted reply_to address.");
  }
  logOk("Contact form sent one mock email");

  logStep("Verifying language switch renders translated article text for every supported language");
  await page.goto("/", { waitUntil: "networkidle" });
  const englishTitle = await firstArticleTitle();
  const languageSettingsPanel = await openSettingsPanel();
  await languageSettingsPanel.getByTestId("nutsnews-settings-language").click();

  for (const languageCode of ["fr", "ja", "de-CH", "de", "el"]) {
    const translatedSummary = articleSummaries.find(
      (summary) => summary.original_url === articleUrlOne && summary.language_code === languageCode,
    );

    if (!translatedSummary) {
      fail(`Missing mock translated summary for ${languageCode}.`);
    }

    const articleResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/articles") && response.url().includes(`lang=${languageCode}`),
    );

    await languageSettingsPanel.getByTestId(`nutsnews-language-option-${languageCode}`).click();
    await articleResponsePromise;
    await expect(page.locator("html")).toHaveAttribute("lang", languageCode);
    await expect(page.getByText(translatedSummary.title).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("nutsnews-article-card").first()).toHaveAttribute("lang", languageCode);
    expect(await firstArticleTitle()).not.toBe(englishTitle);
  }

  await languageSettingsPanel.getByTestId("nutsnews-language-option-en").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("nutsnews-article-card").first()).toHaveAttribute("lang", "en");
  await expect.poll(async () => firstArticleTitle(), { timeout: 10000 }).toBe(englishTitle);
  logOk("Language changes rendered translated articles and returned to English");

  logStep("Verifying /api/articles falls back to the localized edge snapshot during a Supabase outage");
  const edgeFallbackLanguageCode = "fr";
  const localizedEdgeSummary = articleSummaries.find(
    (summary) => summary.original_url === articleUrlOne && summary.language_code === edgeFallbackLanguageCode,
  );

  if (!localizedEdgeSummary) {
    fail(`Missing localized edge fallback summary for ${edgeFallbackLanguageCode}.`);
  }

  supabaseOutageMode = true;
  try {
    const fallbackResponse = await page.request.get(
      `/api/articles?page=0&category=Science&lang=${edgeFallbackLanguageCode}&edgeFallbackTest=${runId}`,
    );
    expect(fallbackResponse.ok()).toBeTruthy();
    const fallbackHeaders = fallbackResponse.headers();
    expect(fallbackHeaders["x-nutsnews-article-data-source"]).toBe("edge_feed_snapshot");
    expect(fallbackHeaders["x-nutsnews-article-language"]).toBe(edgeFallbackLanguageCode);
    expect(fallbackHeaders["x-nutsnews-feed-snapshot"]).toBe("edge-fallback");
    expect(fallbackHeaders["x-nutsnews-edge-snapshot"]).toBe("hit");
    const fallbackPayload = await fallbackResponse.json();
    expect(fallbackPayload.languageCode).toBe(edgeFallbackLanguageCode);
    expect(fallbackPayload.articles.length).toBeGreaterThan(0);
    expect(fallbackPayload.articles[0].title).toBe(localizedEdgeSummary.title);
    expect(fallbackPayload.articles[0].ai_summary).toBe(localizedEdgeSummary.summary);
    expect(fallbackPayload.articles[0].language_code).toBe(edgeFallbackLanguageCode);
    expect(fallbackPayload.articles[0].requested_language_code).toBe(edgeFallbackLanguageCode);
    expect(fallbackPayload.articles[0].translation_available).toBe(true);

    const missingTranslationResponse = await page.request.get(
      `/api/articles?page=0&category=Fallback&lang=${edgeFallbackLanguageCode}&edgeFallbackMissingTest=${runId}`,
    );
    expect(missingTranslationResponse.ok()).toBeTruthy();
    const missingTranslationHeaders = missingTranslationResponse.headers();
    expect(missingTranslationHeaders["x-nutsnews-article-data-source"]).toBe("edge_feed_snapshot");
    expect(missingTranslationHeaders["x-nutsnews-article-language"]).toBe(edgeFallbackLanguageCode);
    expect(missingTranslationHeaders["x-nutsnews-feed-snapshot"]).toBe("edge-fallback");
    expect(missingTranslationHeaders["x-nutsnews-edge-snapshot"]).toBe("hit");
    const missingTranslationPayload = await missingTranslationResponse.json();
    expect(missingTranslationPayload.languageCode).toBe(edgeFallbackLanguageCode);
    expect(missingTranslationPayload.articles.length).toBeGreaterThan(0);
    expect(missingTranslationPayload.articles[0].original_url).toBe(articleUrlThree);
    expect(missingTranslationPayload.articles[0].title).toContain(`Mock English-only fallback story ${runId}`);
    expect(missingTranslationPayload.articles[0].language_code).toBe("en");
    expect(missingTranslationPayload.articles[0].requested_language_code).toBe(edgeFallbackLanguageCode);
    expect(missingTranslationPayload.articles[0].translation_available).toBe(false);
  } finally {
    supabaseOutageMode = false;
  }
  logOk("Article API recovered from localized edge fallback and explicit missing-translation fallback");

  logStep("Verifying protected admin dashboards render through staging auth bypass in Supabase primary mode");
  await verifyProtectedAdminDashboardRoutes(page, { providerLabel: "Supabase primary" });
  logOk(`Protected admin dashboard smoke rendered ${protectedAdminRoutes.length} routes in Supabase primary mode`);

  logStep("Verifying admin edge snapshot dashboard reflects Worker health");
  await page.goto("/admin/edge-snapshot", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toHaveAttribute("data-edge-snapshot-ready", "true");
  await expect(page.getByRole("heading", { name: "Edge Feed Snapshot" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading", { name: "Edge fallback ready" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Worker KV binding", { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("HTTP status", { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(String(articles.length), { exact: true }).first()).toBeVisible({ timeout: 10000 });
  logOk("Admin edge snapshot dashboard reflected the mocked healthy Worker status");

  await browser.close();
}

async function runBackendPostgresPrimaryAdminSmoke(baseUrl) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();

  try {
    logStep("Verifying protected admin dashboards render through staging auth bypass in backend PostgreSQL primary mode");
    await verifyProtectedAdminDashboardRoutes(page, { providerLabel: "Backend PostgreSQL primary" });
    logOk(`Protected admin dashboard smoke rendered ${protectedAdminRoutes.length} routes in backend PostgreSQL primary mode`);
  } finally {
    await browser.close();
  }

  const missingOperations = backendPrimaryAdminOperations.filter(
    (operation) => !backendDatabaseRequests.some((request) => request.operation === operation),
  );

  if (missingOperations.length > 0) {
    fail(`Backend PostgreSQL primary admin smoke did not call expected backend operations: ${missingOperations.join(", ")}`);
  }

  logOk(`Backend PostgreSQL primary smoke exercised ${backendPrimaryAdminOperations.length} migrated admin database operations`);
}

async function run() {
  let nextProcess;
  const supabaseServer = createSupabaseMockServer();
  const externalServer = createExternalMockServer();

  console.log(`NutsNews fully offline Web E2E regression run: ${runId}`);
  console.log(`Mock Supabase URL: ${supabaseUrl}`);
  console.log(`Mock external service URL: ${mockExternalUrl}`);
  console.log(`Web URL: ${webUrl}`);
  console.log(`Backend primary Web URL: ${backendWebUrl}`);

  try {
    logStep("Starting mock Supabase and external service servers");
    await listen(supabaseServer, supabasePort, "Mock Supabase/PostgREST server");
    await listen(externalServer, mockExternalPort, "Mock Turnstile/Resend server");

    logStep("Starting real Next.js app against mock services");
    nextProcess = startNextDev();
    await waitForUrl(webUrl, 90000, nextProcess);
    logOk("Next.js app is ready");

    await runBrowserChecks();

    logStep("Restarting Next.js app in backend PostgreSQL primary mode for protected admin smoke");
    await stopChild(nextProcess);
    nextProcess = startNextDev({
      port: backendWebPort,
      baseUrl: backendWebUrl,
      envOverrides: {
        NUTSNEWS_DATABASE_PROVIDER_MODE: "backend_postgres_primary",
        NUTSNEWS_BACKEND_POSTGRES_PRIMARY_CONFIRMATION: "enable-backend-postgres-primary",
        NUTSNEWS_BACKEND_API_URL: `${mockExternalUrl}/api/app/db`,
        NUTSNEWS_BACKEND_API_TOKEN: "offline-e2e-backend-token",
        NUTSNEWS_BACKEND_API_TIMEOUT_MS: "2000",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
        NUTSNEWS_PUBLIC_SUPABASE_URL: "",
        NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY: "",
        SUPABASE_URL: "",
        NUTSNEWS_SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "",
        NUTSNEWS_SUPABASE_PROJECT_REF: "",
        NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "",
      },
    });
    await waitForUrl(backendWebUrl, 90000, nextProcess);
    logOk("Next.js app is ready in backend PostgreSQL primary mode");

    await runBackendPostgresPrimaryAdminSmoke(backendWebUrl);

    if (quotaEvents.filter((event) => event.event_type === "email_send").length !== 1) {
      fail("Expected one quota_usage_events email_send row after contact form submission.");
    }

    console.log("✅ NutsNews fully offline Web E2E regression passed.");
  } finally {
    logStep("Stopping Next.js app and mock services");
    await stopChild(nextProcess);
    await closeServer(supabaseServer);
    await closeServer(externalServer);
    logOk("Cleanup complete; exiting Web E2E regression.");
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ NutsNews fully offline Web E2E regression failed.");
    console.error(error);
    process.exit(1);
  });
