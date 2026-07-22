import type { AdminRuntimeIdentityViewModel } from "@/lib/adminRuntimeIdentity";

export function RuntimeIdentityBanner({
  identity,
}: {
  identity: AdminRuntimeIdentityViewModel;
}) {
  const statusClassName =
    identity.statusTone === "ready"
      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
      : "border-rose-300/30 bg-rose-400/10 text-rose-100";

  return (
    <section
      aria-label="Admin runtime identity"
      className="mb-5 rounded-[2rem] border border-amber-300/20 bg-black/30 p-5 shadow-xl shadow-amber-950/10 sm:p-6"
      data-testid="admin-runtime-identity"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/75">
            Runtime Identity
          </p>
          <h2 className="mt-2 text-2xl font-black text-amber-50">
            {identity.servingHost}
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-100/65">
            {identity.hostKind} / {identity.databaseProviderLabel}
          </p>
        </div>

        <div className="lg:text-right">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClassName}`}
          >
            {identity.statusLabel}
          </span>
          <p className="mt-2 text-xs leading-5 text-amber-100/60">
            {identity.statusDetail}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {identity.fields.map((field) => (
          <div
            className="min-w-0 rounded-[1.25rem] border border-amber-300/15 bg-neutral-950/55 p-3"
            key={field.label}
          >
            <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300/65">
              {field.label}
            </dt>
            <dd
              className={`mt-1 break-words text-sm font-semibold text-amber-50 ${
                field.valueClassName ?? ""
              }`}
            >
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
