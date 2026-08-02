"use client";

import { useEffect, useState } from "react";

import {
  type AnalyticsConsentState,
  browserRequestsAnalyticsOptOut,
  getAnalyticsConsentState,
  getStoredAnalyticsConsentState,
  subscribeToAnalyticsConsentChanges,
} from "@/lib/analyticsConsent";

export type AnalyticsConsentSnapshot = {
  browserBlocked: boolean;
  effectiveConsent: AnalyticsConsentState;
  storedConsent: AnalyticsConsentState | null;
};

const serverSnapshot: AnalyticsConsentSnapshot = {
  browserBlocked: true,
  effectiveConsent: "denied",
  storedConsent: null,
};

function readAnalyticsConsentSnapshot(): AnalyticsConsentSnapshot {
  return {
    browserBlocked: browserRequestsAnalyticsOptOut(),
    effectiveConsent: getAnalyticsConsentState(),
    storedConsent: getStoredAnalyticsConsentState(),
  };
}

export function useAnalyticsConsent() {
  const [snapshot, setSnapshot] =
    useState<AnalyticsConsentSnapshot>(serverSnapshot);

  useEffect(() => {
    function syncConsent() {
      setSnapshot(readAnalyticsConsentSnapshot());
    }

    syncConsent();
    return subscribeToAnalyticsConsentChanges(syncConsent);
  }, []);

  return snapshot;
}
