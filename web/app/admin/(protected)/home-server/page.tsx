import type { ReactNode } from "react";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { formatAdminDateTime } from "@/lib/adminTime";
import {
  type HomeServerModel,
  type HomeServerServiceStatus,
  type HomeServerStats,
  getAdminHomeServerDashboardData,
} from "@/lib/adminHomeServer";

export const metadata = {
  title: "Home Server | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatBytes(value: number) {
  if (!value) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDuration(seconds: number) {
  if (!seconds) {
    return "0s";
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatDateTime(value: string | null | undefined) {
  return formatAdminDateTime(value ?? null, "Unknown");
}

function getServiceStatus(services: HomeServerServiceStatus[], name: string) {
  return services.find((service) => service.name === name) ?? {
    name,
    active: false,
    status: "unknown",
  };
}

function getToneForPercent(value: number, warningAt = 70, dangerAt = 90) {
  if (value >= dangerAt) {
    return "danger";
  }

  if (value >= warningAt) {
    return "warning";
  }

  return "good";
}

function DashboardSection({
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
      className="scroll-mt-6 rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20 sm:p-6"
    >
      <div className="mb-6">
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
  tone = "default",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "default" | "good" | "warning" | "danger";
}) {
  const toneClasses = {
    default: "from-black/45 via-neutral-950/85 to-amber-950/25",
    good: "from-black/45 via-neutral-950/85 to-emerald-950/20",
    warning: "from-black/45 via-neutral-950/85 to-orange-950/25",
    danger: "from-black/45 via-neutral-950/85 to-red-950/20",
  };

  return (
    <div
      className={`rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br ${toneClasses[tone]} p-5 shadow-xl shadow-amber-950/20`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
        {label}
      </p>
      <h3 className="mt-3 break-words text-3xl font-black text-amber-50">{value}</h3>
      <p className="mt-2 text-sm leading-6 text-amber-100/60">{helper}</p>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "watch" | "neutral" | "danger";
}) {
  const classes = {
    ok: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    watch: "border-orange-300/25 bg-orange-400/10 text-orange-100",
    neutral: "border-amber-300/20 bg-black/30 text-amber-100/70",
    danger: "border-red-300/25 bg-red-500/10 text-red-100",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${classes[tone]}`}
    >
      {label}
    </span>
  );
}

function QuickNav() {
  const links = [
    ["Overview", "#overview"],
    ["Resources", "#resources"],
    ["Services", "#services"],
    ["AI Runtime", "#ai-runtime"],
    ["Models", "#models"],
    ["Setup", "#setup"],
  ];

  return (
    <nav className="mb-5 rounded-[1.75rem] border border-amber-300/20 bg-black/30 p-3 shadow-xl shadow-amber-950/10">
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

function ServiceCard({ service }: { service: HomeServerServiceStatus }) {
  const tone = service.active ? "good" : service.status === "unknown" ? "warning" : "danger";

  return (
    <MetricCard
      label={service.name}
      value={service.status}
      helper={service.active ? "Systemd reports this service as active." : "Investigate this service on the home server."}
      tone={tone}
    />
  );
}

function OverviewSection({ stats }: { stats: HomeServerStats }) {
  return (
    <DashboardSection
      id="overview"
      eyebrow="Home Server"
      title="Instance Overview"
      description="Live server identity, uptime, operating system, and response status from the protected home-server stats endpoint."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Hostname"
          value={stats.server.hostname}
          helper={`${stats.server.platform} ${stats.server.arch} · kernel ${stats.server.kernel}`}
          tone="good"
        />
        <MetricCard
          label="Server Uptime"
          value={formatDuration(stats.server.uptimeSeconds)}
          helper="Time since the home server last booted."
        />
        <MetricCard
          label="Stats Latency"
          value={`${formatNumber(stats.generatedInMs)}ms`}
          helper={`Stats generated at ${formatDateTime(stats.timestamp)}.`}
        />
        <MetricCard
          label="Local AI Service"
          value={stats.ok ? "Healthy" : "Check"}
          helper={`Service process started at ${formatDateTime(stats.server.startedAt)}.`}
          tone={stats.ok ? "good" : "danger"}
        />
      </div>
    </DashboardSection>
  );
}

function ResourcesSection({ stats }: { stats: HomeServerStats }) {
  const memoryUsed = `${formatBytes(stats.memory.usedBytes)} / ${formatBytes(stats.memory.totalBytes)}`;
  const diskUsed = `${formatBytes(stats.disk.usedBytes)} / ${formatBytes(stats.disk.totalBytes)}`;

  return (
    <DashboardSection
      id="resources"
      eyebrow="Resources"
      title="CPU, Memory, and Disk"
      description="Use this section to spot pressure on the machine before it affects Ollama or Worker review latency."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="CPU Threads"
          value={formatNumber(stats.cpu.threads)}
          helper={stats.cpu.model}
        />
        <MetricCard
          label="1m Load"
          value={stats.cpu.loadAverage.oneMinute.toFixed(2)}
          helper={`${stats.cpu.loadAverage.normalizedOneMinutePercent}% of available CPU thread capacity.`}
          tone={getToneForPercent(stats.cpu.loadAverage.normalizedOneMinutePercent, 60, 85)}
        />
        <MetricCard
          label="Memory Used"
          value={`${stats.memory.usagePercent}%`}
          helper={`${memoryUsed} · ${formatBytes(stats.memory.availableBytes)} available.`}
          tone={getToneForPercent(stats.memory.usagePercent, 70, 90)}
        />
        <MetricCard
          label="Disk Used"
          value={`${stats.disk.usagePercent}%`}
          helper={`${diskUsed} on ${stats.disk.filesystem} mounted at ${stats.disk.mount}.`}
          tone={getToneForPercent(stats.disk.usagePercent, 75, 90)}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="5m Load"
          value={stats.cpu.loadAverage.fiveMinute.toFixed(2)}
          helper="Five-minute average system load."
        />
        <MetricCard
          label="15m Load"
          value={stats.cpu.loadAverage.fifteenMinute.toFixed(2)}
          helper="Fifteen-minute average system load."
        />
        <MetricCard
          label="Swap Used"
          value={formatBytes(stats.memory.swapUsedBytes)}
          helper={`${formatBytes(stats.memory.swapFreeBytes)} swap free from ${formatBytes(stats.memory.swapTotalBytes)} total.`}
          tone={stats.memory.swapUsedBytes > 0 ? "warning" : "good"}
        />
      </div>
    </DashboardSection>
  );
}

function ServicesSection({ stats }: { stats: HomeServerStats }) {
  const services = [
    getServiceStatus(stats.services, "ollama"),
    getServiceStatus(stats.services, "nutsnews-local-ai"),
    getServiceStatus(stats.services, "cloudflared"),
  ];

  return (
    <DashboardSection
      id="services"
      eyebrow="Systemd"
      title="Critical Services"
      description="These services must stay active for local AI reviews to work from Cloudflare Workers."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {services.map((service) => (
          <ServiceCard key={service.name} service={service} />
        ))}
      </div>
    </DashboardSection>
  );
}

function AiRuntimeSection({ stats }: { stats: HomeServerStats }) {
  return (
    <DashboardSection
      id="ai-runtime"
      eyebrow="Runtime"
      title="Local AI Runtime"
      description="Current local AI service and Ollama runtime configuration used by Worker shards."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Default Model"
          value={stats.localAi.defaultModel}
          helper="The Ollama model used when the Worker does not request a specific model."
          tone="good"
        />
        <MetricCard
          label="Ollama Status"
          value={stats.ollama.ok ? "Healthy" : "Check"}
          helper={`${stats.ollama.models.length} installed model${stats.ollama.models.length === 1 ? "" : "s"} reported by Ollama.`}
          tone={stats.ollama.ok ? "good" : "danger"}
        />
        <MetricCard
          label="Article Cap"
          value={formatNumber(stats.localAi.maxArticleChars)}
          helper="Maximum article text characters sent into the model prompt."
        />
        <MetricCard
          label="Model Output Cap"
          value={formatNumber(stats.localAi.numPredict)}
          helper={`num_ctx=${formatNumber(stats.localAi.numCtx)} · keep_alive=${stats.localAi.keepAlive}`}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Request Timeout"
          value={`${formatNumber(Math.round(stats.localAi.requestTimeoutMs / 1000))}s`}
          helper="Local service timeout for an Ollama review call."
        />
        <MetricCard
          label="Service Port"
          value={formatNumber(stats.localAi.port)}
          helper="The service listens on localhost and is exposed through Cloudflare Tunnel."
        />
        <MetricCard
          label="Node Process"
          value={stats.process.nodeVersion}
          helper={`PID ${formatNumber(stats.process.pid)} · process uptime ${formatDuration(stats.process.uptimeSeconds)}.`}
        />
      </div>
    </DashboardSection>
  );
}

function ModelsSection({ models }: { models: HomeServerModel[] }) {
  return (
    <DashboardSection
      id="models"
      eyebrow="Ollama"
      title="Installed Models"
      description="Models available on the home server according to Ollama."
    >
      {models.length === 0 ? (
        <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-5 text-sm text-amber-100/60">
          Ollama did not return any installed models. Check the ollama service on the home server.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[1.5rem] border border-amber-300/15">
          <table className="min-w-full divide-y divide-amber-300/10 text-sm">
            <thead className="bg-black/30 text-left text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/75">
              <tr>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-300/10 bg-black/15 text-amber-100/75">
              {models.map((model) => (
                <tr key={model.name}>
                  <td className="px-4 py-3 font-semibold text-amber-50">{model.name}</td>
                  <td className="px-4 py-3">{formatBytes(model.size)}</td>
                  <td className="px-4 py-3">{formatDateTime(model.modifiedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardSection>
  );
}

function SetupSection({ isConfigured }: { isConfigured: boolean }) {
  return (
    <DashboardSection
      id="setup"
      eyebrow="Setup"
      title="Required Environment Variables"
      description="The admin dashboard fetches stats server-side so the browser never sees the home-server API key."
    >
      <div className="rounded-[1.5rem] border border-amber-300/15 bg-black/25 p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusPill label={isConfigured ? "Configured" : "Needs Setup"} tone={isConfigured ? "ok" : "watch"} />
          <StatusPill label="Server-side only" tone="neutral" />
        </div>

        <pre className="overflow-x-auto rounded-[1.25rem] border border-amber-300/15 bg-black/40 p-4 text-xs leading-6 text-amber-100/80">
{`HOME_SERVER_STATS_URL=https://ai.nutsnews.com/stats
HOME_SERVER_STATS_API_KEY=<same value as LOCAL_AI_API_KEY on the home server>`}
        </pre>
      </div>
    </DashboardSection>
  );
}

function ErrorPanel({ message, isConfigured }: { message: string; isConfigured: boolean }) {
  return (
    <DashboardSection
      id="overview"
      eyebrow="Home Server"
      title="Stats Not Available"
      description="The admin dashboard could not load live stats from the protected home-server endpoint."
    >
      <div className="rounded-[1.5rem] border border-red-300/20 bg-red-500/10 p-5 text-sm leading-6 text-red-100">
        {message}
      </div>
      <div className="mt-4">
        <SetupSection isConfigured={isConfigured} />
      </div>
    </DashboardSection>
  );
}

export default async function HomeServerPage() {
  const session = await auth();
  const data = await getAdminHomeServerDashboardData();
  const stats = data.stats;

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
              <Link
                href="/admin"
                className="mb-4 inline-flex rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100 transition hover:border-amber-300/50 hover:bg-amber-400/15"
              >
                ← Admin Home
              </Link>

              <h1 className="text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">
                Home Server Dashboard
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                Live instance stats for the home server that runs NutsNews local AI through Ollama, qwen, and Cloudflare Tunnel.
              </p>
            </div>

            <div className="rounded-[1.45rem] border border-amber-300/15 bg-black/30 p-4 text-left md:min-w-72">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/80">
                Signed in as
              </p>
              <p className="mt-2 break-all text-sm font-semibold text-amber-50">
                {session?.user?.email}
              </p>
              <p className="mt-2 text-xs text-amber-100/55">
                Generated {formatDateTime(data.generatedAt)}
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

        <div className="space-y-5">
          {stats ? (
            <>
              <OverviewSection stats={stats} />
              <ResourcesSection stats={stats} />
              <ServicesSection stats={stats} />
              <AiRuntimeSection stats={stats} />
              <ModelsSection models={stats.ollama.models} />
              <SetupSection isConfigured={data.isConfigured} />
            </>
          ) : (
            <ErrorPanel
              message={data.errorMessage ?? "Home server stats are not available."}
              isConfigured={data.isConfigured}
            />
          )}
        </div>
      </div>
    </main>
  );
}
