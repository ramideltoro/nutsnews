export const ARTICLE_IMAGE_QUALITY = 72;

export const ARTICLE_CARD_IMAGE_SIZES =
  "(max-width: 640px) calc(100vw - 2rem), 448px";

export const ARTICLE_DETAIL_IMAGE_SIZES =
  "(max-width: 640px) calc(100vw - 2rem), 448px";

export const ARTICLE_IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 20'%3E%3Cdefs%3E%3CradialGradient id='a' cx='78%25' cy='10%25' r='75%25'%3E%3Cstop offset='0%25' stop-color='%23f59e0b' stop-opacity='.48'/%3E%3Cstop offset='48%25' stop-color='%23171717'/%3E%3Cstop offset='100%25' stop-color='%230a0a0a'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='32' height='20' fill='url(%23a)'/%3E%3C/svg%3E";

const SAFE_IMAGE_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeArticleImageUrl(imageUrl?: string | null) {
  const trimmedUrl = imageUrl?.trim();

  if (!trimmedUrl || trimmedUrl.length > 2_048) {
    return null;
  }

  if (trimmedUrl.startsWith("/")) {
    return trimmedUrl.startsWith("//") ? `https:${trimmedUrl}` : trimmedUrl;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);

    if (!SAFE_IMAGE_PROTOCOLS.has(parsedUrl.protocol)) {
      return null;
    }

    parsedUrl.hash = "";

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

export function shouldBypassNextImageOptimization(imageUrl: string) {
  try {
    const parsedUrl = new URL(imageUrl, "https://www.nutsnews.com");
    const pathname = parsedUrl.pathname.toLowerCase();

    return pathname.endsWith(".svg");
  } catch {
    return true;
  }
}
