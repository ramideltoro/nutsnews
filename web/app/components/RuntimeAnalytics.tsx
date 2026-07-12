"use client";

import Script from "next/script";

import { useRuntimePublicConfig } from "@/lib/runtimePublicConfigClient";

export function RuntimeAnalytics() {
  const config = useRuntimePublicConfig();
  const gaId = config?.telemetryEnabled ? config.gaId : null;

  if (!gaId) {
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
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
