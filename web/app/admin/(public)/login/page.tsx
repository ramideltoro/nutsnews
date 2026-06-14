import { signIn } from "@/auth";

export const metadata = {
    title: "Admin Login | NutsNews",
};

function GoogleIcon() {
    return (
        <svg
            aria-hidden="true"
            className="h-5 w-5"
            viewBox="0 0 24 24"
        >
            <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
                fill="#FBBC05"
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
            />
            <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
            />
        </svg>
    );
}

export default function AdminLoginPage() {
    return (
        <main className="min-h-screen overflow-hidden bg-[#0a0a0a] px-4 py-8 text-amber-50 sm:px-6">
            <div className="pointer-events-none fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.22),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.14),_transparent_34%),linear-gradient(135deg,_#0a0a0a,_#171717_52%,_#451a03)]" />
                <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/10 blur-3xl" />
                <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
            </div>

            <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
                <form
                    action={async () => {
                        "use server";

                        await signIn("google", {
                            redirectTo: "/admin",
                        });
                    }}
                >
                    <button
                        type="submit"
                        className="flex items-center justify-center gap-3 rounded-[1.4rem] border border-amber-200/50 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-7 py-4 text-sm font-black uppercase tracking-[0.16em] text-neutral-950 shadow-2xl shadow-amber-950/40 transition hover:scale-[1.02] hover:from-amber-200 hover:to-orange-300"
                    >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-inner">
              <GoogleIcon />
            </span>
                        Sign in with Google
                    </button>
                </form>
            </section>
        </main>
    );
}