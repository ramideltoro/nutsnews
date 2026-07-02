import cacheConfig from "@/cache-observability.config.json";

export type CacheObservabilityResultStatus = "pass" | "warn" | "fail";

type CacheObservabilityRouteConfig = {
  key: string;
  label: string;
  path: string;
  discoverArticleFromApi?: boolean;
  method?: "GET" | "HEAD";
  expectedStatuses: number[];
  expectedPolicy: string;
  expectedCacheIncludes?: string[];
  expectedCdnIncludes?: string[];
  allowBrowserNoStoreWhenCloudflareHit?: boolean;
  requiredHeaders?: string[];
  description?: string;
};

type CacheObservabilityConfig = {
  defaultBaseUrl: string;
  defaults: {
    timeoutMs: number;
    sampleCount: number;
    sampleDelayMs: number;
    userAgent: string;
    requiredHeaders: string[];
    forbiddenCacheControlTokens: string[];
  };
  routes: CacheObservabilityRouteConfig[];
};

export type CacheObservabilityRouteResult = {
  key: string;
  label: string;
  description: string;
  urlPath: string;
  url: string;
  expectedPolicy: string;
  result: CacheObservabilityResultStatus;
  status: number;
  failures: string[];
  warnings: string[];
  headers: Record<string, string>;
  cloudflareStatuses: string[];
};

export type CacheObservabilityDashboardData = {
  generatedAt: string;
  baseUrl: string;
  discoveredArticlePath: string;
  summary: {
    status: CacheObservabilityResultStatus;
    routeCount: number;
    passedCount: number;
    warningCount: number;
    failedCount: number;
    cloudflareSampleCount: number;
    cloudflareHitCount: number;
    cloudflareHitRate: number | null;
  };
  routes: CacheObservabilityRouteResult[];
};

const config = cacheConfig as CacheObservabilityConfig;

function normalizeBaseUrl(value: string | undefined) {
  return String(value || config.defaultBaseUrl).trim().replace(/\/+$/, "");
}

function toUrl(baseUrl: string, routePath: string) {
  if (/^https?:\/\//i.test(routePath)) {
    return routePath;
  }

  return `${baseUrl}${routePath.startsWith("/") ? routePath : `/${routePath}`}`;
}

function includesToken(value: string | undefined, token: string) {
  return String(value || "").toLowerCase().includes(token.toLowerCase());
}

function getHeader(headers: Headers, name: string) {
  return headers.get(name) || "";
}

