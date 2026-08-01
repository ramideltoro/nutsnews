import { createHmac, timingSafeEqual } from "node:crypto";

export const CACHE_REVALIDATION_MAX_AGE_SECONDS = 300;
export const CACHE_REVALIDATION_MAX_TAGS = 20;

export const CACHE_REVALIDATION_HEADERS = {
  requestId: "x-nutsnews-request-id",
  signature: "x-nutsnews-signature",
  timestamp: "x-nutsnews-timestamp",
} as const;

export function buildCacheRevalidationPayload(
  timestamp: string,
  requestId: string,
  tags: readonly string[],
) {
  return `${timestamp}.${requestId}.${tags.join(",")}`;
}

export function signCacheRevalidationRequest(
  secret: string,
  timestamp: string,
  requestId: string,
  tags: readonly string[],
) {
  return createHmac("sha256", secret)
    .update(buildCacheRevalidationPayload(timestamp, requestId, tags))
    .digest("hex");
}

export function verifyCacheRevalidationSignature(
  secret: string,
  timestamp: string,
  requestId: string,
  tags: readonly string[],
  providedSignature: string,
) {
  const expected = Buffer.from(
    signCacheRevalidationRequest(secret, timestamp, requestId, tags),
    "hex",
  );
  const normalizedProvided = providedSignature.startsWith("sha256=")
    ? providedSignature.slice("sha256=".length)
    : providedSignature;

  if (!/^[a-f0-9]{64}$/i.test(normalizedProvided)) {
    return false;
  }

  const provided = Buffer.from(normalizedProvided, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
