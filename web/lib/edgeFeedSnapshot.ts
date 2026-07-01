import {
  CATEGORY_SECTION_SIZE,
  getPublishedArticles,
  getPublishedArticlesForSection,
  PAGE_SIZE,
  type Article,
  type PublicFeedEdgeSnapshotMetadata,
  type PublishedArticlesResult,
} from "@/lib/articles";
import {
  DEFAULT_LANGUAGE_CODE,
  normalizeLanguageCode,
  type LanguageCode,
} from "@/lib/languages";

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
  articleCount: number | null;
  maxArticles?: number | null;
  refreshedAt?: string | null;
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
  return articles.map((article) => ({
    ...article,
    language_code: DEFAULT_LANGUAGE_CODE,
    requested_language_code: requestedLanguageCode,
    translation_available: requestedLanguageCode === DEFAULT_LANGUAGE_CODE,
  }));
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

export async function getEdgeFeedSnapshotStatus(): Promise<EdgeFeedSnapshotStatus> {
  const endpoint = getEdgeSnapshotEndpoint("/status");

  if (!endpoint) {
    return {
      configured: false,
      enabled: false,
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

    if (!response.ok) {
      return {
        configured: true,
        enabled: false,
        ...metadata,
        status: metadata.status === "hit" ? "error" : metadata.status,
        message: `Worker returned HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as Partial<EdgeFeedSnapshotStatus>;

    return {
      configured: true,
      enabled: true,
      status: "hit",
      updatedAt: payload.updatedAt ?? metadata.updatedAt,
      ageSeconds: payload.ageSeconds ?? metadata.ageSeconds,
      articleCount: payload.articleCount ?? metadata.articleCount,
      version: payload.version ?? metadata.version,
      endpoint,
      maxArticles: payload.maxArticles ?? null,
      refreshedAt: payload.refreshedAt ?? null,
      message: payload.message ?? null,
    };
  } catch (error) {
    return {
      configured: true,
      enabled: false,
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
