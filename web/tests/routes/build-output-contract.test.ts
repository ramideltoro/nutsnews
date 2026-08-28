import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  withSentryConfig: (config: unknown) => config,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("deployment build output", () => {
  it.each([undefined, "0"])(
    "keeps standalone output outside Vercel (VERCEL=%s)",
    async (vercel) => {
      vi.stubEnv("VERCEL", vercel);
      const { default: config } = await import("../../next.config");

      expect(config.output).toBe("standalone");
      expect(config.cacheComponents).toBe(true);
    },
  );

  it("lets the Vercel adapter own its deployment output", async () => {
    vi.stubEnv("VERCEL", "1");
    const { default: config } = await import("../../next.config");

    expect(config.output).toBeUndefined();
    expect(config.cacheComponents).toBe(true);
  });
});
