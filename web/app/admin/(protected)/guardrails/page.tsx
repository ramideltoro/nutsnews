import Link from "next/link";

import {
  type GuardrailMetric,
  getAdminCostGuardrailsDashboardData,
} from "@/lib/adminCostGuardrails";

export const metadata = {
  title: "Free-Tier Guardrails | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatNumber(value: number | null) {
  if (value === null) {
    return "Unknown";
  }

  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatValue(value: number | null, unit: string) {
  if (value === null) {
    return "Unknown";
  }

  if (unit === "hours") {
    const wholeHours = Math.floor(value);
    const minutes = Math.round((value - wholeHours) * 60);
    return minutes > 0 ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
  }

  if (unit === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: value > 0 && value < 1 ? 4 : 2,
      maximumFractionDigits: value > 0 && value < 1 ? 4 : 2,
    }).format(value);
  }

  if (unit === "GB") {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} GB`;
  }

  if (unit === "GB-Hrs") {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} GB-Hrs`;
  }

  if (unit === "ms") {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)} ms`;
  }

  return `${formatNumber(value)} ${unit}`;
}

function riskLabel(riskLevel: GuardrailMetric["riskLevel"]) {
  switch (riskLevel) {
    case "danger":
      return "Danger";
    case "watch":
      return "Watch";
    case "ok":
      return "OK";
    default:
      return "Unknown";
  }
}

function riskClass(riskLevel: GuardrailMetric["riskLevel"]) {
  switch (riskLevel) {
    case "danger":
      return "border-red-300/30 bg-red-400/10 text-red-100";
    case "watch":
      return "border-orange-300/30 bg-orange-400/10 text-orange-100";
    case "ok":
      return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
    default:
      return "border-amber-300/20 bg-black/30 text-amber-100/70";
  }
}

function forecastStatusLabel(status: GuardrailMetric["forecastStatus"]) {
  switch (status) {
    case "safe":
      return "Safe";
    case "approaching_limit":
      return "Approaching limit";
    case "projected_to_breach":
      return "Projected to breach";
    case "insufficient_trend_data":
      return "Insufficient trend data";
  }
}

function forecastStatusClass(status: GuardrailMetric["forecastStatus"]) {
  switch (status) {
    case "safe":
      return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
    case "approaching_limit":
      return "border-orange-300/30 bg-orange-400/10 text-orange-100";
    case "projected_to_breach":
      return "border-red-300/30 bg-red-400/10 text-red-100";
    case "insufficient_trend_data":
      return "border-amber-300/20 bg-black/30 text-amber-100/70";
  }
}

function RiskPill({ riskLevel }: { riskLevel: GuardrailMetric["riskLevel"] }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${riskClass(riskLevel)}`}
    >
      {riskLabel(riskLevel)}
    </span>
  );
}

