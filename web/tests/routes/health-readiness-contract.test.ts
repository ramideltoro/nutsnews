import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  backendOperation: vi.fn(),
  connection: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();

  return {
    ...actual,
    connection: mocks.connection,
  };
});

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ rpc: mocks.rpc }),
}));

vi.mock("@/lib/backendDatabase", () => ({
  callBackendDatabaseOperation: mocks.backendOperation,
}));

const sourceCommit = "0123456789abcdef0123456789abcdef01234567";
const buildId = "production-build-42";
const imageDigest = `sha256:${"a".repeat(64)}`;
const schemaFingerprint = "b".repeat(32);

function setProductionEnvironment() {
  const values = {
    NUTSNEWS_RUNTIME_ENV: "production",
    NUTSNEWS_PUBLIC_APP_ENV: "production",
    NEXT_PUBLIC_APP_ENV: "production",
    NUTSNEWS_SIDE_EFFECTS_MODE: "live",
    NUTSNEWS_PUBLIC_SIDE_EFFECTS_MODE: "live",
    NUTSNEWS_DATA_ENVIRONMENT: "production",
    NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "production",
    NUTSNEWS_SUPABASE_PROJECT_REF: "production-project",
    NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "production-project",
    NUTSNEWS_PUBLIC_SUPABASE_URL: "https://production-project.supabase.co",
    NUTSNEWS_SOURCE_COMMIT: sourceCommit,
    NUTSNEWS_EXPECTED_SOURCE_COMMIT: sourceCommit,
    NUTSNEWS_BUILD_ID: buildId,
    NUTSNEWS_EXPECTED_BUILD_ID: buildId,
    NUTSNEWS_DEPLOYMENT_TARGET: "production-vps",
    NUTSNEWS_EXPECTED_IMAGE_DIGEST: imageDigest,
    NUTSNEWS_DEPLOYED_IMAGE_DIGEST: imageDigest,
    NUTSNEWS_CONFIG_GENERATION: "production-config-42",
    NUTSNEWS_EXPECTED_SCHEMA_VERSION: "20260712170000",
    NUTSNEWS_READYZ_TIMEOUT_MS: "100",
    VERCEL: "0",
    VERCEL_ENV: "",
  };

  for (const [name, value] of Object.entries(values)) {
    vi.stubEnv(name, value);
  }
}

function setBackendPrimaryEnvironment() {
  const values = {
    NUTSNEWS_DATABASE_PROVIDER_MODE: "backend_postgres_primary",
    NUTSNEWS_BACKEND_POSTGRES_PRIMARY_CONFIRMATION: "enable-backend-postgres-primary",
    NUTSNEWS_BACKEND_API_URL: "https://backend.example.test/api/app/db",
    NUTSNEWS_BACKEND_API_TOKEN: "server-only-backend-readiness-token",
    NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "",
    NUTSNEWS_SUPABASE_PROJECT_REF: "",
    NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "",
    NUTSNEWS_PUBLIC_SUPABASE_URL: "",
  };

  for (const [name, value] of Object.entries(values)) {
    vi.stubEnv(name, value);
  }
}

function schemaContractRows() {
  return [
    {
      legacy_schema_version: "20260712170000",
      migration_head: "20260717113000",
      expected_schema_fingerprint: schemaFingerprint,
      actual_schema_fingerprint: schemaFingerprint,
    },
  ];
}

beforeEach(() => {
  vi.resetModules();
  setProductionEnvironment();
  mocks.backendOperation.mockReset();
  mocks.connection.mockReset();
  mocks.rpc.mockReset();
  mocks.backendOperation.mockResolvedValue(schemaContractRows());
  mocks.rpc.mockResolvedValue({
    data: schemaContractRows(),
    error: null,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public readiness synthetic contract", () => {
  it("returns truthful readiness, a safe deployment identity, and no-store headers", async () => {
    const { GET } = await import("@/app/readyz/route");

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      ready: true,
      service: "nutsnews-web",
      runtimeEnv: "production",
      sideEffectsMode: "live",
      databaseProviderMode: "supabase_primary",
      productionWritesPaused: false,
      code: "ready",
      sourceCommit,
      buildId,
      deploymentTarget: "production-vps",
      configGeneration: "production-config-42",
    });
    expect(JSON.stringify(body)).not.toContain("production-project");
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("vercel-cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("x-nutsnews-source-commit")).toBe(sourceCommit);
    expect(response.headers.get("x-nutsnews-build-id")).toBe(buildId);
    expect(response.headers.get("x-nutsnews-deployment-target")).toBe("production-vps");
    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("nutsnews_migration_schema_contract");
  });

  it("fails closed without leaking dependency errors when the schema check is unavailable", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: new Error("database-hostname-and-secret-must-not-leak"),
    });
    const { GET } = await import("@/app/readyz/route");

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      ready: false,
      code: "supabase_dependency_failed",
      deploymentTarget: "production-vps",
    });
    expect(JSON.stringify(body)).not.toContain("database-hostname-and-secret-must-not-leak");
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  });

  it("keeps the Vercel-secondary target dependent on the production datastore", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NUTSNEWS_DEPLOYMENT_TARGET", "vercel-production");
    vi.stubEnv("NUTSNEWS_EXPECTED_IMAGE_DIGEST", "");
    vi.stubEnv("NUTSNEWS_DEPLOYED_IMAGE_DIGEST", "");
    mocks.rpc.mockRejectedValueOnce(new Error("Vercel database secret must not leak"));
    const { GET } = await import("@/app/readyz/route");

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      ready: false,
      code: "supabase_dependency_failed",
      deploymentTarget: "vercel-production",
    });
    expect(JSON.stringify(body)).not.toContain("Vercel database secret must not leak");
    expect(mocks.rpc).toHaveBeenCalledWith("nutsnews_migration_schema_contract");
  });

  it("checks the backend PostgreSQL primary without calling Supabase", async () => {
    setBackendPrimaryEnvironment();
    const { GET } = await import("@/app/readyz/route");

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      ready: true,
      databaseProviderMode: "backend_postgres_primary",
      code: "ready",
    });
    expect(JSON.stringify(body)).not.toContain("server-only-backend-readiness-token");
    expect(JSON.stringify(body)).not.toContain("backend.example.test");
    expect(mocks.backendOperation).toHaveBeenCalledWith(
      "load-readiness-schema-contract",
      {},
      { cache: "no-store" },
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails backend-primary readiness closed without leaking dependency errors", async () => {
    setBackendPrimaryEnvironment();
    mocks.backendOperation.mockRejectedValueOnce(
      new Error("backend-host-and-secret-must-not-leak"),
    );
    const { GET } = await import("@/app/readyz/route");

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      ready: false,
      databaseProviderMode: "backend_postgres_primary",
      code: "backend_dependency_failed",
    });
    expect(JSON.stringify(body)).not.toContain("backend-host-and-secret-must-not-leak");
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("legacy liveness compatibility contract", () => {
  it("keeps healthz cacheable while exposing the same safe identity", async () => {
    const { GET } = await import("@/app/healthz/route");

    const response = GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(body).toEqual({
      ok: true,
      service: "nutsnews-web",
      sourceCommit,
      buildId,
      deploymentTarget: "production-vps",
    });
    expect(response.headers.get("cache-control")).toContain("public");
    expect(response.headers.get("cache-control")).not.toContain("no-store");
    expect(response.headers.get("x-nutsnews-cache-policy")).toBe(
      "public-health-cache-60s",
    );
  });
});
