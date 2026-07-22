export type HomeServerServiceStatus = {
  name: string;
  active: boolean;
  status: string;
};

export type HomeServerModel = {
  name: string;
  size: number;
  modifiedAt: string | null;
};

export type HomeServerStats = {
  ok: boolean;
  requestId: string | null;
  service: string;
  timestamp: string;
  generatedInMs: number;
  server: {
    hostname: string;
    platform: string;
    arch: string;
    kernel: string;
    uptimeSeconds: number;
    startedAt: string;
  };
  cpu: {
    model: string;
    threads: number;
    loadAverage: {
      oneMinute: number;
      fiveMinute: number;
      fifteenMinute: number;
      normalizedOneMinutePercent: number;
    };
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    availableBytes: number;
    usagePercent: number;
    swapTotalBytes: number;
    swapUsedBytes: number;
    swapFreeBytes: number;
  };
  disk: {
    filesystem: string;
    mount: string;
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercent: number;
  };
  services: HomeServerServiceStatus[];
  localAi: {
    port: number;
    ollamaUrl: string;
    defaultModel: string;
    requestTimeoutMs: number;
    maxArticleChars: number;
    keepAlive: string;
    numCtx: number;
    numPredict: number;
    temperature: number;
  };
  ollama: {
    ok: boolean;
    status: number;
    models: HomeServerModel[];
  };
  process: {
    pid: number;
    nodeVersion: string;
    uptimeSeconds: number;
    memoryUsage: Record<string, number>;
  };
};

export type HomeServerDashboardData = {
  isConfigured: boolean;
  errorMessage: string | null;
  generatedAt: string;
  stats: HomeServerStats | null;
};

const DEFAULT_HOME_SERVER_STATS_URL = "https://ai.nutsnews.com/stats";
const REQUEST_TIMEOUT_MS = 10000;

