import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(source, fragment, label) {
  assert.match(
    source,
    new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `${label} must include ${fragment}`,
  );
}

const runtimeAnalytics = read("web/app/components/RuntimeAnalytics.tsx");
const analyticsConsent = read("web/lib/analyticsConsent.ts");
const analyticsConsentHook = read("web/app/components/useAnalyticsConsent.ts");
const analyticsConsentBanner = read("web/app/components/AnalyticsConsentBanner.tsx");
const globalStyles = read("web/app/globals.css");
const engagementAnalytics = read("web/lib/engagementAnalytics.ts");
const consentControls = read("web/app/privacy/AnalyticsConsentControls.tsx");
const siteFooter = read("web/app/components/SiteFooter.tsx");
const themeSwitcher = read("web/app/components/ThemeSwitcher.tsx");
const deployedUiSmoke = read("web/tests/deployed-ui-smoke.spec.ts");
const privacyPolicy = read("web/app/privacy/ios/LocalizedPrivacyPolicyPage.tsx");
const packageJson = JSON.parse(read("web/package.json"));

for (const fragment of [
  "useAnalyticsConsent",
  "disableGoogleAnalytics",
  "enableGoogleAnalytics",
  "isGoogleAnalyticsMeasurementId",
  "analyticsConsent !== \"granted\"",
  "allow_ad_personalization_signals",
  "allow_google_signals",
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "https://www.googletagmanager.com/gtag/js?id=",
]) {
  assertIncludes(runtimeAnalytics, fragment, "RuntimeAnalytics privacy gate");
}

for (const fragment of [
  "globalPrivacyControl",
  "doNotTrack",
  "msDoNotTrack",
  "getStoredAnalyticsConsentState",
  "subscribeToAnalyticsConsentChanges",
  "storedState === \"granted\" || storedState === \"denied\"",
  "return \"denied\"",
  "localStorage.setItem",
  "ga-disable-",
  "clearGoogleAnalyticsStorage",
  "enableGoogleAnalytics",
  "_ga_",
  "hostnameLabels",
  'domains.add(`.${hostnameLabels.slice(index).join(".")}`)',
]) {
  assertIncludes(analyticsConsent, fragment, "analytics consent helper");
}

for (const fragment of [
  "useAnalyticsConsent",
  "browserRequestsAnalyticsOptOut",
  "getAnalyticsConsentState",
  "getStoredAnalyticsConsentState",
  "subscribeToAnalyticsConsentChanges",
]) {
  assertIncludes(analyticsConsentHook, fragment, "shared analytics consent synchronization");
}

for (const fragment of [
  "browserRequestsAnalyticsOptOut",
  "getAnalyticsConsentState() === \"granted\"",
  "navigator.sendBeacon",
  "keepalive: true",
  "eventType: \"outbound_click\"",
  "eventType: \"category_interest\"",
]) {
  assertIncludes(engagementAnalytics, fragment, "engagement analytics helper");
}

for (const fragment of [
  "AnalyticsConsentControls",
  "useAnalyticsConsent",
  "setAnalyticsConsentState(nextConsent)",
  "updateConsent(\"denied\")",
  "updateConsent(\"granted\")",
  "statusBlocked",
]) {
  assertIncludes(consentControls, fragment, "privacy consent controls");
}

for (const fragment of [
  "AnalyticsConsentBanner",
  "analyticsConsentBannerCopyByLanguage",
  "storedConsent !== null",
  "browserBlocked",
  "telemetryEnabled",
  "isGoogleAnalyticsMeasurementId",
  "nutsnews-analytics-consent-deny",
  "nutsnews-analytics-consent-allow",
  "analytics-consent-banner fixed",
  "flex flex-col gap-2",
  "setAnalyticsConsentState(\"denied\")",
  "setAnalyticsConsentState(\"granted\")",
]) {
  assertIncludes(analyticsConsentBanner, fragment, "first-visit analytics consent banner");
}

assertIncludes(
  siteFooter,
  "<AnalyticsConsentBanner />",
  "public site footer analytics consent mount",
);

assertIncludes(
  globalStyles,
  ".public-themed-page > section:not(.analytics-consent-banner)",
  "public page analytics banner positioning",
);

for (const fragment of [
  "useAnalyticsConsent",
  'role="switch"',
  'data-testid="nutsnews-settings-analytics"',
  "browserBlocked",
  "storedConsent",
  "browserBlocked && !analyticsAllowed",
  "setAnalyticsConsentState",
]) {
  assertIncludes(themeSwitcher, fragment, "settings analytics control");
}

for (const fragment of [
  "ANALYTICS_CONSENT_TEST_TITLE",
  "PRODUCTION_GA_MEASUREMENT_ID",
  "G-8VXSG5NWM4",
  "seedAnalyticsDenial",
  "nutsnews-analytics-consent-banner",
  "nutsnews-analytics-consent-allow",
  "www\\.googletagmanager\\.com",
  "google-analytics\\.com",
  "blockedbyclient",
  ".toBe('granted')",
  "collectionRequests",
]) {
  assertIncludes(deployedUiSmoke, fragment, "deployed analytics consent smoke");
}

for (const fragment of [
  "Google Analytics 4",
  "The default is off.",
  "Do Not Track",
  "Global Privacy Control",
  "The allowed taxonomy is intentionally small",
  "first-party aggregate counters",
  "outbound article clicks and category interest",
  "event type, article ID, source, and category",
  "raw URLs, article titles, referrers, IP addresses, user agents, cookies, or visitor identifiers",
  "NutsNews does not define custom analytics events for likes, saved stories, searches, personal profiles, or cross-device tracking.",
  "Advertising personalization and Google Signals are disabled.",
  "Sentry may collect production errors and diagnostics",
  "analyticsConsent",
]) {
  assertIncludes(privacyPolicy, fragment, "privacy policy analytics disclosure");
}

assert.equal(
  packageJson.scripts?.["test:privacy-analytics"],
  "node ../scripts/privacy_analytics_regression.mjs",
  "web/package.json is missing test:privacy-analytics",
);

assert.equal(
  packageJson.scripts?.["test:article-engagement-analytics"],
  "node ../scripts/article_engagement_analytics_regression.mjs",
  "web/package.json is missing test:article-engagement-analytics",
);

console.log("Privacy analytics regression checks passed.");
