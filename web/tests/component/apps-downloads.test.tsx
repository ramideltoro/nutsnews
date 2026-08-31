import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { LocalizedAppsPage, appsCopyByLanguage } from "@/app/apps/LocalizedAppsPage";
import { metadata } from "@/app/apps/page";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/lib/languages";

const runtime = vi.hoisted(() => ({
  language: "en" as LanguageCode,
  hasRuntimeConfig: true,
  iosAppStoreUrl: "https://apps.apple.com/app/id1234567890",
}));

vi.mock("@/app/components/useSelectedLanguage", () => ({
  useSelectedLanguage: () => runtime.language,
}));

vi.mock("@/lib/runtimePublicConfigClient", () => ({
  useRuntimePublicConfig: () =>
    runtime.hasRuntimeConfig ? { iosAppStoreUrl: runtime.iosAppStoreUrl } : null,
}));

vi.mock("@/app/components/SiteFooter", () => ({
  SiteFooter: () => null,
}));

beforeEach(() => {
  runtime.language = "en";
  runtime.hasRuntimeConfig = true;
});

describe("NutsNews app downloads", () => {
  const expectedGooglePlayBadgeByLanguage: Record<LanguageCode, string> = {
    en: "/google-play-badges/en.svg",
    fr: "/google-play-badges/fr.svg",
    ja: "/google-play-badges/ja.svg",
    "de-CH": "/google-play-badges/de.svg",
    de: "/google-play-badges/de.svg",
    el: "/google-play-badges/el.svg",
  };

  test.each(SUPPORTED_LANGUAGES)(
    "offers both mobile apps with a localized official Google Play badge in $code",
    ({ code }) => {
      runtime.language = code;
      const copy = appsCopyByLanguage[code];
      render(<LocalizedAppsPage />);

      expect(screen.getByRole("main")).toHaveAttribute("lang", code);
      const hero = screen.getByRole("heading", { level: 1 });
      expect(hero).toHaveTextContent("iPhone");
      expect(hero).toHaveTextContent("Android");

      const googlePlayLink = screen.getByRole("link", {
        name: copy.googlePlayLabel,
      });
      expect(googlePlayLink).toHaveAttribute(
        "href",
        "https://play.google.com/store/apps/details?id=com.nutsnews.app",
      );
      expect(googlePlayLink).toHaveAttribute("target", "_blank");
      expect(googlePlayLink).toHaveAttribute("rel", "noreferrer");
      expect(googlePlayLink).toHaveClass("p-3", "sm:p-4");
      const googlePlayBadge = screen.getByRole("img", {
        name: copy.googlePlayLabel,
      });
      expect(googlePlayBadge).toHaveAttribute(
        "src",
        expectedGooglePlayBadgeByLanguage[code],
      );
      expect(googlePlayBadge).toHaveAttribute("width", "239");
      expect(googlePlayBadge).toHaveAttribute("height", "71");
      expect(googlePlayBadge).toHaveClass("h-10", "w-auto", "sm:h-[63px]");
      expect(screen.getByRole("link", { name: copy.appStoreAlt })).toHaveAttribute(
        "href",
        runtime.iosAppStoreUrl,
      );

      expect(
        screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
      ).toEqual(["iPad", "Apple Watch", "CarPlay"]);
      expect(
        screen.queryByRole("heading", { level: 3, name: "Android" }),
      ).not.toBeInTheDocument();
      expect(copy.roadmapItems.map((item) => item.label)).toEqual([
        "iPad",
        "Apple Watch",
        "CarPlay",
      ]);
    },
  );

  test("keeps the Google Play download available before runtime config loads", () => {
    runtime.hasRuntimeConfig = false;
    render(<LocalizedAppsPage />);

    expect(screen.getByRole("link", { name: "Get it on Google Play" })).toHaveAttribute(
      "href",
      "https://play.google.com/store/apps/details?id=com.nutsnews.app",
    );
    expect(screen.getByRole("link", { name: "Download on the App Store" })).toHaveAttribute(
      "href",
      "https://apps.apple.com/",
    );
  });

  test("announces both released mobile apps in search and sharing metadata", () => {
    for (const description of [
      metadata.description,
      metadata.openGraph?.description,
      metadata.twitter?.description,
    ]) {
      expect(description).toContain("iPhone and Android");
      expect(description).not.toContain("including Android");
    }
  });
});
