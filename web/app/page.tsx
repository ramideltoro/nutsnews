import { ArticleFeed } from "./components/ArticleFeed";

export default function Home() {
  const currentYear = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-neutral-950 text-amber-50">
      <section className="mx-auto min-h-screen w-full max-w-md px-5 pb-28 pt-8">
        {/* Keep your existing banner/header here */}

        <ArticleFeed />

        <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-amber-500/20 bg-neutral-950/95 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <a
                href="https://www.linkedin.com/in/ramideltoro"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/20 bg-neutral-900 text-sm font-bold text-amber-300 transition hover:bg-amber-500 hover:text-neutral-950"
              >
                in
              </a>

              <a
                href="https://www.youtube.com/channel/UCJGCyP50Jy6o6AfMdchVOww"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/20 bg-neutral-900 text-sm font-bold text-amber-300 transition hover:bg-amber-500 hover:text-neutral-950"
              >
                ▶
              </a>

              <a
                href="https://www.facebook.com/rami.del.toro.2025"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/20 bg-neutral-900 text-sm font-bold text-amber-300 transition hover:bg-amber-500 hover:text-neutral-950"
              >
                f
              </a>
            </div>

            <p className="text-right text-[11px] leading-4 text-neutral-500">
              © {currentYear} Rami Del Toro, All Rights Reserved.
            </p>
          </div>
        </footer>
      </section>
    </main>
  );
}