const COPYRIGHT_YEAR = 2026;

export function SiteFooter() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-amber-500/20 bg-neutral-950/90 px-3 py-3 shadow-2xl shadow-black/60 backdrop-blur-xl">
      <div className="mx-auto grid w-full max-w-md grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <a
            href="https://www.linkedin.com/in/ramideltoro"
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-neutral-900 text-xs font-bold text-amber-300 transition hover:bg-amber-500 hover:text-neutral-950"
          >
            in
          </a>

          <a
            href="https://www.youtube.com/channel/UCJGCyP50Jy6o6AfMdchVOww"
            target="_blank"
            rel="noreferrer"
            aria-label="YouTube"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-neutral-900 text-xs font-bold text-amber-300 transition hover:bg-amber-500 hover:text-neutral-950"
          >
            ▶
          </a>

          <a
            href="https://www.facebook.com/rami.del.toro.2025"
            target="_blank"
            rel="noreferrer"
            aria-label="Facebook"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-neutral-900 text-xs font-bold text-amber-300 transition hover:bg-amber-500 hover:text-neutral-950"
          >
            f
          </a>

          <a
            href="https://github.com/ramideltoro"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-neutral-900 text-[10px] font-bold text-amber-300 transition hover:bg-amber-500 hover:text-neutral-950"
          >
            GH
          </a>
        </div>

        <a
          href="/privacy"
          className="justify-self-center whitespace-nowrap rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 transition hover:border-amber-300/40 hover:bg-amber-400/20 hover:text-amber-100"
        >
          Privacy Policy
        </a>

        <div className="min-w-0 text-right text-[10px] leading-4 text-neutral-500">
          <p className="truncate">
            © {COPYRIGHT_YEAR}{" "}
            <a
              href="https://www.ramideltoro.com"
              target="_blank"
              rel="noreferrer"
              className="text-amber-300 transition hover:text-amber-200"
            >
              Rami Del Toro
            </a>
          </p>
          <p>All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}
