import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CACHE_REVALIDATION_HEADERS,
  signCacheRevalidationRequest,
} from "@/lib/cacheRevalidationAuth";

const mocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("@/lib/logger", () => ({
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
}));

const secret = "cache-revalidation-test-secret-at-least-32-bytes";
let sequence = 0;

function signedRequest(tags: string[], overrides: { requestId?: string; timestamp?: string; signature?: string } = {}) {
  const timestamp = overrides.timestamp ?? String(Math.floor(Date.now() / 1_000));
  const requestId = overrides.requestId ?? `cache-test-${sequence += 1}`;
  const signature = overrides.signature ?? signCacheRevalidationRequest(secret, timestamp, requestId, tags);

  return new Request("https://www.nutsnews.com/api/internal/cache/revalidate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [CACHE_REVALIDATION_HEADERS.timestamp]: timestamp,
      [CACHE_REVALIDATION_HEADERS.requestId]: requestId,
      [CACHE_REVALIDATION_HEADERS.signature]: `sha256=${signature}`,
    },
    body: JSON.stringify({ tags }),
  });
}

beforeEach(() => {
  process.env.NUTSNEWS_CACHE_REVALIDATION_SECRET = secret;
  mocks.logInfo.mockReset();
  mocks.logWarn.mockReset();
  mocks.revalidateTag.mockReset();
});

describe("signed cache revalidation endpoint", () => {
  it("revalidates allowlisted tags immediately and never caches its response", async () => {
    const { POST } = await import("@/app/api/internal/cache/revalidate/route");
    const response = await POST(signedRequest(["public-feed", "article:article-123"]));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(mocks.revalidateTag).toHaveBeenNthCalledWith(1, "public-feed", { expire: 0 });
    expect(mocks.revalidateTag).toHaveBeenNthCalledWith(2, "article:article-123", { expire: 0 });
  });

  it("rejects invalid signatures, stale timestamps, and unknown tags", async () => {
    const { POST } = await import("@/app/api/internal/cache/revalidate/route");
    const invalidSignature = await POST(signedRequest(["public-feed"], { signature: "0".repeat(64) }));
    const staleTimestamp = String(Math.floor(Date.now() / 1_000) - 600);
    const stale = await POST(signedRequest(["public-feed"], { timestamp: staleTimestamp }));
    const unknown = await POST(signedRequest(["everything"]));

    expect(invalidSignature.status).toBe(401);
    expect(stale.status).toBe(401);
    expect(unknown.status).toBe(400);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects a replayed signed request id", async () => {
    const { POST } = await import("@/app/api/internal/cache/revalidate/route");
    const requestId = `cache-replay-${sequence += 1}`;
    const first = await POST(signedRequest(["public-feed"], { requestId }));
    const replay = await POST(signedRequest(["public-feed"], { requestId }));

    expect(first.status).toBe(200);
    expect(replay.status).toBe(409);
  });
});
