"use client";

import Image from "next/image";

import type { LanguageCode } from "@/lib/languages";
import { HeroTagline } from "./HeroTagline";
import { NewspaperPrimaryNav } from "./NewspaperPrimaryNav";
import { useSelectedLanguage } from "./useSelectedLanguage";

export const homeHeaderCopyByLanguage: Record<
  LanguageCode,
  { ariaLabel: string }
> = {
  en: {
    ariaLabel: "NutsNews header",
  },
  fr: {
    ariaLabel: "En-tête NutsNews",
  },
  ja: {
    ariaLabel: "NutsNews ヘッダー",
  },
  "de-CH": {
    ariaLabel: "NutsNews-Kopfbereich",
  },
  de: {
    ariaLabel: "NutsNews-Kopfbereich",
  },
  el: {
    ariaLabel: "Κεφαλίδα NutsNews",
  },
};

export function HomeSiteHeader() {
  const selectedLanguage = useSelectedLanguage();
  const copy =
    homeHeaderCopyByLanguage[selectedLanguage] ?? homeHeaderCopyByLanguage.en;

  return (
    <header className="newspaper-site-header" aria-label={copy.ariaLabel}>
      <div className="newspaper-masthead">
        <h1 className="newspaper-logo" aria-label="NutsNews">
          <span>Nuts</span>
          <span className="newspaper-logo__mark">
            <Image
              src="/nutsnews-logo.png"
              alt=""
              width={96}
              height={96}
              priority
              unoptimized
              className="h-full w-full object-contain"
            />
          </span>
          <span>News</span>
        </h1>
        <HeroTagline variant="masthead" />
      </div>

      <NewspaperPrimaryNav />
    </header>
  );
}
