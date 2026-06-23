const COPYRIGHT_YEAR = 2026;

export function SiteFooter() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-amber-500/20 bg-neutral-950/90 px-3 py-3 shadow-2xl shadow-black/60 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2">
        <nav
          aria-label="Footer navigation"
          className="flex rounded-full border border-amber-400/20 bg-amber-400/10 p-1"
        >
          <a
            href="/about"
            className="whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold text-amber-200 transition hover:bg-amber-400/20 hover:text-amber-100"
          >
            About
          </a>
          <a
            href="/contact"
            className="whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold text-amber-200 transition hover:bg-amber-400/20 hover:text-amber-100"
          >
            Contact
          </a>
          <a
            href="/privacy"
            className="whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold text-amber-200 transition hover:bg-amber-400/20 hover:text-amber-100"
          >
            Privacy
          </a>
        </nav>

        <p className="whitespace-nowrap text-center text-[10px] leading-4 text-neutral-500">
          © {COPYRIGHT_YEAR} {" "}
          <a
            href="https://www.ramideltoro.com"
            target="_blank"
            rel="noreferrer"
            className="text-amber-300 transition hover:text-amber-200"
          >
            Rami Del Toro
          </a>{" "}
          · All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
