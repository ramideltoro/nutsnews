import Link from "next/link";
import { getEdgeFeedSnapshotStatus } from "@/lib/edgeFeedSnapshot";

export const metadata = {
  title: "Edge Snapshot | NutsNews Admin",
};

function formatAge(seconds: number | null) {
  if (typeof seconds !== "number") {
    return "Unknown";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 48) {
    return `${hours}h`;
  }

  return `${Math.floor(hours / 24)}d`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/30 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/70">
        {label}
      </p>
      <p className="mt-2 break-words text-2xl font-black text-amber-50">
        {value}
      </p>
    </div>
  );
}

export default async function EdgeSnapshotAdminPage() {
  const status = await getEdgeFeedSnapshotStatus();
  const isHealthy = status.status === "hit" && status.enabled;

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-6 text-amber-50 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5">
          <Link
            href="/admin"
            className="inline-flex rounded-full border border-amber-300/20 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/10"
          >
            ← Admin
          </Link>
        </div>

        <header className="mb-5 rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/55 via-neutral-950/85 to-amber-950/25 p-6 shadow-2xl shadow-amber-950/30">
          <p className="mb-4 inline-flex rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
            Resiliency
          </p>
          <h1 className="text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">
            Edge Feed Snapshot
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
            This shows the last-known-good public feed snapshot served from the
            Cloudflare Worker edge fallback. The public API uses it only when
            Supabase snapshot and article reads are unavailable.
          </p>
        </header>

        <section className="mb-5 rounded-[2rem] border border-amber-300/20 bg-black/25 p-5 shadow-xl shadow-amber-950/10 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                Current Status
              </p>
              <h2 className="mt-2 text-2xl font-black text-amber-50">
                {isHealthy ? "Edge fallback ready" : "Edge fallback not ready"}
              </h2>
            </div>
            <span
              className={`w-fit rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                isHealthy
                  ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                  : "border-amber-300/20 bg-black/30 text-amber-100/65"
              }`}
            >
              {status.status}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Configured" value={status.configured ? "Yes" : "No"} />
            <StatCard label="Snapshot age" value={formatAge(status.ageSeconds)} />
            <StatCard label="Article count" value={String(status.articleCount ?? "Unknown")} />
            <StatCard label="Version" value={String(status.version ?? "Unknown")} />
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-amber-300/15 bg-black/30 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/70">
              Endpoint
            </p>
            <p className="mt-2 break-all text-sm leading-6 text-amber-100/70">
              {status.endpoint ?? "Not configured"}
            </p>
            {status.updatedAt ? (
              <p className="mt-3 text-sm leading-6 text-amber-100/60">
                Updated at: {status.updatedAt}
              </p>
            ) : null}
            {status.refreshedAt ? (
              <p className="mt-1 text-sm leading-6 text-amber-100/60">
                Supabase snapshot refreshed at: {status.refreshedAt}
              </p>
            ) : null}
            {status.message ? (
              <p className="mt-3 text-sm leading-6 text-amber-100/60">
                {status.message}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
