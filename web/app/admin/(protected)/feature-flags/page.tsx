import { getRuntimeFeatureFlags } from "@/lib/runtimeFeatureFlags";

export const metadata = {
  title: "Runtime feature flags | NutsNews Admin",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FeatureFlagsPage() {
  const flags = await getRuntimeFeatureFlags();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-amber-300/20 bg-black/30 p-6 shadow-2xl shadow-black/30 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">
          Read-only operations view
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
          Runtime feature flags
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-50/75">
          Flags are changed only through the restricted Supabase table by an authorized operator. This page never changes a flag.
        </p>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-amber-300/20 bg-black/30">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-amber-300/15 text-left text-sm">
            <thead className="bg-amber-300/5 text-xs font-black uppercase tracking-[0.14em] text-amber-100/70">
              <tr>
                <th className="px-5 py-4">Flag</th>
                <th className="px-5 py-4">State</th>
                <th className="px-5 py-4">Safe default</th>
                <th className="px-5 py-4">Source</th>
                <th className="px-5 py-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-300/10 text-amber-50/85">
              {flags.map((flag) => (
                <tr key={flag.key}>
                  <td className="px-5 py-4 font-mono text-xs text-amber-100">{flag.key}</td>
                  <td className="px-5 py-4 font-bold">{flag.enabled ? "Enabled" : "Disabled"}</td>
                  <td className="px-5 py-4">{flag.defaultValue ? "Enabled" : "Disabled"}</td>
                  <td className="px-5 py-4">{flag.source === "runtime" ? "Runtime value" : "Safe default"}</td>
                  <td className="px-5 py-4 text-amber-50/70">{flag.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
