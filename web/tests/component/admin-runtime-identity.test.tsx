import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { RuntimeIdentityBanner } from "@/app/admin/(protected)/RuntimeIdentityBanner";
import { buildAdminRuntimeIdentityViewModel } from "@/lib/adminRuntimeIdentity";

const baseRuntimeConfig = {
  runtimeEnv: "production",
  sideEffectsMode: "live",
  productionWritesPaused: false,
  sourceCommit: "6887a9d35870ab8c008f22f3a1d50efa57076fd6",
  buildId: "29925309197-1",
  deploymentTarget: "production-vps",
  configGeneration: "production-29925309197-1-20260717113000",
};

describe("RuntimeIdentityBanner", () => {
  test("shows VPS host and backend PostgreSQL primary runtime identity", () => {
    const identity = buildAdminRuntimeIdentityViewModel({
      requestHost: "vps.nutsnews.com",
      runtimeConfig: {
        ...baseRuntimeConfig,
        databaseProviderMode: "backend_postgres_primary",
      },
      readiness: { ready: true, code: "ready" },
    });

    render(<RuntimeIdentityBanner identity={identity} />);

    const banner = screen.getByTestId("admin-runtime-identity");
    expect(
      within(banner).getByRole("heading", { name: "vps.nutsnews.com" }),
    ).toBeInTheDocument();
    expect(within(banner).getByText("VPS direct host")).toBeInTheDocument();
    expect(within(banner).getAllByText("Backend PostgreSQL primary").length).toBeGreaterThan(0);
    expect(within(banner).getByText("backend_postgres_primary")).toBeInTheDocument();
    expect(within(banner).getByText("Runtime ready")).toBeInTheDocument();
    expect(within(banner).getByText("production-vps")).toBeInTheDocument();
    expect(within(banner).getByText("29925309197-1")).toBeInTheDocument();
  });

  test("shows Vercel host and Supabase primary runtime identity", () => {
    const identity = buildAdminRuntimeIdentityViewModel({
      requestHost: "nutsnews-prod-candidate.vercel.app",
      runtimeConfig: {
        ...baseRuntimeConfig,
        databaseProviderMode: "supabase_primary",
        deploymentTarget: "vercel-production",
        productionWritesPaused: true,
      },
      readiness: { ready: true, code: "ready" },
    });

    render(<RuntimeIdentityBanner identity={identity} />);

    const banner = screen.getByTestId("admin-runtime-identity");
    expect(
      within(banner).getByRole("heading", {
        name: "nutsnews-prod-candidate.vercel.app",
      }),
    ).toBeInTheDocument();
    expect(within(banner).getByText("Vercel deployment host")).toBeInTheDocument();
    expect(within(banner).getAllByText("Supabase primary").length).toBeGreaterThan(0);
    expect(within(banner).getByText("supabase_primary")).toBeInTheDocument();
    expect(within(banner).getByText("vercel-production")).toBeInTheDocument();
    expect(within(banner).getByText("true")).toBeInTheDocument();
  });

  test("surfaces backend API readiness configuration failures without secrets", () => {
    const identity = buildAdminRuntimeIdentityViewModel({
      requestHost: "www.nutsnews.com",
      runtimeConfig: {
        ...baseRuntimeConfig,
        databaseProviderMode: "invalid",
        runtimeEnv: "unknown",
        sideEffectsMode: "disabled",
        deploymentTarget: "production-vps",
        sourceCommit: "unknown",
        buildId: "unknown",
        configGeneration: "unknown",
      },
      readiness: { ready: false, code: "backend_api_config_missing" },
    });

    render(<RuntimeIdentityBanner identity={identity} />);

    const banner = screen.getByTestId("admin-runtime-identity");
    expect(within(banner).getByText("Backend API config missing")).toBeInTheDocument();
    expect(
      within(banner).getByText("Readiness code: backend_api_config_missing"),
    ).toBeInTheDocument();
    expect(within(banner).getAllByText("Invalid database provider").length).toBeGreaterThan(0);
  });
});