function ForecastPill({ status }: { status: GuardrailMetric["forecastStatus"] }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${forecastStatusClass(status)}`}
    >
      {forecastStatusLabel(status)}
    </span>
  );
}

function MetricCard({ metric }: { metric: GuardrailMetric }) {
  const barWidth = metric.usagePercent === null ? 0 : Math.min(metric.usagePercent, 100);

  return (
    <article className="rounded-[1.75rem] border border-amber-300/20 bg-gradient-to-br from-black/45 via-neutral-950/85 to-amber-950/25 p-5 shadow-xl shadow-amber-950/20">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
            {metric.group}
          </p>
          <h2 className="mt-2 text-xl font-black text-amber-50">{metric.label}</h2>
        </div>
        <RiskPill riskLevel={metric.riskLevel} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/55">
            Current
          </p>
          <p className="mt-1 text-2xl font-black text-amber-50">
            {formatValue(metric.value, metric.unit)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/55">
            Limit
          </p>
          <p className="mt-1 text-2xl font-black text-amber-50">
            {formatValue(metric.limit, metric.unit)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/55">
            Forecast
          </p>
          <p className="mt-1 text-2xl font-black text-amber-50">
            {metric.forecastStatus === "insufficient_trend_data"
              ? "Insufficient trend data"
              : formatValue(metric.forecast30DayValue, metric.unit)}
          </p>
          <div className="mt-2">
            <ForecastPill status={metric.forecastStatus} />
          </div>
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-amber-950/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-300 to-red-300 shadow-[0_0_18px_rgba(251,191,36,0.35)]"
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <p className="mt-3 text-xs font-semibold text-amber-100/55">
        {metric.usagePercent === null
          ? "No hard quota configured for this metric yet."
          : `${metric.usagePercent}% of configured limit · warning at ${metric.warningThresholdPercent}% · danger at ${metric.dangerThresholdPercent}%.`}
      </p>
      <p className="mt-2 text-xs font-semibold text-amber-100/55">
        Forecast: {metric.forecastReason}
      </p>
      <p className="mt-4 text-sm leading-6 text-amber-100/70">{metric.description}</p>
      <div className="mt-4 rounded-2xl border border-amber-300/15 bg-black/25 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
          Mitigation
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-100/70">{metric.mitigation}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-amber-100/45">
          <span>Source: {metric.dataSource}</span>
          {metric.sourceUrl ? (
            <a
              href={metric.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-amber-300/20 px-2 py-1 font-bold text-amber-200/80 transition hover:border-amber-300/45 hover:text-amber-100"
            >
              {metric.sourceLabel ?? "Details"}
            </a>
          ) : null}
        </div>
        {metric.inputNames.length > 0 ? (
          <p className="mt-2 text-xs leading-5 text-amber-100/45">
            Inputs: {metric.inputNames.join(", ")}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function SummaryCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-[1.5rem] border border-amber-300/20 bg-black/30 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-amber-50">{value}</p>
      <p className="mt-1 text-xs leading-5 text-amber-100/55">{helper}</p>
    </div>
  );
}

export default async function GuardrailsPage() {
  const data = await getAdminCostGuardrailsDashboardData();

  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] px-4 py-6 text-amber-50 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.22),_transparent_32%),radial-gradient(circle_at_bottom_left,_rgba(251,191,36,0.14),_transparent_34%),linear-gradient(135deg,_#0a0a0a,_#171717_52%,_#451a03)]" />
      </div>

      <div className="mx-auto max-w-7xl">
        <header className="mb-5 rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-black/55 via-neutral-950/85 to-amber-950/25 p-5 shadow-2xl shadow-amber-950/30 backdrop-blur sm:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                href="/admin"
                className="mb-4 inline-flex rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100 transition hover:border-amber-300/50"
              >
                ← Admin
              </Link>
              <h1 className="text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">
                Free-Tier Guardrails
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/70">
                Forecast cost and quota pressure before free-tier limits are hit. Covers database growth, AI usage, Worker runs, email sends, Redis/KV, egress, and PageSpeed/API usage where data is available.
              </p>
            </div>

            <div className="rounded-[1.45rem] border border-amber-300/15 bg-black/30 p-4 text-left md:min-w-72">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/80">
                Overall risk
              </p>
              <div className="mt-3">
                <RiskPill riskLevel={data.overallRiskLevel} />
              </div>
              <p className="mt-3 text-xs leading-5 text-amber-100/55">
                Generated {new Date(data.generatedAt).toLocaleString("en-US")} · latest run {data.latestRunLabel}
              </p>
            </div>
          </div>
        </header>

        {!data.isConfigured ? (
          <section className="mb-5 rounded-[2rem] border border-red-300/25 bg-red-400/10 p-5 text-red-100">
            <h2 className="text-xl font-black">Guardrails are not configured</h2>
            <p className="mt-2 text-sm leading-6">{data.errorMessage}</p>
          </section>
        ) : null}

        <section className="mb-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <SummaryCard
            label="Worker runs, 24h"
            value={formatNumber(data.last24Hours.workerRuns)}
            helper={`${formatNumber(data.last24Hours.failedWorkerRuns)} failed runs.`}
          />
          <SummaryCard
            label="OpenAI cost, 30d"
            value={formatValue(data.last30Days.openAiCostUsd, "USD")}
            helper={`${formatNumber(data.last30Days.openAiCalls)} OpenAI calls.`}
          />
          <SummaryCard
            label="OpenAI tokens, 30d"
            value={formatNumber(data.last30Days.openAiTokens)}
            helper="Prompt plus completion tokens."
          />
          <SummaryCard
            label="Local AI calls, 30d"
            value={formatNumber(data.last30Days.localAiCalls)}
            helper="Free home-server/local AI calls."
          />
          <SummaryCard
            label="Email sends, 30d"
            value={formatNumber(data.last30Days.emailSends)}
            helper="Successful contact form deliveries."
          />
          <SummaryCard
            label="Warnings"
            value={formatNumber(data.warnings.length)}
            helper="Watch or danger guardrails."
          />
        </section>

        {data.warnings.length > 0 ? (
          <section className="mb-5 rounded-[2rem] border border-orange-300/25 bg-orange-400/10 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-100/80">
              Attention
            </p>
            <h2 className="mt-2 text-2xl font-black text-orange-50">
              Quota warnings before hard limits
            </h2>
            <ul className="mt-4 grid gap-3">
              {data.warnings.map((metric) => (
                <li key={metric.id} className="rounded-2xl border border-orange-300/20 bg-black/25 p-4 text-sm leading-6 text-orange-50/85">
                  <strong>{metric.label}:</strong> {metric.usagePercent ?? "unknown"}% of limit. {metric.mitigation}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          {data.metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </section>
      </div>
    </main>
  );
}
