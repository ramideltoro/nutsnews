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
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function isGoogleAnalyticsMeasurementId(
  value: string | null | undefined,
) {
  return typeof value === "string" && /^G-[A-Z0-9-]+$/i.test(value);
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

export function getStoredAnalyticsConsentState(): AnalyticsConsentState | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  try {
    const storedState = window.localStorage.getItem(
      ANALYTICS_CONSENT_STORAGE_KEY,
    );

    return storedState === "granted" || storedState === "denied"
      ? storedState
      : null;
  } catch {
    return null;
  }
}

export function getAnalyticsConsentState(): AnalyticsConsentState {
  if (browserRequestsAnalyticsOptOut()) {
    return "denied";
  }

  return getStoredAnalyticsConsentState() === "granted" ? "granted" : "denied";
}

export function subscribeToAnalyticsConsentChanges(onChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key === null || event.key === ANALYTICS_CONSENT_STORAGE_KEY) {
      onChange();
    }
  }

  window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, onChange);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", handleStorageChange);
  };
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
  const hostnameLabels = hostname.split(".").filter(Boolean);

  for (let index = 1; index < hostnameLabels.length - 1; index += 1) {
    domains.add(`.${hostnameLabels.slice(index).join(".")}`);
  }

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
