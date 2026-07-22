import type { ReactNode } from "react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { isAllowedAdminEmail } from "@/lib/adminAuth";
import {
  formatFailoverTarget,
  formatFailoverTimestamp,
  getAdminFailoverDashboardData,
  performAdminFailoverAction,
  type AdminFailoverDashboardData,
  type FailoverDashboardTone,
  type FailoverTimelineRow,
} from "@/lib/adminFailover";
import type {
  FailoverManualAction,
  FailoverManualAuditEvent,
  FailoverLiveOriginHostReadiness,
  FailoverStatus,
} from "@/lib/failoverStatusContract";
import { FAILOVER_MANUAL_ACTION_CONFIRMATIONS } from "@/lib/failoverStatusContract";

export const metadata = {
  title: "Failover | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FailoverPageProps = {
  searchParams?: Promise<{
    updated?: string | string[];
    error?: string | string[];
  }>;
};

function getSingleSearchValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function failoverManualAction(formData: FormData) {
  "use server";

  const session = await auth();
  const actorEmail = session?.user?.email;

  if (!actorEmail) {
    redirect("/admin/login");
  }

  if (!isAllowedAdminEmail(actorEmail)) {
    redirect("/admin/access-denied");
  }

  const result = await performAdminFailoverAction({
    actorEmail,
    action: String(formData.get("action") ?? ""),
    confirmation: String(formData.get("confirmation") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    expected: {
      activeDnsTarget: String(formData.get("activeDnsTarget") ?? ""),
      actualApexDnsTarget: String(formData.get("actualApexDnsTarget") ?? ""),
      actualWwwDnsTarget: String(formData.get("actualWwwDnsTarget") ?? ""),
      statusGeneratedAt: String(formData.get("statusGeneratedAt") ?? ""),
    },
  });

  revalidatePath("/admin/failover");
  revalidatePath("/admin/audit");

  if (!result.ok) {
    redirect(`/admin/failover?error=${encodeURIComponent(result.message)}`);
  }

  redirect(`/admin/failover?updated=${encodeURIComponent(result.message)}`);
}

const toneClasses: Record<FailoverDashboardTone, string> = {
  ok: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  watch: "border-orange-300/25 bg-orange-400/10 text-orange-100",
  danger: "border-rose-300/25 bg-rose-400/10 text-rose-100",
  neutral: "border-amber-300/20 bg-black/30 text-amber-100/70",
};

const cardToneClasses: Record<FailoverDashboardTone, string> = {
  ok: "border-emerald-300/25 from-emerald-950/20 via-neutral-950/85 to-black/50",
  watch: "border-orange-300/25 from-orange-950/20 via-neutral-950/85 to-black/50",
  danger: "border-rose-300/25 from-rose-950/20 via-neutral-950/85 to-black/50",
  neutral: "border-amber-300/20 from-black/45 via-neutral-950/85 to-amber-950/20",
};

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: FailoverDashboardTone;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/20 p-5 shadow-xl shadow-amber-950/20 sm:p-6"
    >
      <div className="mb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-black text-amber-50">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-100/60">
          {description}
        </p>
      </div>

      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: FailoverDashboardTone;
}) {
  return (
    <article
      className={`rounded-[1.5rem] border bg-gradient-to-br p-5 shadow-xl shadow-black/20 ${cardToneClasses[tone]}`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
        {label}
      </p>
      <h3 className="mt-3 break-words text-3xl font-black text-amber-50">{value}</h3>
      <p className="mt-2 text-sm leading-6 text-amber-100/60">{helper}</p>
    </article>
  );
}

function QuickNav() {
  const links = [
    ["Overview", "#overview"],
    ["Controls", "#controls"],
    ["DNS", "#dns"],
    ["Live Origin", "#live-origin"],
    ["VPS Health", "#vps-health"],
    ["History", "#history"],
    ["Links", "#links"],
  ];

  return (
    <nav className="mb-5 rounded-[1.5rem] border border-amber-300/20 bg-black/30 p-3 shadow-xl shadow-amber-950/10">
      <div className="flex flex-wrap gap-2">
        {links.map(([label, href]) => (
          <a
            key={href}
            href={href}
            className="rounded-full border border-amber-300/20 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/10"
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function targetTone(value: string): FailoverDashboardTone {
  if (value === "vps") {
    return "ok";
  }

  if (value === "vercel") {
    return "watch";
  }

  return "neutral";
}

function dnsDriftTone(status: FailoverStatus) {
  if (
    status.actualApexDnsTarget !== status.desiredDnsTarget ||
    status.actualWwwDnsTarget !== status.desiredDnsTarget
  ) {
    return "danger";
  }

  return "ok";
}

function liveOriginTone(origin: FailoverLiveOriginHostReadiness["origin"]): FailoverDashboardTone {
  if (origin === "vps") {
    return "ok";
  }

  if (origin === "vercel") {
    return "watch";
  }

  if (origin === "unreachable") {
    return "danger";
  }

  return "neutral";
}

function formatStatus(value: number | string | null) {
  if (value === null) {
    return "n/a";
  }

  return String(value);
}

function readinessDetail(host: FailoverLiveOriginHostReadiness) {
  const status = formatStatus(host.status);
  const latency = typeof host.latencyMs === "number" ? `${host.latencyMs}ms` : "no latency";

  return `HTTP ${status}; ${latency}; ${host.cacheState} cache; ${host.readinessCode}.`;
}

function actionLabel(action: FailoverManualAction) {
  if (action === "force_dns_to_vercel") {
    return "Force DNS to Vercel";
  }

  if (action === "force_dns_to_vps") {
    return "Force DNS to VPS";
  }

  if (action === "enable_manual_lock") {
    return "Enable Manual Lock";
  }

  return "Disable Manual Lock";
}

function actionTone(action: FailoverManualAction): FailoverDashboardTone {
  if (action === "force_dns_to_vercel" || action === "enable_manual_lock") {
    return "watch";
  }

  return "ok";
}

function auditResultTone(result: FailoverManualAuditEvent["result"]): FailoverDashboardTone {
  if (result === "success") {
    return "ok";
  }

  if (result === "refused" || result === "duplicate") {
    return "watch";
  }

  return "danger";
}

function FlashMessages({
  updated,
  error,
}: {
  updated?: string;
  error?: string;
}) {
  if (!updated && !error) {
    return null;
  }

  return (
    <div className="mb-5 grid gap-3">
      {updated ? (
        <div className="rounded-[1.25rem] border border-emerald-300/25 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">
          {updated}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[1.25rem] border border-rose-300/25 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function HiddenExpectedStatus({ status }: { status: FailoverStatus }) {
  return (
    <>
      <input type="hidden" name="activeDnsTarget" value={status.activeDnsTarget} />
      <input type="hidden" name="actualApexDnsTarget" value={status.actualApexDnsTarget} />
      <input type="hidden" name="actualWwwDnsTarget" value={status.actualWwwDnsTarget} />
      <input type="hidden" name="statusGeneratedAt" value={status.generatedAt} />
    </>
  );
}

function ActionCard({
  status,
  action,
  title,
  detail,
  disabled,
}: {
  status: FailoverStatus;
  action: FailoverManualAction;
  title: string;
  detail: string;
  disabled: boolean;
}) {
  const confirmation = FAILOVER_MANUAL_ACTION_CONFIRMATIONS[action];

  return (
    <form
      action={failoverManualAction}
      className={`grid gap-3 rounded-[1.5rem] border bg-black/20 p-4 ${disabled ? "border-amber-300/10 opacity-65" : "border-amber-300/20"}`}
    >
      <input type="hidden" name="action" value={action} />
      <HiddenExpectedStatus status={status} />

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label={actionLabel(action)} tone={actionTone(action)} />
        {disabled ? <StatusPill label="Unavailable" tone="neutral" /> : null}
      </div>

      <div>
        <h3 className="text-base font-black text-amber-50">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-amber-100/60">{detail}</p>
      </div>

      <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-300/70">
        Confirmation
        <input
          name="confirmation"
          autoComplete="off"
          placeholder={confirmation}
          disabled={disabled}
          className="rounded-[1rem] border border-amber-300/15 bg-black/35 px-3 py-2 text-sm normal-case tracking-normal text-amber-50 placeholder:text-amber-100/30 disabled:cursor-not-allowed"
        />
      </label>

      <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-300/70">
        Reason
        <textarea
          name="reason"
          rows={3}
          disabled={disabled}
          placeholder="Incident ticket, maintenance window, or operator context"
          className="resize-none rounded-[1rem] border border-amber-300/15 bg-black/35 px-3 py-2 text-sm normal-case tracking-normal text-amber-50 placeholder:text-amber-100/30 disabled:cursor-not-allowed"
        />
      </label>

      <button
        type="submit"
        disabled={disabled}
        className="rounded-full border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:border-amber-300/10 disabled:bg-black/20 disabled:text-amber-100/35"
      >
        {title}
      </button>
    </form>
  );
}

function ControlsSection({ data }: { data: AdminFailoverDashboardData }) {
  const status = data.status;

  return (
    <Section
      id="controls"
      eyebrow="Guarded Actions"
      title="Manual Failover Controls"
      description="Actions are submitted to the protected failover controller. The controller re-checks Cloudflare DNS before any DNS write."
    >
      {!data.actionsConfigured ? (
        <div className="mb-4 rounded-[1.25rem] border border-orange-300/20 bg-orange-400/10 p-4 text-sm leading-6 text-orange-100">
          Missing NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET for manual failover controls.
        </div>
      ) : null}

      {!status ? (
        <div className="rounded-[1.5rem] border border-rose-300/25 bg-rose-500/10 p-5 text-sm leading-6 text-rose-100">
          Manual controls require a fresh controller status snapshot.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <ActionCard
            status={status}
            action="enable_manual_lock"
            title="Enable Manual Lock"
            detail="Stops automatic failback from changing the desired target while health checks continue to record VPS readiness."
            disabled={!data.actionsConfigured || status.manualLock}
          />
          <ActionCard
            status={status}
            action="disable_manual_lock"
            title="Disable Manual Lock"
            detail="Allows automatic failback decisions to resume on the next health-check cycle."
            disabled={!data.actionsConfigured || !status.manualLock}
          />
          <ActionCard
            status={status}
            action="force_dns_to_vercel"
            title="Force DNS to Vercel"
            detail="Writes the configured apex and www Cloudflare records to the Vercel fallback target after fresh DNS validation."
            disabled={!data.actionsConfigured || status.stale}
          />
          <ActionCard
            status={status}
            action="force_dns_to_vps"
            title="Force DNS to VPS"
            detail="Writes the configured apex and www Cloudflare records back to the VPS primary target after fresh DNS validation."
            disabled={!data.actionsConfigured || status.stale}
          />
        </div>
      )}
    </Section>
  );
}

function Overview({ data }: { data: AdminFailoverDashboardData }) {
  const status = data.status;

  if (!status) {
    return (
      <Section
        id="overview"
        eyebrow="Controller"
        title="Failover Status Unavailable"
        description="The admin server could not load the protected failover controller status endpoint."
      >
        <div className="rounded-[1.5rem] border border-rose-300/25 bg-rose-500/10 p-5 text-sm leading-6 text-rose-100">
          {data.errorMessage ?? "Failover status is unavailable."}
        </div>
      </Section>
    );
  }

  return (
    <Section
      id="overview"
      eyebrow="Controller"
      title="Current Serving Target"
      description="Current controller state, active DNS target, and status freshness from the protected failover status contract."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active DNS Target"
          value={formatFailoverTarget(status.activeDnsTarget)}
          helper={`Desired target is ${formatFailoverTarget(status.desiredDnsTarget)}.`}
          tone={targetTone(status.activeDnsTarget)}
        />
        <MetricCard
          label="Controller State"
          value={status.controllerState.replaceAll("_", " ")}
          helper={`Generated ${data.statusAgeLabel}; next check ${formatFailoverTimestamp(status.nextCheckDueAt)}.`}
          tone={data.overallTone}
        />
        <MetricCard
          label="DNS Readback"
          value={dnsDriftTone(status) === "ok" ? "In sync" : "Drift"}
          helper={`Apex ${formatFailoverTarget(status.actualApexDnsTarget)}; www ${formatFailoverTarget(status.actualWwwDnsTarget)}.`}
          tone={dnsDriftTone(status)}
        />
        <MetricCard
          label="Manual Lock"
          value={status.manualLock ? "Enabled" : "Off"}
          helper={status.manualLock ? "Automatic failback is disabled." : "Automatic failback can proceed when health and DNS gates allow it."}
          tone={status.manualLock ? "watch" : "ok"}
        />
      </div>
    </Section>
  );
}

function DnsSection({ status }: { status: FailoverStatus }) {
  const rows = [
    {
      host: "nutsnews.com",
      actual: status.actualApexDnsTarget,
      desired: status.desiredDnsTarget,
      observed: status.liveOriginReadiness.apex.origin,
    },
    {
      host: "www.nutsnews.com",
      actual: status.actualWwwDnsTarget,
      desired: status.desiredDnsTarget,
      observed: status.liveOriginReadiness.www.origin,
    },
  ];

  return (
    <Section
      id="dns"
      eyebrow="Cloudflare DNS"
      title="Apex and WWW Targets"
      description="Cloudflare DNS readback is kept separate from desired controller state and live production readiness observations."
    >
      <div className="overflow-x-auto rounded-[1.5rem] border border-amber-300/15">
        <table className="min-w-full divide-y divide-amber-300/10 text-sm">
          <thead className="bg-black/30 text-left text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/75">
            <tr>
              <th className="px-4 py-3">Hostname</th>
              <th className="px-4 py-3">Actual DNS</th>
              <th className="px-4 py-3">Desired</th>
              <th className="px-4 py-3">Observed Origin</th>
              <th className="px-4 py-3">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-300/10 bg-black/15 text-amber-100/75">
            {rows.map((row) => {
              const inSync = row.actual === row.desired && row.observed === row.actual;

              return (
                <tr key={row.host}>
                  <td className="px-4 py-4 font-semibold text-amber-50">{row.host}</td>
                  <td className="px-4 py-4">{formatFailoverTarget(row.actual)}</td>
                  <td className="px-4 py-4">{formatFailoverTarget(row.desired)}</td>
                  <td className="px-4 py-4">{formatFailoverTarget(row.observed)}</td>
                  <td className="px-4 py-4">
                    <StatusPill label={inSync ? "In sync" : "Check"} tone={inSync ? "ok" : "danger"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function LiveOriginSection({ status }: { status: FailoverStatus }) {
  const hosts = [
    status.liveOriginReadiness.apex,
    status.liveOriginReadiness.www,
  ];

  return (
    <Section
      id="live-origin"
      eyebrow="Production Readiness"
      title="Observed Live Origin"
      description="Readiness checks report what production actually served after DNS and CDN propagation."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusPill label={status.liveOriginReadiness.dnsState.replaceAll("_", " ")} tone={status.liveOriginReadiness.dnsState === "in_sync" ? "ok" : status.liveOriginReadiness.dnsState === "mismatch" || status.liveOriginReadiness.dnsState === "unreachable" ? "danger" : "watch"} />
        <StatusPill label={`Checked ${formatFailoverTimestamp(status.liveOriginReadiness.checkedAt)}`} tone="neutral" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {hosts.map((host) => (
          <MetricCard
            key={host.hostname}
            label={host.hostname}
            value={formatFailoverTarget(host.origin)}
            helper={readinessDetail(host)}
            tone={liveOriginTone(host.origin)}
          />
        ))}
      </div>
    </Section>
  );
}

function VpsHealthSection({ status }: { status: FailoverStatus }) {
  return (
    <Section
      id="vps-health"
      eyebrow="VPS Readiness"
      title="Latest VPS Health Check"
      description="The controller counts consecutive readiness failures before changing desired DNS target."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Reachability"
          value={status.lastVpsReachable ? "Reachable" : "Unreachable"}
          helper={`Health result ${status.lastHealthResult}.`}
          tone={status.lastVpsReachable ? "ok" : "danger"}
        />
        <MetricCard
          label="HTTP Status"
          value={formatStatus(status.lastVpsStatus)}
          helper={`Last check ${formatFailoverTimestamp(status.lastVpsCheckAt)}.`}
          tone={status.lastVpsReachable ? "ok" : "watch"}
        />
        <MetricCard
          label="Latency"
          value={typeof status.lastVpsLatencyMs === "number" ? `${status.lastVpsLatencyMs}ms` : "n/a"}
          helper="Readiness request latency from the controller."
          tone={status.lastVpsLatencyMs === null ? "watch" : "ok"}
        />
        <MetricCard
          label="Failure Streak"
          value={`${status.consecutiveVpsFailures}/${status.failureThreshold}`}
          helper="Failover target changes after the configured threshold."
          tone={status.consecutiveVpsFailures >= status.failureThreshold ? "danger" : status.consecutiveVpsFailures > 0 ? "watch" : "ok"}
        />
      </div>
    </Section>
  );
}

function TimelineList({
  title,
  rows,
}: {
  title: string;
  rows: FailoverTimelineRow[];
}) {
  return (
    <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/20">
      <div className="border-b border-amber-300/10 px-4 py-3">
        <h3 className="text-sm font-black text-amber-50">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-sm leading-6 text-amber-100/60">
          No status snapshot rows are available.
        </p>
      ) : (
        <ul className="divide-y divide-amber-300/10">
          {rows.map((row) => (
            <li key={row.id} className="grid gap-3 px-4 py-4 text-sm text-amber-100/75 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <StatusPill label={row.value} tone={row.tone} />
                  <span className="font-mono text-[11px] text-amber-100/50">
                    {formatFailoverTimestamp(row.timestamp)}
                  </span>
                </div>
                <p className="font-bold text-amber-50">{row.title}</p>
                <p className="mt-1 text-xs leading-5 text-amber-100/60">{row.detail}</p>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber-100/45">
                {row.source}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AuditTrailList({ data }: { data: AdminFailoverDashboardData }) {
  return (
    <div className="mt-4 rounded-[1.5rem] border border-amber-300/15 bg-black/20">
      <div className="border-b border-amber-300/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-black text-amber-50">Manual Action Audit</h3>
          <StatusPill label={data.auditAvailable ? "Loaded" : "Unavailable"} tone={data.auditAvailable ? "ok" : "watch"} />
        </div>
      </div>
      {data.auditEvents.length === 0 ? (
        <p className="px-4 py-5 text-sm leading-6 text-amber-100/60">
          {data.auditMessage}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-amber-300/10 text-sm">
            <thead className="bg-black/30 text-left text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/75">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-300/10 bg-black/15 text-amber-100/75">
              {data.auditEvents.map((event) => (
                <tr key={event.id}>
                  <td className="px-4 py-4 font-mono text-xs text-amber-100/55">
                    {formatFailoverTimestamp(event.createdAt)}
                  </td>
                  <td className="px-4 py-4 font-semibold text-amber-50">{event.actor}</td>
                  <td className="px-4 py-4">{actionLabel(event.action)}</td>
                  <td className="px-4 py-4">
                    {formatFailoverTarget(event.previousTarget)} to {formatFailoverTarget(event.newTarget)}
                  </td>
                  <td className="px-4 py-4">
                    <StatusPill label={event.result} tone={auditResultTone(event.result)} />
                  </td>
                  <td className="px-4 py-4">
                    <p className="max-w-md text-xs leading-5 text-amber-100/65">{event.reason}</p>
                    <p className="mt-1 max-w-md text-[11px] leading-5 text-amber-100/45">{event.message}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HistorySection({ data }: { data: AdminFailoverDashboardData }) {
  return (
    <Section
      id="history"
      eyebrow="History"
      title="Recent Health Checks and DNS Changes"
      description="The dashboard renders current status immediately and leaves a clear state when metrics history is not available."
    >
      {!data.historyAvailable ? (
        <div className="mb-4 rounded-[1.25rem] border border-orange-300/20 bg-orange-400/10 p-4 text-sm leading-6 text-orange-100">
          {data.historyMessage}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <TimelineList title="Recent Health Checks" rows={data.recentHealthChecks} />
        <TimelineList title="Recent DNS Changes" rows={data.recentDnsChanges} />
      </div>

      <AuditTrailList data={data} />
    </Section>
  );
}

function LinksSection({ data }: { data: AdminFailoverDashboardData }) {
  return (
    <Section
      id="links"
      eyebrow="Operator Links"
      title="Runbook and External Dashboards"
      description="Server configuration controls which external operator destinations appear here."
    >
      {data.links.length === 0 ? (
        <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-5 text-sm leading-6 text-amber-100/60">
          No operator links are configured.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[1.5rem] border border-amber-300/20 bg-black/25 p-5 transition hover:border-amber-300/50 hover:bg-amber-400/10"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
                {link.label}
              </p>
              <p className="mt-3 text-sm leading-6 text-amber-100/65">{link.helper}</p>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

function SetupSection({ data }: { data: AdminFailoverDashboardData }) {
  return (
    <Section
      id="setup"
      eyebrow="Setup"
      title="Server-Side Configuration"
      description="The admin route signs controller requests on the server. No status HMAC secret is rendered to the browser."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <StatusPill label={data.isConfigured ? "Configured" : "Needs setup"} tone={data.isConfigured ? "ok" : "watch"} />
        <StatusPill label={data.actionsConfigured ? "Actions configured" : "Actions locked"} tone={data.actionsConfigured ? "ok" : "watch"} />
        <StatusPill label={data.controllerReachable ? "Controller reachable" : "Controller unavailable"} tone={data.controllerReachable ? "ok" : "danger"} />
      </div>
      <pre className="overflow-x-auto rounded-[1.25rem] border border-amber-300/15 bg-black/40 p-4 text-xs leading-6 text-amber-100/80">
{`NUTSNEWS_FAILOVER_CONTROLLER_STATUS_URL=https://nutsnews-controller.nutsnews.workers.dev/status?mode=dashboard
NUTSNEWS_FAILOVER_CONTROLLER_ACTION_URL=https://nutsnews-controller.nutsnews.workers.dev/actions
NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET=<shared controller status secret>
NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET=<shared controller action secret>
NUTSNEWS_FAILOVER_RUNBOOK_URL=<optional failover runbook URL>
NUTSNEWS_FAILOVER_CLOUDFLARE_DASHBOARD_URL=<optional Cloudflare DNS page>`}
      </pre>
    </Section>
  );
}

export default async function AdminFailoverPage({ searchParams }: FailoverPageProps) {
  const session = await auth();
  const data = await getAdminFailoverDashboardData();
  const status = data.status;
  const params = await searchParams;
  const updated = getSingleSearchValue(params?.updated);
  const error = getSingleSearchValue(params?.error);

  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] px-4 py-6 text-amber-50 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,_#0a0a0a,_#171717_56%,_#1f2937)]" />
      </div>

      <div className="mx-auto max-w-7xl">
        <header className="mb-5 rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/55 via-neutral-950/85 to-slate-950/50 p-5 shadow-2xl shadow-black/30 sm:p-7">
          <div className="grid gap-5 lg:grid-cols-[1fr_21rem] lg:items-end">
            <div>
              <Link
                href="/admin"
                className="mb-4 inline-flex rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/15"
              >
                Admin Home
              </Link>

              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300/80">
                Failover Visibility
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">
                DNS Failover Dashboard
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                Active target, Cloudflare DNS readback, observed production origin, VPS readiness, and latest DNS state from the failover controller.
              </p>
            </div>

            <div className="rounded-[1.45rem] border border-amber-300/15 bg-black/30 p-4 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill label={data.overallLabel} tone={data.overallTone} />
                <StatusPill label={data.statusAgeLabel} tone={data.statusAgeSeconds !== null && data.statusAgeSeconds > 60 ? "danger" : "neutral"} />
              </div>
              <p className="mt-3 break-all text-sm font-semibold text-amber-50">
                {session?.user?.email ?? "Admin"}
              </p>
              <p className="mt-2 text-xs leading-5 text-amber-100/55">
                Fetched {formatFailoverTimestamp(data.fetchedAt)}.
              </p>

              <form
                className="mt-4"
                action={async () => {
                  "use server";

                  await signOut({
                    redirectTo: "/",
                  });
                }}
              >
                <button
                  type="submit"
                  className="w-full rounded-full border border-amber-300/25 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/10"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>

        <QuickNav />
        <FlashMessages updated={updated} error={error} />

        <div className="space-y-5">
          <Overview data={data} />
          <ControlsSection data={data} />

          {status ? (
            <>
              <DnsSection status={status} />
              <LiveOriginSection status={status} />
              <VpsHealthSection status={status} />
            </>
          ) : null}

          <HistorySection data={data} />
          <LinksSection data={data} />
          <SetupSection data={data} />
        </div>
      </div>
    </main>
  );
}
