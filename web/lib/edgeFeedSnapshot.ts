import {
  CATEGORY_SECTION_SIZE,
  getHomeFeedFromSnapshot,
  getPublishedArticles,
  getPublishedArticlesForSection,
  HOME_FEED_SECTIONS,
  PAGE_SIZE,
  type Article,
  type FeedDependencyState,
  type FeedDegradationStatus,
  type HomeFeedPayload,
  type PublicFeedEdgeSnapshotMetadata,
  type PublishedArticlesResult,
} from "@/lib/articles";
import {
  dedupeArticlesByIdentity,
  getArticleIdentityKey,
} from "@/lib/articleIdentity";
import {
  DEFAULT_LANGUAGE_CODE,
  normalizeLanguageCode,
  type LanguageCode,
} from "@/lib/languages";
import { logWarn } from "@/lib/logger";

const EDGE_SNAPSHOT_URL_ENV_KEYS = [
  "NUTSNEWS_EDGE_FEED_SNAPSHOT_URL",
  "NUTSNEWS_EDGE_SNAPSHOT_URL",
] as const;
const MAX_EDGE_SNAPSHOT_PAGE_SIZE = 50;

type EdgeSnapshotPayload = {
  articles?: Article[];
  nextPage?: number | null;
  nextCursor?: string | null;
  dataSource?: string;
  languageCode?: string;
  edgeSnapshot?: PublicFeedEdgeSnapshotMetadata | null;
  snapshot?: {
    version?: number | null;
    updatedAt?: string | null;
    ageSeconds?: number | null;
    articleCount?: number | null;
  } | null;
};

export type EdgeFeedSnapshotStatus = PublicFeedEdgeSnapshotMetadata & {
  configured: boolean;
  enabled: boolean;
  ready: boolean;
  kvBound: boolean | null;
  httpStatus: number | null;
  articleCount: number | null;
  maxArticles?: number | null;
  refreshedAt?: string | null;
};

type HomeFeedDegradationOptions = {
  mode: FeedDegradationStatus["mode"];
  reason: string;
  message: string;
  supabase?: FeedDependencyState;
  edgeSnapshot?: FeedDependencyState;
  worker?: FeedDependencyState;
  localAi?: FeedDependencyState;
  translations?: FeedDependencyState;
};

function getConfiguredEdgeSnapshotBaseUrl() {
  for (const key of EDGE_SNAPSHOT_URL_ENV_KEYS) {
    const value = process.env[key]?.trim();

    if (value) {
      return value.replace(/\/+$/, "");
    }
  }

  return null;
}

function getEdgeSnapshotEndpoint(path = "") {
  const baseUrl = getConfiguredEdgeSnapshotBaseUrl();

  if (!baseUrl) {
    return null;
  }

  if (baseUrl.endsWith("/public-feed-snapshot")) {
    return `${baseUrl}${path}`;
  }

  return `${baseUrl}/public-feed-snapshot${path}`;
}

