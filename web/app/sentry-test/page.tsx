"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryTestPage() {
    function throwClientError() {
        throw new Error("NutsNews Sentry client test error");
    }

    function captureManualError() {
        Sentry.captureException(
            new Error("NutsNews manually captured Sentry test error"),
        );
    }

    return (
        <main className="min-h-screen bg-neutral-950 px-6 py-10 text-amber-50">
            <section className="mx-auto max-w-xl rounded-3xl border border-amber-300/20 bg-black/40 p-6 shadow-2xl shadow-amber-950/20">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.24em] text-amber-300">
                    NutsNews diagnostics
                </p>

                <h1 className="text-3xl font-black tracking-tight">
                    Sentry test page
                </h1>

                <p className="mt-3 text-sm leading-6 text-amber-100/75">
                    Use this page after deployment to confirm that Sentry receives client
                    errors from the NutsNews frontend.
                </p>

                <div className="mt-6 flex flex-col gap-3">
                    <button
                        type="button"
                        onClick={throwClientError}
                        className="rounded-full bg-amber-300 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-neutral-950 transition hover:bg-amber-200"
                    >
                        Throw client error
                    </button>

                    <button
                        type="button"
                        onClick={captureManualError}
                        className="rounded-full border border-amber-300/30 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/70 hover:bg-amber-300/10"
                    >
                        Capture manual error
                    </button>
                </div>
            </section>
        </main>
    );
}