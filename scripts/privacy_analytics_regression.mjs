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
const consentControls = read("web/app/privacy/AnalyticsConsentControls.tsx");
const privacyPolicy = read("web/app/privacy/LocalizedPrivacyPolicyPage.tsx");
const packageJson = JSON.parse(read("web/package.json"));

for (const fragment of [
  "ANALYTICS_CONSENT_STORAGE_KEY",
  "ANALYTICS_CONSENT_CHANGED_EVENT",
  "browserRequestsAnalyticsOptOut",
  "getAnalyticsConsentState",
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
  "return \"denied\"",
  "localStorage.setItem",
  "ga-disable-",
  "clearGoogleAnalyticsStorage",
  "enableGoogleAnalytics",
  "_ga_",
]) {
  assertIncludes(analyticsConsent, fragment, "analytics consent helper");
}

for (const fragment of [
  "AnalyticsConsentControls",
  "setAnalyticsConsentState(nextConsent)",
  "updateConsent(\"denied\")",
  "updateConsent(\"granted\")",
  "browserRequestsAnalyticsOptOut",
  "statusBlocked",
]) {
  assertIncludes(consentControls, fragment, "privacy consent controls");
}

for (const fragment of [
  "Google Analytics 4",
  "The default is off.",
  "Do Not Track",
  "Global Privacy Control",
  "The allowed taxonomy is intentionally small",
  "NutsNews does not currently define custom analytics events",
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

console.log("Privacy analytics regression checks passed.");