function readHeaderNumber(headers: Headers, name: string) {
  const value = headers.get(name);

  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readHeaderText(headers: Headers, name: string) {
  const value = headers.get(name);
  return value && value.trim() ? value.trim() : null;
}

function normalizeEdgeArticles(articles: Article[], requestedLanguageCode: LanguageCode) {
  return dedupeArticlesByIdentity(articles).map((article) => ({
    ...article,
    language_code: DEFAULT_LANGUAGE_CODE,
    requested_language_code: requestedLanguageCode,
    translation_available: requestedLanguageCode === DEFAULT_LANGUAGE_CODE,
  }));
}

function buildHomeFeedDegradationStatus({
  mode,
  reason,
  message,
  supabase = "unknown",
  edgeSnapshot = "unknown",
  worker = "unknown",
  localAi = "unknown",
  translations = "unknown",
}: HomeFeedDegradationOptions): FeedDegradationStatus {
  return {
    mode,
    reason,
    message,
    services: {
      supabase,
      edgeSnapshot,
      worker,
      localAi,
      translations,
    },
    loggedAt: new Date().toISOString(),
  };
}

function emptyHomeFeedSections(): HomeFeedPayload["sections"] {
  return HOME_FEED_SECTIONS.map((section) => ({
    id: section.id,
    articles: [],
  }));
}

async function logHomeFeedDegradation(
  event: string,
  message: string,
  fields: Record<string, unknown> = {},
) {
  try {
    await logWarn(event, message, {
      route: "home-feed",
      ...fields,
    });
  } catch (error) {
    console.warn("Failed to log home feed degradation event:", error);
  }
}

export function createMaintenanceHomeFeedPayload(
  requestedLanguageCode?: string | null,
  options: Partial<HomeFeedDegradationOptions> = {},
): HomeFeedPayload {
  const languageCode = normalizeLanguageCode(requestedLanguageCode);

  return {
    articles: [],
    nextPage: null,
    nextCursor: null,
    dataSource: "articles_fallback",
    languageCode,
    sections: emptyHomeFeedSections(),
    degradation: buildHomeFeedDegradationStatus({
      mode: "maintenance",
      reason: "no_public_feed_data",
      message:
        "NutsNews is showing a maintenance state while the public feed dependencies recover.",
      supabase: "unavailable",
      edgeSnapshot: "unavailable",
      worker: "unknown",
      localAi: "unknown",
      translations: "unknown",
      ...options,
    }),
  };
}

function buildEdgeMetadata(response: Response, endpoint: string): PublicFeedEdgeSnapshotMetadata {
  return {
    status: response.ok ? "hit" : "error",
    updatedAt: readHeaderText(response.headers, "X-NutsNews-Edge-Snapshot-Updated-At"),
    ageSeconds: readHeaderNumber(response.headers, "X-NutsNews-Edge-Snapshot-Age-Seconds"),
    articleCount: readHeaderNumber(response.headers, "X-NutsNews-Edge-Snapshot-Article-Count"),
    version: readHeaderNumber(response.headers, "X-NutsNews-Edge-Snapshot-Version"),
    endpoint,
  };
}

export async function getEdgeFeedSnapshotPage({
  page = 0,
  category,
  pageSize = PAGE_SIZE,
  requestedLanguageCode,
}: {
  page?: number;
  category?: string | null;
  pageSize?: number;
  requestedLanguageCode?: string | null;
}): Promise<PublishedArticlesResult | null> {
  const endpoint = getEdgeSnapshotEndpoint();

  if (!endpoint) {
    return null;
  }

  const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
  const safePageSize = Number.isFinite(pageSize)
    ? Math.min(Math.max(Math.floor(pageSize), 1), MAX_EDGE_SNAPSHOT_PAGE_SIZE)
    : PAGE_SIZE;
  const languageCode = normalizeLanguageCode(requestedLanguageCode);
  const url = new URL(endpoint);

  url.searchParams.set("page", String(safePage));
  url.searchParams.set("pageSize", String(safePageSize));

  if (category?.trim()) {
    url.searchParams.set("category", category.trim());
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Failed to load Cloudflare edge feed snapshot fallback:", response.status, await response.text());
      return null;
    }

    const payload = (await response.json()) as EdgeSnapshotPayload;
    const articles = Array.isArray(payload.articles) ? payload.articles : [];
    const edgeSnapshot = payload.edgeSnapshot ?? {
      ...buildEdgeMetadata(response, endpoint),
      updatedAt: payload.snapshot?.updatedAt ?? readHeaderText(response.headers, "X-NutsNews-Edge-Snapshot-Updated-At"),
      ageSeconds: payload.snapshot?.ageSeconds ?? readHeaderNumber(response.headers, "X-NutsNews-Edge-Snapshot-Age-Seconds"),
      articleCount: payload.snapshot?.articleCount ?? readHeaderNumber(response.headers, "X-NutsNews-Edge-Snapshot-Article-Count"),
      version: payload.snapshot?.version ?? readHeaderNumber(response.headers, "X-NutsNews-Edge-Snapshot-Version"),
    };

    return {
      articles: normalizeEdgeArticles(articles, languageCode),
      nextPage: typeof payload.nextPage === "number" ? payload.nextPage : null,
      nextCursor: null,
      dataSource: "edge_feed_snapshot",
      languageCode,
      edgeSnapshot,
    };
  } catch (error) {
    console.error("Cloudflare edge feed snapshot fallback threw an exception:", error);
    return null;
  }
}

