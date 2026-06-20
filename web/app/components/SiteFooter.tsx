import type { ReactNode } from "react";

const COPYRIGHT_YEAR = 2026;

const SOCIAL_LINK_CLASS =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-neutral-900 text-amber-300 transition hover:bg-amber-500 hover:text-neutral-950";

type SocialIconLinkProps = {
  href: string;
  label: string;
  children: ReactNode;
};

function SocialIconLink({ href, label, children }: SocialIconLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className={SOCIAL_LINK_CLASS}
    >
      {children}
    </a>
  );
}

function LinkedInIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="currentColor"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.447-2.136 2.941v5.665H9.351V9h3.414v1.561h.047c.476-.9 1.637-1.85 3.37-1.85 3.602 0 4.267 2.371 4.267 5.455v6.286h-.002ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.114 20.452H3.559V9h3.555v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="currentColor"
    >
      <path d="M23.498 6.186a3.01 3.01 0 0 0-2.12-2.13C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.378.511a3.01 3.01 0 0 0-2.12 2.13C0 8.07 0 12 0 12s0 3.93.502 5.814a3.01 3.01 0 0 0 2.12 2.13c1.873.511 9.378.511 9.378.511s7.505 0 9.378-.511a3.01 3.01 0 0 0 2.12-2.13C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="currentColor"
    >
      <path d="M12 .297C5.373.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.725-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.238 1.84 1.238 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.304.762-1.604-2.665-.303-5.467-1.333-5.467-5.93 0-1.31.468-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.322 3.3 1.23a11.48 11.48 0 0 1 3.003-.404c1.018.005 2.045.137 3.003.404 2.29-1.552 3.296-1.23 3.296-1.23.655 1.652.243 2.873.12 3.176.77.84 1.234 1.911 1.234 3.221 0 4.609-2.807 5.624-5.48 5.921.43.372.814 1.103.814 2.222 0 1.604-.015 2.896-.015 3.289 0 .322.216.696.825.578C20.565 22.092 24 17.597 24 12.297c0-6.627-5.373-12-12-12Z" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-amber-500/20 bg-neutral-950/90 px-3 py-3 shadow-2xl shadow-black/60 backdrop-blur-xl">
      <div className="mx-auto grid w-full max-w-md grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SocialIconLink
            href="https://www.linkedin.com/in/ramideltoro"
            label="LinkedIn"
          >
            <LinkedInIcon />
          </SocialIconLink>

          <SocialIconLink
            href="https://www.youtube.com/channel/UCJGCyP50Jy6o6AfMdchVOww"
            label="YouTube"
          >
            <YouTubeIcon />
          </SocialIconLink>

          <SocialIconLink href="https://github.com/ramideltoro" label="GitHub">
            <GitHubIcon />
          </SocialIconLink>
        </div>

        <nav
          aria-label="Footer navigation"
          className="flex justify-self-center rounded-full border border-amber-400/20 bg-amber-400/10 p-1"
        >
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
