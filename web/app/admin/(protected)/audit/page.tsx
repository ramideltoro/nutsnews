import Link from "next/link";
import {
  type AdminAuditEvent,
  formatAdminAuditDateTime,
  getAdminAuditLogData,
} from "@/lib/adminAuditLog";

export const metadata = {
  title: "Audit Log | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatJson(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function FieldDiff({ event }: { event: AdminAuditEvent }) {
  const keys = Array.from(
    new Set([...Object.keys(event.beforeValues), ...Object.keys(event.afterValues)]),
  ).sort();

  if (keys.length === 0) {
    return (
      <p className="text-sm leading-6 text-amber-100/55">
        No structured before or after values were saved for this event.
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
          Before
        </p>
        <pre className="max-h-64 overflow-auto rounded-[1.25rem] border border-amber-300/15 bg-black/40 p-3 text-xs leading-5 text-amber-100/75">
          {formatJson(event.beforeValues)}
        </pre>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
          After
        </p>
        <pre className="max-h-64 overflow-auto rounded-[1.25rem] border border-amber-300/15 bg-black/40 p-3 text-xs leading-5 text-amber-100/75">
          {formatJson(event.afterValues)}
        </pre>
      </div>
    </div>
  );
}

function AuditEventCard({ event }: { event: AdminAuditEvent }) {
  return (
    <article className="rounded-[1.6rem] border border-amber-300/15 bg-black/30 p-4 shadow-lg shadow-amber-950/10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">
              {event.actionLabel}
            </span>
            <span className="rounded-full border border-amber-300/15 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100/80">
              {event.targetType}
            </span>
          </div>

          <h2 className="break-words text-lg font-black text-amber-50">
            {event.targetLabel ?? event.targetId ?? event.action}
          </h2>
          <p className="mt-1 break-all text-xs leading-5 text-amber-100/45">
            {event.targetId ? `Target ID ${event.targetId}` : "Target ID unavailable"}
          </p>
        </div>

        <div className="shrink-0 rounded-[1.25rem] border border-amber-300/15 bg-black/35 p-3 text-left lg:min-w-72">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
            Actor
          </p>
          <p className="mt-2 break-all text-sm font-semibold text-amber-50">
            {event.actorEmail}
          </p>
          <p className="mt-2 text-xs leading-5 text-amber-100/55">
            {formatAdminAuditDateTime(event.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-amber-300/10 pt-4">
        <FieldDiff event={event} />
      </div>
    </article>
  );
}

export default async function AdminAuditLogPage() {
  const data = await getAdminAuditLogData();

  if (!data.isConfigured) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] px-4 py-6 text-amber-50 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-red-300/25 bg-red-500/10 p-6 shadow-xl shadow-red-950/20">
          <h1 className="text-3xl font-black text-red-100">Audit Log Unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-red-100/75">{data.errorMessage}</p>
          <Link href="/admin" className="mt-5 inline-flex rounded-full border border-amber-300/25 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-100">
            Back to admin
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] px-4 py-6 text-amber-50 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.22),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.14),_transparent_34%),linear-gradient(135deg,_#0a0a0a,_#171717_52%,_#451a03)]" />
        <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl">
        <header className="mb-5 rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/55 via-neutral-950/85 to-amber-950/25 p-5 shadow-2xl shadow-amber-950/30 backdrop-blur sm:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <Link href="/admin" className="mb-4 inline-flex rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100 transition hover:border-amber-300/50">
                Admin
              </Link>
              <h1 className="text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">
                Audit Log
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                Recent sensitive admin actions with actor, target, timestamp, and before/after values.
              </p>
            </div>

            <div className="rounded-[1.45rem] border border-amber-300/15 bg-black/30 p-4 text-left md:min-w-72">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/80">
                Events
              </p>
              <p className="mt-2 text-3xl font-black text-amber-50">
                {data.events.length}
              </p>
              <p className="mt-2 text-xs leading-5 text-amber-100/55">
                Generated {formatAdminAuditDateTime(data.generatedAt)}
              </p>
            </div>
          </div>
        </header>

        <section className="mb-5 rounded-[2rem] border border-amber-300/20 bg-black/25 p-5 shadow-xl shadow-amber-950/10 sm:p-6">
          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
              Retention
            </p>
            <h2 className="mt-2 text-2xl font-black text-amber-50">
              {data.retentionDays} day operating window
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-100/60">
              Audit rows stay server-side and are read with the same protected admin credentials as the other operations dashboards.
            </p>
          </div>

          {data.events.length === 0 ? (
            <div className="rounded-[1.5rem] border border-amber-300/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100/80">
              No audit events have been recorded yet.
            </div>
          ) : (
            <div className="grid gap-3">
              {data.events.map((event) => (
                <AuditEventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
