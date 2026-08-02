"use client";

import { useEffect, useMemo } from "react";
import Script from "next/script";

import {
  disableGoogleAnalytics,
  enableGoogleAnalytics,
  isGoogleAnalyticsMeasurementId,
} from "@/lib/analyticsConsent";
import { useRuntimePublicConfig } from "@/lib/runtimePublicConfigClient";
import { useAnalyticsConsent } from "./useAnalyticsConsent";

export function RuntimeAnalytics() {
  const config = useRuntimePublicConfig();
  const {
    browserBlocked: browserOptOut,
    effectiveConsent: analyticsConsent,
  } = useAnalyticsConsent();

  const gaId =
    config?.telemetryEnabled && isGoogleAnalyticsMeasurementId(config.gaId)
      ? config.gaId
      : null;
  const serializedGaId = useMemo(() => JSON.stringify(gaId), [gaId]);

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
