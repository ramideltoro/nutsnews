import Link from "next/link";

import {
  getAdminProductionReadinessDashboardData,
  type ProductionReadinessSignal,
  type ProductionReadinessStatus,
} from "@/lib/adminProductionReadiness";
import { formatAdminDateTime } from "@/lib/adminTime";

export const metadata = {
  title: "Production Readiness | NutsNews Admin",
};

const statusStyles: Record<ProductionReadinessStatus, string> = {
  green: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  yellow: "border-amber-300/25 bg-amber-400/10 text-amber-100",
  red: "border-rose-300/25 bg-rose-400/10 text-rose-100",
};

const cardStyles: Record<ProductionReadinessStatus, string> = {
  green: "border-emerald-300/25 from-emerald-950/20 via-neutral-950/85 to-black/50",
  yellow: "border-amber-300/25 from-amber-950/25 via-neutral-950/85 to-black/50",
  red: "border-rose-300/25 from-rose-950/25 via-neutral-950/85 to-black/50",
};

function StatusPill({
  status,
  label,
}: {
  status: ProductionReadinessStatus;
  label: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusStyles[status]}`}
    >
      {label}
    </span>
  );
}

function SignalCard({ signal }: { signal: ProductionReadinessSignal }) {
  return (
    <article
      className={`rounded-[1.5rem] border bg-gradient-to-br p-5 shadow-xl shadow-black/20 ${cardStyles[signal.status]}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
            {signal.title}
          </p>
          <h2 className="mt-2 text-2xl font-black text-amber-50">
            {signal.value}
          </h2>
        </div>
        <StatusPill status={signal.status} label={signal.statusLabel} />
      </div>

      <p className="mt-4 text-sm leading-6 text-amber-100/70">
        {signal.detail}
      </p>

      {signal.workflows?.length ? (
        <div className="mt-4 overflow-hidden rounded-[1rem] border border-amber-300/15 bg-black/20">
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-amber-300/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/75 sm:grid-cols-[1fr_8rem_9rem_auto]">
            <span>Workflow</span>
            <span className="text-right sm:text-left">State</span>
            <span className="hidden sm:block">Updated</span>
            <span className="hidden text-right sm:block">Run</span>
          </div>
          <ul className="divide-y divide-amber-300/10">
            {signal.workflows.map((workflow) => (
              <li
                key={workflow.name}
                className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-xs text-amber-100/75 sm:grid-cols-[1fr_8rem_9rem_auto] sm:items-center"
              >
                <div>
                  <p className="font-bold text-amber-50">{workflow.name}</p>
                  <p className="mt-1 text-[11px] leading-4 text-amber-100/55">
                    {workflow.detail}
                  </p>
                </div>
                <div className="text-right sm:text-left">
                  <StatusPill status={workflow.status} label={workflow.statusLabel} />
                  <p className="mt-1 text-[11px] text-amber-100/50">
                    {workflow.githubStatus} / {workflow.conclusion}
                  </p>
                </div>
                <p className="hidden text-[11px] leading-4 text-amber-100/55 sm:block">
                  {formatAdminDateTime(workflow.updatedAt, "Unknown")}
                </p>
                <Link
                  href={workflow.href}
                  className="col-span-2 text-right text-[11px] font-black uppercase tracking-[0.12em] text-amber-200 underline-offset-4 transition hover:text-amber-50 hover:underline sm:col-span-1"
                >
                  {workflow.linkLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 rounded-[1rem] border border-amber-300/15 bg-black/25 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
          Next step
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-100/75">
          {signal.nextStep}
        </p>
      </div>

      <Link
        href={signal.href}
        className="mt-4 inline-flex rounded-full border border-amber-300/25 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/10"
      >
        {signal.linkLabel}
      </Link>
    </article>
  );
}

export default async function ProductionReadinessPage() {
  const data = await getAdminProductionReadinessDashboardData();

  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] px-4 py-6 text-amber-50 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.22),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.14),_transparent_34%),linear-gradient(135deg,_#0a0a0a,_#171717_52%,_#451a03)]" />
      </div>

      <div className="mx-auto max-w-7xl">
        <header className="mb-5 rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/55 via-neutral-950/85 to-amber-950/25 p-5 shadow-2xl shadow-amber-950/30 sm:p-7">
          <Link
            href="/admin"
            className="mb-4 inline-flex rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100 transition hover:border-amber-300/50"
          >
            ← Admin
          </Link>

          <div className="grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300/80">
                Ship/Promote Check
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">
                Production Readiness
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                A dense scorecard for public API readiness, Worker freshness,
                database growth, translations, images, backups, and CI. Red
                means stop, yellow means verify the linked system, and green
                means that signal is ready.
              </p>
            </div>

            <div className="rounded-[1.45rem] border border-amber-300/15 bg-black/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/80">
                  Overall
                </p>
                <StatusPill status={data.overallStatus} label={data.overallLabel} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-[1rem] border border-emerald-300/15 bg-emerald-400/10 p-3">
                  <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100/70">
                    Green
                  </dt>
                  <dd className="mt-1 text-2xl font-black text-emerald-100">
                    {data.summary.green}
                  </dd>
                </div>
                <div className="rounded-[1rem] border border-amber-300/15 bg-amber-400/10 p-3">
                  <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-100/70">
                    Yellow
                  </dt>
                  <dd className="mt-1 text-2xl font-black text-amber-100">
                    {data.summary.yellow}
                  </dd>
                </div>
                <div className="rounded-[1rem] border border-rose-300/15 bg-rose-400/10 p-3">
                  <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-rose-100/70">
                    Red
                  </dt>
                  <dd className="mt-1 text-2xl font-black text-rose-100">
                    {data.summary.red}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-5 text-amber-100/60">
                Generated {formatAdminDateTime(data.generatedAt, "Unknown")}.
              </p>
            </div>
          </div>
        </header>

        {data.errorMessage ? (
          <section className="mb-5 rounded-[1.5rem] border border-amber-300/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
            {data.errorMessage}
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          {data.signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </section>
      </div>
    </main>
  );
}
