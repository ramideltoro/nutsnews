const COPYRIGHT_YEAR = 2026;

export function SiteFooter() {
  return (
    <footer className="site-footer-modern">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-1.5">
        <nav aria-label="Footer navigation" className="site-footer-modern__nav">
          <a href="/about" className="site-footer-modern__link">
            About
          </a>
          <a href="/contact" className="site-footer-modern__link">
            Contact
          </a>
          <a href="/privacy" className="site-footer-modern__link">
            Privacy
          </a>
        </nav>

        <p className="whitespace-nowrap text-center text-[9px] leading-3 text-[var(--theme-muted-strong)]">
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
