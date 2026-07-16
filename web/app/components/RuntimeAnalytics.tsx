"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";

import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  type AnalyticsConsentState,
  browserRequestsAnalyticsOptOut,
  disableGoogleAnalytics,
  enableGoogleAnalytics,
  getAnalyticsConsentState,
} from "@/lib/analyticsConsent";
import { useRuntimePublicConfig } from "@/lib/runtimePublicConfigClient";

function isGoogleAnalyticsMeasurementId(value: string | null | undefined) {
  return typeof value === "string" && /^G-[A-Z0-9-]+$/i.test(value);
}

export function RuntimeAnalytics() {
  const config = useRuntimePublicConfig();
  const [analyticsConsent, setAnalyticsConsent] =
    useState<AnalyticsConsentState>("denied");
  const [browserOptOut, setBrowserOptOut] = useState(true);

  const gaId =
    config?.telemetryEnabled && isGoogleAnalyticsMeasurementId(config.gaId)
      ? config.gaId
      : null;
  const serializedGaId = useMemo(() => JSON.stringify(gaId), [gaId]);

  useEffect(() => {
    function syncConsent() {
      setBrowserOptOut(browserRequestsAnalyticsOptOut());
      setAnalyticsConsent(getAnalyticsConsentState());
    }

    function syncStorage(event: StorageEvent) {
      if (event.key === ANALYTICS_CONSENT_STORAGE_KEY) {
        syncConsent();
      }
    }

    syncConsent();
    window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, syncConsent);
    window.addEventListener("storage", syncStorage);

    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, syncConsent);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  useEffect(() => {
    if (gaId && (browserOptOut || analyticsConsent !== "granted")) {
      disableGoogleAnalytics(gaId);
    } else if (gaId) {
      enableGoogleAnalytics(gaId);
    }
  }, [analyticsConsent, browserOptOut, gaId]);

  if (!gaId || browserOptOut || analyticsConsent !== "granted") {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            functionality_storage: 'denied',
            personalization_storage: 'denied',
            security_storage: 'granted'
          });
          gtag('js', new Date());
          gtag('set', 'allow_ad_personalization_signals', false);
          gtag('set', 'allow_google_signals', false);
          gtag('config', ${serializedGaId}, {
            send_page_view: true,
            allow_ad_personalization_signals: false,
            allow_google_signals: false
          });
        `}
      </Script>
    </>
  );
}