function payloadErrorDetail(payload: unknown) {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const data = payload as Record<string, unknown>;
  for (const key of ["error", "message"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function statsEndpointDisplay(statsUrl: string) {
  try {
    const url = new URL(statsUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return statsUrl;
  }
}

function homeServerHttpErrorMessage(status: number, payload: unknown, statsUrl: string) {
  const endpoint = statsEndpointDisplay(statsUrl);
  const detail = payloadErrorDetail(payload);

  if (status === 401 || status === 403) {
    return `Home server stats endpoint rejected HOME_SERVER_STATS_API_KEY. Verify the VPS Production HOME_SERVER_STATS_API_KEY matches the x-nutsnews-ai-key expected by ${DEFAULT_HOME_SERVER_STATS_URL}.`;
  }

  if (status === 404) {
    return `Home server stats endpoint returned 404 from ${endpoint}. Set HOME_SERVER_STATS_URL to ${DEFAULT_HOME_SERVER_STATS_URL}; /api/stats, /healthz, and /readyz are not stats endpoints.`;
  }

  if (status === 503) {
    return `Home server stats endpoint returned HTTP 503 from ${endpoint}. Check the home-server local AI service, Ollama, and Cloudflare Tunnel before treating the dashboard as healthy.`;
  }

  return `Home server stats request failed with HTTP ${status}${detail ? `: ${detail}` : ""}. Check HOME_SERVER_STATS_URL, HOME_SERVER_STATS_API_KEY, and the Cloudflare Tunnel route.`;
}

function homeServerFetchErrorMessage(error: unknown, statsUrl: string) {
  if (error instanceof Error && error.name === "AbortError") {
    return `Home server stats request timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s. Check ${DEFAULT_HOME_SERVER_STATS_URL}, Cloudflare Tunnel, and the home-server local AI service.`;
  }

  return `Unable to load home server stats from ${statsEndpointDisplay(statsUrl)}. Check HOME_SERVER_STATS_URL, HOME_SERVER_STATS_API_KEY, Cloudflare Tunnel routing, and the home-server local AI service.`;
}

function toNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeServiceStatus(value: unknown): HomeServerServiceStatus {
  const row = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const status = toStringValue(row.status, "unknown");

  return {
    name: toStringValue(row.name, "unknown"),
    active: Boolean(row.active) || status === "active",
    status,
  };
}

function normalizeModel(value: unknown): HomeServerModel {
  const row = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

  return {
    name: toStringValue(row.name, "unknown"),
    size: toNumber(row.size),
    modifiedAt: typeof row.modifiedAt === "string" ? row.modifiedAt : null,
  };
}

function normalizeStats(payload: unknown): HomeServerStats {
  const data = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
  const server = typeof data.server === "object" && data.server !== null ? data.server as Record<string, unknown> : {};
  const cpu = typeof data.cpu === "object" && data.cpu !== null ? data.cpu as Record<string, unknown> : {};
  const loadAverage = typeof cpu.loadAverage === "object" && cpu.loadAverage !== null ? cpu.loadAverage as Record<string, unknown> : {};
  const memory = typeof data.memory === "object" && data.memory !== null ? data.memory as Record<string, unknown> : {};
  const disk = typeof data.disk === "object" && data.disk !== null ? data.disk as Record<string, unknown> : {};
  const localAi = typeof data.localAi === "object" && data.localAi !== null ? data.localAi as Record<string, unknown> : {};
  const ollama = typeof data.ollama === "object" && data.ollama !== null ? data.ollama as Record<string, unknown> : {};
  const processInfo = typeof data.process === "object" && data.process !== null ? data.process as Record<string, unknown> : {};

  return {
    ok: Boolean(data.ok),
    requestId: typeof data.requestId === "string" ? data.requestId : null,
    service: toStringValue(data.service, "nutsnews-local-ai-service"),
    timestamp: toStringValue(data.timestamp, new Date().toISOString()),
    generatedInMs: toNumber(data.generatedInMs),
    server: {
      hostname: toStringValue(server.hostname, "unknown"),
      platform: toStringValue(server.platform, "unknown"),
      arch: toStringValue(server.arch, "unknown"),
      kernel: toStringValue(server.kernel, "unknown"),
      uptimeSeconds: toNumber(server.uptimeSeconds),
      startedAt: toStringValue(server.startedAt, ""),
    },
    cpu: {
      model: toStringValue(cpu.model, "unknown"),
      threads: toNumber(cpu.threads),
      loadAverage: {
        oneMinute: toNumber(loadAverage.oneMinute),
        fiveMinute: toNumber(loadAverage.fiveMinute),
        fifteenMinute: toNumber(loadAverage.fifteenMinute),
        normalizedOneMinutePercent: toNumber(loadAverage.normalizedOneMinutePercent),
      },
    },
    memory: {
      totalBytes: toNumber(memory.totalBytes),
      usedBytes: toNumber(memory.usedBytes),
      freeBytes: toNumber(memory.freeBytes),
      availableBytes: toNumber(memory.availableBytes),
      usagePercent: toNumber(memory.usagePercent),
      swapTotalBytes: toNumber(memory.swapTotalBytes),
      swapUsedBytes: toNumber(memory.swapUsedBytes),
      swapFreeBytes: toNumber(memory.swapFreeBytes),
    },
    disk: {
      filesystem: toStringValue(disk.filesystem, "unknown"),
      mount: toStringValue(disk.mount, "/"),
      totalBytes: toNumber(disk.totalBytes),
      usedBytes: toNumber(disk.usedBytes),
      availableBytes: toNumber(disk.availableBytes),
      usagePercent: toNumber(disk.usagePercent),
    },
    services: Array.isArray(data.services) ? data.services.map(normalizeServiceStatus) : [],
    localAi: {
      port: toNumber(localAi.port),
      ollamaUrl: toStringValue(localAi.ollamaUrl, "http://127.0.0.1:11434"),
      defaultModel: toStringValue(localAi.defaultModel, "qwen2.5:3b"),
      requestTimeoutMs: toNumber(localAi.requestTimeoutMs),
      maxArticleChars: toNumber(localAi.maxArticleChars),
      keepAlive: toStringValue(localAi.keepAlive, "30m"),
      numCtx: toNumber(localAi.numCtx),
      numPredict: toNumber(localAi.numPredict),
      temperature: toNumber(localAi.temperature),
    },
    ollama: {
      ok: Boolean(ollama.ok),
      status: toNumber(ollama.status),
      models: Array.isArray(ollama.models) ? ollama.models.map(normalizeModel) : [],
    },
    process: {
      pid: toNumber(processInfo.pid),
      nodeVersion: toStringValue(processInfo.nodeVersion, "unknown"),
      uptimeSeconds: toNumber(processInfo.uptimeSeconds),
      memoryUsage:
        typeof processInfo.memoryUsage === "object" && processInfo.memoryUsage !== null
          ? Object.fromEntries(
              Object.entries(processInfo.memoryUsage as Record<string, unknown>).map(([key, value]) => [
                key,
                toNumber(value),
              ]),
            )
          : {},
    },
  };
}

export async function getAdminHomeServerDashboardData(): Promise<HomeServerDashboardData> {
  const statsUrl = process.env.HOME_SERVER_STATS_URL?.trim() || DEFAULT_HOME_SERVER_STATS_URL;
  const statsApiKey = (process.env.HOME_SERVER_STATS_API_KEY || process.env.LOCAL_AI_API_KEY || "").trim();

  if (!statsApiKey) {
    return {
      isConfigured: false,
      errorMessage:
        "Missing HOME_SERVER_STATS_API_KEY. Add it to Vercel Production or the protected VPS runtime sync as a server-side value matching the home-server x-nutsnews-ai-key.",
      generatedAt: new Date().toISOString(),
      stats: null,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(statsUrl, {
      headers: {
        "x-nutsnews-ai-key": statsApiKey,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        isConfigured: true,
        errorMessage: homeServerHttpErrorMessage(response.status, payload, statsUrl),
        generatedAt: new Date().toISOString(),
        stats: null,
      };
    }

    return {
      isConfigured: true,
      errorMessage: null,
      generatedAt: new Date().toISOString(),
      stats: normalizeStats(payload),
    };
  } catch (error) {
    return {
      isConfigured: true,
      errorMessage: homeServerFetchErrorMessage(error, statsUrl),
      generatedAt: new Date().toISOString(),
      stats: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
