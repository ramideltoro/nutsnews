"use client";

export const ANALYTICS_CONSENT_STORAGE_KEY = "nutsnews.web.analytics-consent";
export const ANALYTICS_CONSENT_CHANGED_EVENT = "nutsnews:analytics-consent-changed";

export type AnalyticsConsentState = "granted" | "denied";

type NavigatorWithPrivacySignals = Navigator & {
  globalPrivacyControl?: boolean;
  msDoNotTrack?: string | null;
};

type WindowWithPrivacySignals = Window & {
  doNotTrack?: string | null;
  [key: `ga-disable-${string}`]: boolean | undefined;
};

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function browserRequestsAnalyticsOptOut() {
  if (typeof window === "undefined") {
    return true;
  }

  const navigatorWithSignals = window.navigator as NavigatorWithPrivacySignals;
  const windowWithSignals = window as unknown as WindowWithPrivacySignals;

  return (
    navigatorWithSignals.globalPrivacyControl === true ||
    navigatorWithSignals.doNotTrack === "1" ||
    navigatorWithSignals.msDoNotTrack === "1" ||
    windowWithSignals.doNotTrack === "1"
  );
}

export function getAnalyticsConsentState(): AnalyticsConsentState {
  if (!canUseBrowserStorage() || browserRequestsAnalyticsOptOut()) {
    return "denied";
  }

  try {
    return window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) === "granted"
      ? "granted"
      : "denied";
  } catch {
    return "denied";
  }
}

export function setAnalyticsConsentState(nextState: AnalyticsConsentState) {
  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, nextState);
  } catch {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(ANALYTICS_CONSENT_CHANGED_EVENT, {
      detail: { state: nextState },
    }),
  );
}

function expireCookie(name: string, domain?: string) {
  const domainClause = domain ? `; Domain=${domain}` : "";
  document.cookie = `${name}=; Max-Age=0; Path=/${domainClause}; SameSite=Lax`;
}

export function clearGoogleAnalyticsStorage(measurementId: string) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const measurementCookieSuffix = measurementId.replace(/^G-/i, "");
  const cookieNames = new Set(["_ga", "_gid", "_gat", `_ga_${measurementCookieSuffix}`]);
  const hostname = window.location.hostname;
  const domains = new Set<string | undefined>([undefined, hostname, `.${hostname}`]);

  for (const name of cookieNames) {
    for (const domain of domains) {
      expireCookie(name, domain);
    }
  }
}

export function disableGoogleAnalytics(measurementId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const windowWithSignals = window as unknown as WindowWithPrivacySignals;
  windowWithSignals[`ga-disable-${measurementId}`] = true;
  clearGoogleAnalyticsStorage(measurementId);
}

export function enableGoogleAnalytics(measurementId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const windowWithSignals = window as unknown as WindowWithPrivacySignals;
  windowWithSignals[`ga-disable-${measurementId}`] = false;
}
