"use client";

import { useEffect, useState } from "react";

import {
  type AnalyticsConsentState,
  browserRequestsAnalyticsOptOut,
  getAnalyticsConsentState,
  setAnalyticsConsentState,
} from "@/lib/analyticsConsent";

export type AnalyticsConsentControlCopy = {
  title: string;
  body: string;
  statusLabel: string;
  statusAllowed: string;
  statusDenied: string;
  statusBlocked: string;
  allowButton: string;
  denyButton: string;
};

export function AnalyticsConsentControls({
  copy,
}: {
  copy: AnalyticsConsentControlCopy;
}) {
  const [consent, setConsent] = useState<AnalyticsConsentState>("denied");
  const [browserBlocked, setBrowserBlocked] = useState(true);

  useEffect(() => {
    function syncConsent() {
      setBrowserBlocked(browserRequestsAnalyticsOptOut());
      setConsent(getAnalyticsConsentState());
    }

    syncConsent();
  }, []);

  function updateConsent(nextConsent: AnalyticsConsentState) {
    setAnalyticsConsentState(nextConsent);
    setBrowserBlocked(browserRequestsAnalyticsOptOut());
    setConsent(getAnalyticsConsentState());
  }

  const analyticsAllowed = consent === "granted" && !browserBlocked;
  const statusText = browserBlocked
    ? copy.statusBlocked
    : analyticsAllowed
      ? copy.statusAllowed
      : copy.statusDenied;

  return (
    <section className="mt-6 rounded-[1.75rem] border border-amber-300/15 bg-black/25 p-5 shadow-xl shadow-amber-950/15">
      <h2 className="text-lg font-black tracking-tight text-amber-100">
        {copy.title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-neutral-300">{copy.body}</p>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-amber-300/80">
        {copy.statusLabel}: {statusText}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => updateConsent("denied")}
          className="rounded-full border border-amber-300/25 bg-black/30 px-5 py-3 text-sm font-black text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-400/10"
        >
          {copy.denyButton}
        </button>
        <button
          type="button"
          onClick={() => updateConsent("granted")}
          disabled={browserBlocked}
          className="rounded-full border border-amber-300/25 bg-amber-400/15 px-5 py-3 text-sm font-black text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-300 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-amber-300/25 disabled:hover:bg-amber-400/15 disabled:hover:text-amber-100"
        >
          {copy.allowButton}
        </button>
      </div>
    </section>
  );
}