function selectedHeaders(headers: Headers) {
  const names = [
    "cache-control",
    "cdn-cache-control",
    "cloudflare-cdn-cache-control",
    "vercel-cdn-cache-control",
    "x-nutsnews-cache-policy",
    "x-nutsnews-article-data-source",
    "x-nutsnews-feed-snapshot",
    "cf-cache-status",
    "age",
    "x-vercel-cache",
  ];

  return Object.fromEntries(names.map((name) => [name, getHeader(headers, name)]));
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.defaults.timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getArticlesFromPayload(payload: unknown): Array<{ id?: string }> {
  if (Array.isArray(payload)) {
    return payload as Array<{ id?: string }>;
  }

  if (payload && typeof payload === "object") {
    const typedPayload = payload as {
      articles?: Array<{ id?: string }>;
      data?: Array<{ id?: string }>;
    };

    if (Array.isArray(typedPayload.articles)) {
      return typedPayload.articles;
    }

    if (Array.isArray(typedPayload.data)) {
      return typedPayload.data;
    }
  }

  return [];
}

async function discoverArticlePath(baseUrl: string, explicitArticlePath?: string) {
  if (explicitArticlePath) {
    return explicitArticlePath.startsWith("/") ? explicitArticlePath : `/${explicitArticlePath}`;
  }

  const response = await fetchWithTimeout(toUrl(baseUrl, "/api/articles?limit=1"), {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
      "user-agent": config.defaults.userAgent,
    },
  });

  if (!response.ok) {
    throw new Error(`Article discovery failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;
  const article = getArticlesFromPayload(payload)[0];

  if (!article?.id) {
    throw new Error("Article discovery returned no article id.");
  }

  return `/articles/${encodeURIComponent(article.id)}`;
}

function evaluateRoute({
  route,
  url,
  resolvedPath,
  response,
}: {
  route: CacheObservabilityRouteConfig;
  url: string;
  resolvedPath: string;
  response: Response;
}): CacheObservabilityRouteResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const headers = selectedHeaders(response.headers);
  const cacheControl = headers["cache-control"];
  const cdnCacheControl = headers["cdn-cache-control"];
  const cloudflareCdnCacheControl = headers["cloudflare-cdn-cache-control"];
  const vercelCdnCacheControl = headers["vercel-cdn-cache-control"];
  const policy = headers["x-nutsnews-cache-policy"];
  const routeRequiredHeaders = route.requiredHeaders || config.defaults.requiredHeaders;

  if (!route.expectedStatuses.includes(response.status)) {
    failures.push(`Expected HTTP ${route.expectedStatuses.join(" or ")}, got ${response.status}.`);
  }

  for (const header of routeRequiredHeaders) {
    if (!headers[header]) {
      failures.push(`Missing required header: ${header}.`);
    }
  }

  if (policy && policy !== route.expectedPolicy) {
    failures.push(`Expected x-nutsnews-cache-policy=${route.expectedPolicy}, got ${policy}.`);
  }

  const cfStatus = headers["cf-cache-status"];
  const hasCloudflareHit = cfStatus.toUpperCase() === "HIT";

  for (const token of config.defaults.forbiddenCacheControlTokens) {
    if (!includesToken(cacheControl, token)) {
      continue;
    }

    if (route.allowBrowserNoStoreWhenCloudflareHit && hasCloudflareHit) {
      warnings.push(
        `cache-control includes ${token}, but Cloudflare returned HIT. Treating this as a browser-cache warning instead of an edge-cache failure.`,
      );
    } else {
      failures.push(`cache-control includes forbidden token: ${token}.`);
    }
  }

  for (const token of route.expectedCacheIncludes || []) {
    if (!includesToken(cacheControl, token)) {
      if (route.allowBrowserNoStoreWhenCloudflareHit && hasCloudflareHit) {
        warnings.push(
          `cache-control does not include ${token}, but Cloudflare returned HIT. Edge cache is working; browser cache policy should be reviewed separately.`,
        );
      } else {
        failures.push(`cache-control does not include ${token}.`);
      }
    }
  }

  const visibleCdnControls = [
    ["cache-control", cacheControl],
    ["cdn-cache-control", cdnCacheControl],
    ["cloudflare-cdn-cache-control", cloudflareCdnCacheControl],
    ["vercel-cdn-cache-control", vercelCdnCacheControl],
  ].filter(([, value]) => value);

  for (const token of route.expectedCdnIncludes || []) {
    const matchingHeaders = visibleCdnControls
      .filter(([, value]) => includesToken(value, token))
      .map(([name]) => name);

    if (matchingHeaders.length === 0) {
      failures.push(`no visible CDN cache-control header includes ${token}.`);
    }
  }

  if (!cloudflareCdnCacheControl) {
    warnings.push("cloudflare-cdn-cache-control was not visible in the final response. This can be normal after Cloudflare processes the origin response.");
  }

  if (!vercelCdnCacheControl) {
    warnings.push("vercel-cdn-cache-control was not visible in the final response. This can be normal after Vercel processes the origin response.");
  }

  if (!cfStatus) {
    warnings.push("cf-cache-status was not observed. This is normal on local/Vercel preview checks before Cloudflare.");
  } else if (route.key === "articles-api" && ["BYPASS", "DYNAMIC"].includes(cfStatus.toUpperCase())) {
    failures.push(`/api/articles returned non-cache Cloudflare status: ${cfStatus}.`);
  }

  return {
    key: route.key,
    label: route.label,
    description: route.description || "",
    urlPath: resolvedPath,
    url,
    expectedPolicy: route.expectedPolicy,
    result: failures.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
    status: response.status,
    failures,
    warnings,
    headers,
    cloudflareStatuses: cfStatus ? [cfStatus.toUpperCase()] : [],
  };
}

export async function getCacheObservabilityDashboardData({
  baseUrl,
  articlePath,
}: {
  baseUrl?: string;
  articlePath?: string;
} = {}): Promise<CacheObservabilityDashboardData> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const routes: CacheObservabilityRouteResult[] = [];
  let discoveredArticlePath = "";

  for (const route of config.routes) {
    let resolvedPath = route.path;

    try {
      if (route.discoverArticleFromApi) {
        discoveredArticlePath = await discoverArticlePath(normalizedBaseUrl, articlePath);
        resolvedPath = discoveredArticlePath;
      }

      const url = toUrl(normalizedBaseUrl, resolvedPath);
      const response = await fetchWithTimeout(url, {
        method: route.method || "HEAD",
        cache: "no-store",
        headers: {
          accept: "*/*",
          "user-agent": config.defaults.userAgent,
        },
      });

      routes.push(
        evaluateRoute({
          route,
          url,
          resolvedPath,
          response,
        }),
      );
    } catch (error) {
      routes.push({
        key: route.key,
        label: route.label,
        description: route.description || "",
        urlPath: resolvedPath,
        url: toUrl(normalizedBaseUrl, resolvedPath),
        expectedPolicy: route.expectedPolicy,
        result: "fail",
        status: 0,
        failures: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        headers: {},
        cloudflareStatuses: [],
      });
    }
  }

  const passedCount = routes.filter((route) => route.result === "pass").length;
  const warningCount = routes.filter((route) => route.result === "warn").length;
  const failedCount = routes.filter((route) => route.result === "fail").length;
  const cfStatuses = routes.flatMap((route) => route.cloudflareStatuses);
  const cloudflareHitCount = cfStatuses.filter((status) => status === "HIT").length;

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: normalizedBaseUrl,
    discoveredArticlePath,
    summary: {
      status: failedCount > 0 ? "fail" : warningCount > 0 ? "warn" : "pass",
      routeCount: routes.length,
      passedCount,
      warningCount,
      failedCount,
      cloudflareSampleCount: cfStatuses.length,
      cloudflareHitCount,
      cloudflareHitRate: cfStatuses.length > 0 ? cloudflareHitCount / cfStatuses.length : null,
    },
    routes,
  };
}

export function getCacheObservabilityRouteConfig() {
  return config.routes;
}