function shouldUseEdgeFallback(result: PublishedArticlesResult) {
  return result.dataSource === "articles_fallback" && result.articles.length === 0;
}

export async function getPublishedArticlesWithEdgeFallback(
  page = 0,
  category?: string | null,
  requestedLanguageCode?: string | null,
): Promise<PublishedArticlesResult> {
  let result: PublishedArticlesResult | null = null;

  try {
    result = await getPublishedArticles(page, category, requestedLanguageCode);

    if (!shouldUseEdgeFallback(result)) {
      return result;
    }
  } catch (error) {
    console.error("Published article read threw before edge snapshot fallback:", error);
  }

  const edgeResult = await getEdgeFeedSnapshotPage({
    page,
    category,
    requestedLanguageCode,
  });

  if (edgeResult) {
    return edgeResult;
  }

  if (result) {
    return result;
  }

  const languageCode = normalizeLanguageCode(requestedLanguageCode);

  return {
    articles: [],
    nextPage: null,
    nextCursor: null,
    dataSource: "articles_fallback",
    languageCode,
  };
}

export async function getHomeFeedDataWithEdgeFallback(
  requestedLanguageCode?: string | null,
): Promise<HomeFeedPayload> {
  let snapshotResult: HomeFeedPayload | null = null;

  try {
    snapshotResult = await getHomeFeedFromSnapshot(requestedLanguageCode);
  } catch (error) {
    await logHomeFeedDegradation(
      "web.home_feed.snapshot_read_failed",
      "Homepage public feed snapshot read failed before fallback.",
      {
        languageCode: normalizeLanguageCode(requestedLanguageCode),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    );
  }

  if (snapshotResult) {
    return snapshotResult;
  }

  let mainResult: PublishedArticlesResult;
  let sections: HomeFeedPayload["sections"];

  try {
    [mainResult, sections] = await Promise.all([
      getPublishedArticlesWithEdgeFallback(0, null, requestedLanguageCode),
      Promise.all(
        HOME_FEED_SECTIONS.map(async (section) => ({
          id: section.id,
          articles: await getPublishedArticlesForSectionWithEdgeFallback(
            section.query,
            requestedLanguageCode,
          ),
        })),
      ),
    ]);
  } catch (error) {
    await logHomeFeedDegradation(
      "web.home_feed.fallback_read_failed",
      "Homepage fallback reads failed; returning maintenance payload.",
      {
        languageCode: normalizeLanguageCode(requestedLanguageCode),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    );

    return createMaintenanceHomeFeedPayload(requestedLanguageCode, {
      reason: "home_feed_exception",
    });
  }
  const seenArticleKeys = new Set(
    mainResult.articles
      .map((article) => getArticleIdentityKey(article))
      .filter((articleKey): articleKey is string => Boolean(articleKey)),
  );
  const uniqueSections = sections.map((section) => {
    const uniqueArticles: Article[] = [];

    for (const article of section.articles) {
      const articleKey = getArticleIdentityKey(article);

      if (articleKey && seenArticleKeys.has(articleKey)) {
        continue;
      }

      uniqueArticles.push(article);

      if (articleKey) {
        seenArticleKeys.add(articleKey);
      }
    }

    return {
      ...section,
      articles: uniqueArticles,
    };
  });

  const payload: HomeFeedPayload = {
    ...mainResult,
    nextPage: mainResult.nextCursor ? null : mainResult.nextPage,
    sections: uniqueSections,
  };
  const hasAnyArticles =
    payload.articles.length > 0 ||
    payload.sections.some((section) => section.articles.length > 0);

  if (!hasAnyArticles) {
    await logHomeFeedDegradation(
      "web.home_feed.maintenance_returned",
      "Homepage feed returned maintenance state after all public feed sources were empty.",
      {
        languageCode: payload.languageCode,
        dataSource: payload.dataSource,
      },
    );

    return {
      ...payload,
      degradation: buildHomeFeedDegradationStatus({
        mode: "maintenance",
        reason: "no_public_feed_data",
        message:
          "NutsNews is showing a maintenance state while the public feed dependencies recover.",
        supabase: "unavailable",
        edgeSnapshot: "unavailable",
        worker: "unknown",
        localAi: "unknown",
        translations: "unknown",
      }),
    };
  }

  if (payload.dataSource === "edge_feed_snapshot") {
    await logHomeFeedDegradation(
      "web.home_feed.edge_snapshot_degraded",
      "Homepage feed recovered from the Cloudflare edge feed snapshot.",
      {
        languageCode: payload.languageCode,
        articleCount: payload.articles.length,
        edgeSnapshotAgeSeconds: payload.edgeSnapshot?.ageSeconds ?? null,
      },
    );

    return {
      ...payload,
      degradation: buildHomeFeedDegradationStatus({
        mode: "degraded",
        reason: "edge_snapshot_fallback",
        message:
          "NutsNews is serving the last-known-good public feed while Supabase recovers.",
        supabase: "unavailable",
        edgeSnapshot: "available",
        worker: "unknown",
        localAi: "unknown",
        translations: "degraded",
      }),
    };
  }

  return payload;
}

export async function getPublishedArticlesForSectionWithEdgeFallback(
  category: string,
  requestedLanguageCode?: string | null,
  limit = CATEGORY_SECTION_SIZE,
): Promise<Article[]> {
  try {
    const articles = await getPublishedArticlesForSection(category, requestedLanguageCode, limit);

    if (articles.length > 0) {
      return articles;
    }
  } catch (error) {
    console.error("Published section read threw before edge snapshot fallback:", error);
  }

  const edgeResult = await getEdgeFeedSnapshotPage({
    page: 0,
    category,
    pageSize: limit,
    requestedLanguageCode,
  });

  return edgeResult?.articles ?? [];
}

async function readEdgeStatusPayload(response: Response): Promise<(Partial<EdgeFeedSnapshotStatus> & { status?: EdgeFeedSnapshotStatus["status"] | null }) | null> {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as Partial<EdgeFeedSnapshotStatus> & { status?: EdgeFeedSnapshotStatus["status"] | null };
  } catch {
    return {
      message: text.slice(0, 500),
    };
  }
}

export async function getEdgeFeedSnapshotStatus(): Promise<EdgeFeedSnapshotStatus> {
  const endpoint = getEdgeSnapshotEndpoint("/status");

  if (!endpoint) {
    return {
      configured: false,
      enabled: false,
      ready: false,
      kvBound: null,
      httpStatus: null,
      status: "unconfigured",
      updatedAt: null,
      ageSeconds: null,
      articleCount: null,
      version: null,
      endpoint: null,
      message: "Set NUTSNEWS_EDGE_FEED_SNAPSHOT_URL to a Cloudflare Worker endpoint to enable the edge fallback.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const metadata = buildEdgeMetadata(response, endpoint);
    const payload = await readEdgeStatusPayload(response);
    const payloadStatus = payload?.status ?? null;
    const ready = payload?.ready ?? (response.ok && payloadStatus === "hit");
    const kvBound = typeof payload?.kvBound === "boolean" ? payload.kvBound : null;

    return {
      configured: true,
      enabled: payload?.enabled ?? response.ok,
      ready,
      kvBound,
      httpStatus: response.status,
      status: payloadStatus ?? (response.ok ? "hit" : "error"),
      updatedAt: payload?.updatedAt ?? metadata.updatedAt,
      ageSeconds: payload?.ageSeconds ?? metadata.ageSeconds,
      articleCount: payload?.articleCount ?? metadata.articleCount,
      version: payload?.version ?? metadata.version,
      endpoint,
      maxArticles: payload?.maxArticles ?? null,
      refreshedAt: payload?.refreshedAt ?? null,
      message: payload?.message ?? (response.ok ? null : `Worker returned HTTP ${response.status}.`),
    };
  } catch (error) {
    return {
      configured: true,
      enabled: false,
      ready: false,
      kvBound: null,
      httpStatus: null,
      status: "error",
      updatedAt: null,
      ageSeconds: null,
      articleCount: null,
      version: null,
      endpoint,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
