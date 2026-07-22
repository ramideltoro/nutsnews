type RuntimeIdentityConfig = {
  runtimeEnv: string;
  sideEffectsMode: string;
  databaseProviderMode: string;
  productionWritesPaused: boolean;
  sourceCommit: string;
  buildId: string;
  deploymentTarget: string;
  configGeneration: string;
};

type RuntimeReadinessSummary = {
  ready: boolean;
  code: string;
};

export type AdminRuntimeIdentityViewModel = {
  servingHost: string;
  hostKind: string;
  statusLabel: string;
  statusDetail: string;
  statusTone: "ready" | "attention";
  databaseProviderLabel: string;
  writesStatusLabel: string;
  fields: Array<{
    label: string;
    value: string;
    valueClassName?: string;
  }>;
};

const HOST_VALUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.:-]{0,126}$/;

function firstHeaderValue(value: string) {
  return value.split(",", 1)[0]?.trim() ?? "";
}

export function safeServingHost(value: string | null | undefined) {
  const candidate = firstHeaderValue(String(value ?? "")).replace(/^https?:\/\//, "");

  return HOST_VALUE_PATTERN.test(candidate) ? candidate : "unknown";
}

function hostKind(host: string) {
  const normalized = host.toLowerCase();

  if (normalized === "unknown") {
    return "Unknown host";
  }
  if (normalized === "www.nutsnews.com" || normalized === "nutsnews.com") {
    return "Canonical web host";
  }
  if (normalized === "vps.nutsnews.com") {
    return "VPS direct host";
  }
  if (normalized.endsWith(".vercel.app")) {
    return "Vercel deployment host";
  }
  if (
    normalized === "localhost" ||
    normalized.startsWith("localhost:") ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("127.0.0.1:")
  ) {
    return "Local development host";
  }

  return "Custom host";
}

export function databaseProviderLabel(mode: string) {
  switch (mode) {
    case "backend_postgres_primary":
      return "Backend PostgreSQL primary";
    case "backend_postgres_shadow":
      return "Backend PostgreSQL shadow";
    case "supabase_primary":
      return "Supabase primary";
    default:
      return "Invalid database provider";
  }
}

function statusLabel(readiness: RuntimeReadinessSummary) {
  if (readiness.ready) {
    return "Runtime ready";
  }

  if (readiness.code === "backend_api_config_missing") {
    return "Backend API config missing";
  }

  return "Runtime not ready";
}

function statusDetail(readiness: RuntimeReadinessSummary) {
  if (readiness.ready) {
    return "Safe public runtime identity is available.";
  }

  return `Readiness code: ${readiness.code || "unknown"}`;
}

function compactIdentity(value: string) {
  if (!value || value === "unknown") {
    return "unknown";
  }

  return value.length > 18 ? `${value.slice(0, 12)}...${value.slice(-6)}` : value;
}

export function buildAdminRuntimeIdentityViewModel({
  requestHost,
  runtimeConfig,
  readiness,
}: {
  requestHost: string | null | undefined;
  runtimeConfig: RuntimeIdentityConfig;
  readiness: RuntimeReadinessSummary;
}): AdminRuntimeIdentityViewModel {
  const servingHost = safeServingHost(requestHost);
  const databaseLabel = databaseProviderLabel(runtimeConfig.databaseProviderMode);
  const writesStatusLabel = runtimeConfig.productionWritesPaused ? "true" : "false";

  return {
    servingHost,
    hostKind: hostKind(servingHost),
    statusLabel: statusLabel(readiness),
    statusDetail: statusDetail(readiness),
    statusTone: readiness.ready ? "ready" : "attention",
    databaseProviderLabel: databaseLabel,
    writesStatusLabel,
    fields: [
      { label: "Serving host", value: servingHost },
      { label: "Host class", value: hostKind(servingHost) },
      { label: "Deployment target", value: runtimeConfig.deploymentTarget || "unknown" },
      { label: "Runtime env", value: runtimeConfig.runtimeEnv || "unknown" },
      { label: "Side effects mode", value: runtimeConfig.sideEffectsMode || "disabled" },
      { label: "Database provider mode", value: runtimeConfig.databaseProviderMode || "invalid" },
      { label: "Primary database", value: databaseLabel },
      { label: "Production writes paused", value: writesStatusLabel },
      {
        label: "Source commit",
        value: compactIdentity(runtimeConfig.sourceCommit),
        valueClassName: "font-mono",
      },
      {
        label: "Build ID",
        value: compactIdentity(runtimeConfig.buildId),
        valueClassName: "font-mono",
      },
      {
        label: "Config generation",
        value: runtimeConfig.configGeneration || "unknown",
        valueClassName: "font-mono",
      },
    ],
  };
}
