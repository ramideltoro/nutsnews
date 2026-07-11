import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin Sign-in | NutsNews",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      nocache: true,
    },
  },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AccessDeniedPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

const SAFE_ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "This Google account is not approved for NutsNews admin.",
  Configuration: "Sign-in is temporarily unavailable. Please try again in a moment.",
  OAuthAccountNotLinked: "We couldn't complete your sign-in. Please try again.",
  Callback: "We couldn't complete your sign-in. Please try again.",
  OAuthCallbackError: "We couldn't complete your sign-in. Please try again.",
  OAuthSignInError: "We couldn't complete your sign-in. Please try again.",
  CredentialsSignin: "We couldn't complete your sign-in. Please try again.",
};

function getSingleSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AccessDeniedPage({ searchParams }: AccessDeniedPageProps) {
  const resolvedSearchParams = await searchParams;
  const error = getSingleSearchValue(resolvedSearchParams?.error);
  const message = error ? SAFE_ERROR_MESSAGES[error] : undefined;

  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] px-4 py-8 text-amber-50 sm:px-6">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.22),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.14),_transparent_34%),linear-gradient(135deg,_#0a0a0a,_#171717_52%,_#451a03)]" />
        <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <section
        aria-labelledby="access-denied-title"
        className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center"
      >
        <div className="w-full rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/55 via-neutral-950/85 to-amber-950/25 p-6 shadow-2xl shadow-amber-950/30 backdrop-blur sm:p-8">
          <p className="inline-flex rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
            NutsNews Admin
          </p>
          <h1 id="access-denied-title" className="mt-5 text-3xl font-black tracking-tight text-amber-50 sm:text-4xl">
            We couldn&apos;t complete that sign-in
          </h1>
          <p role="alert" className="mt-3 text-sm leading-6 text-amber-100/70">
            {message ?? "Please try signing in again. If the problem continues, contact the NutsNews administrator."}
          </p>
          <Link
            href="/admin/login"
            className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full border border-amber-300/30 bg-amber-400/10 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-300/20"
          >
            Back to admin sign-in
          </Link>
        </div>
      </section>
    </main>
  );
}
