"use client";

import Link from "next/link";

import type { LanguageCode } from "@/lib/languages";
import { useSelectedLanguage } from "./useSelectedLanguage";

const teaserCopyByLanguage: Record<LanguageCode, { label: string; ariaLabel: string }> = {
  en: {
    label: "NutsNews for iPhone →",
    ariaLabel: "Learn about NutsNews mobile apps",
  },
  fr: {
    label: "NutsNews pour iPhone →",
    ariaLabel: "Découvrir les apps mobiles NutsNews",
  },
  ja: {
    label: "iPhone向けNutsNews →",
    ariaLabel: "NutsNewsのモバイルアプリについて見る",
  },
  "de-CH": {
    label: "NutsNews für iPhone →",
    ariaLabel: "Mehr über die mobilen Apps von NutsNews erfahren",
  },
  de: {
    label: "NutsNews für iPhone →",
    ariaLabel: "Mehr über die mobilen Apps von NutsNews erfahren",
  },
  el: {
    label: "NutsNews για iPhone →",
    ariaLabel: "Μάθετε για τις εφαρμογές NutsNews για κινητά",
  },
};

export function AppsTeaserLink() {
  const selectedLanguage = useSelectedLanguage();
  const copy = teaserCopyByLanguage[selectedLanguage] ?? teaserCopyByLanguage.en;

  return (
    <Link
      href="/apps"
      aria-label={copy.ariaLabel}
      className="mt-3 inline-flex rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--theme-accent-soft)] transition hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-glow-soft)] hover:text-[var(--theme-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--theme-accent)]"
    >
      {copy.label}
    </Link>
  );
}
