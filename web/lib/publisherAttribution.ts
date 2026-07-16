export const PUBLISHER_ATTRIBUTION_POLICY_VERSION = "2026-07-16";

export const PUBLISHER_ATTRIBUTION_POLICY_SUMMARY =
  "NutsNews shows short original summaries, keeps the original publisher visible, and sends readers to the publisher for the complete story.";

export const PUBLISHER_REMOVAL_CONTACT_PATH = "/contact";

export function formatPublisherName(source: string | null | undefined) {
  if (!source) {
    return "NutsNews";
  }

  const cleanedSource = source
    .replace(/^Google\s+News\s*-\s*/i, "")
    .replace(/^Google\s*-\s*/i, "")
    .trim();

  return cleanedSource || "NutsNews";
}

export function getPublisherAttribution(
  source: string | null | undefined,
  originalUrl: string,
) {
  const publisherName = formatPublisherName(source);

  return {
    publisherName,
    originalUrl,
    policyVersion: PUBLISHER_ATTRIBUTION_POLICY_VERSION,
    policySummary: PUBLISHER_ATTRIBUTION_POLICY_SUMMARY,
    readFullStoryLabel: `Read full story at ${publisherName}`,
    removalContactUrl: `${PUBLISHER_REMOVAL_CONTACT_PATH}?topic=publisher-removal&source=${encodeURIComponent(
      publisherName,
    )}`,
  };
}
