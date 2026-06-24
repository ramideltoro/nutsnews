import Link from "next/link";

import { ThemeSwitcher } from "./ThemeSwitcher";

const COPYRIGHT_YEAR = 2026;

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
  return (
    <footer className="site-footer-modern">
      <div className="site-footer-modern__inner">
        <div className="site-footer-modern__top-row">
          <div className="site-footer-modern__controls" aria-label="Site shortcuts">
            <Link href="/" className="footer-icon-button" aria-label="Go to NutsNews home">
              <span className="footer-icon-button__halo" />
              <HomeIcon className="footer-icon-button__icon" />
            </Link>

            <ThemeSwitcher />
          </div>

          <nav aria-label="Footer navigation" className="site-footer-modern__nav">
            <Link href="/about" className="site-footer-modern__link">
              About
            </Link>
            <Link href="/contact" className="site-footer-modern__link">
              Contact
            </Link>
            <Link href="/privacy" className="site-footer-modern__link">
              Privacy
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
          · All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
