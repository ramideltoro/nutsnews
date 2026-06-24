"use client";

import { useEffect } from "react";

const STORAGE_KEY = "nutsnews-build-version";
const REFRESHED_KEY = "nutsnews-build-refresh-complete";

type AppVersionGuardProps = {
  version: string;
};

export function AppVersionGuard({ version }: AppVersionGuardProps) {
  useEffect(() => {
    if (!version || version === "development") {
      return;
    }

    try {
      const storedVersion = window.localStorage.getItem(STORAGE_KEY);
      const refreshedForVersion = window.sessionStorage.getItem(REFRESHED_KEY);

      if (!storedVersion) {
        window.localStorage.setItem(STORAGE_KEY, version);
        return;
      }

      if (storedVersion !== version) {
        window.localStorage.setItem(STORAGE_KEY, version);

        if (refreshedForVersion !== version) {
          window.sessionStorage.setItem(REFRESHED_KEY, version);
          window.location.reload();
        }
      }
    } catch {
      // Storage can be unavailable in private/restricted browsing.
      // In that case, skip the guard and let normal HTTP revalidation handle it.
    }
  }, [version]);

  return null;
}
