"use client";

import Link from "next/link";

import { type LanguageCode } from "@/lib/languages";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useSelectedLanguage } from "./useSelectedLanguage";

const COPYRIGHT_YEAR = 2026;

const footerCopyByLanguage: Record<
  LanguageCode,
  {
    shortcuts: string;
    homeAria: string;
    footerNav: string;
    about: string;
    contact: string;
    privacy: string;
    rights: string;
  }
> = {
  en: {
    shortcuts: "Site shortcuts",
    homeAria: "Go to NutsNews home",
    footerNav: "Footer navigation",
    about: "About",
    contact: "Contact",
    privacy: "Privacy",
    rights: "All Rights Reserved.",
  },
  fr: {
    shortcuts: "Raccourcis du site",
    homeAria: "Aller à l’accueil de NutsNews",
    footerNav: "Navigation du pied de page",
    about: "À propos",
    contact: "Contact",
    privacy: "Confidentialité",
    rights: "Tous droits réservés.",
  },
  ja: {
    shortcuts: "サイトのショートカット",
    homeAria: "NutsNewsのホームへ移動",
    footerNav: "フッターナビゲーション",
    about: "概要",
    contact: "お問い合わせ",
    privacy: "プライバシー",
    rights: "All Rights Reserved.",
  },
};

function HomeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="m3 10.5 9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

export function SiteFooter() {
  const selectedLanguage = useSelectedLanguage();
  const copy = footerCopyByLanguage[selectedLanguage];

  return (
    <footer className="site-footer-modern">
      <div className="site-footer-modern__inner">
        <div className="site-footer-modern__top-row">
          <div
            className="site-footer-modern__controls"
            aria-label={copy.shortcuts}
          >
            <Link
              href="/"
              className="footer-icon-button"
              aria-label={copy.homeAria}
            >
              <span className="footer-icon-button__halo" />
              <HomeIcon className="footer-icon-button__icon" />
            </Link>

            <ThemeSwitcher />
          </div>

          <nav aria-label={copy.footerNav} className="site-footer-modern__nav">
            <Link href="/about" className="site-footer-modern__link">
              {copy.about}
            </Link>
            <Link href="/contact" className="site-footer-modern__link">
              {copy.contact}
            </Link>
            <Link href="/privacy" className="site-footer-modern__link">
              {copy.privacy}
            </Link>
          </nav>
        </div>

        <p className="site-footer-modern__copyright">
          © {COPYRIGHT_YEAR}{" "}
          <a
            href="https://www.ramideltoro.com"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[var(--theme-accent)] transition hover:text-[var(--theme-accent-soft)]"
          >
            Rami Del Toro
          </a>{" "}
          · {copy.rights}
        </p>
      </div>
    </footer>
  );
}
