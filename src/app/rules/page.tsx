import { RulesManager } from "@/components/rules-manager";
import { listRules } from "@/server/stores/rules-store";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const rules = await listRules();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-12">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0b8f8c]">Rules</p>
        <h1 className="mt-2 text-4xl font-semibold text-[#153436]">解析规则列表</h1>
      </div>

      <RulesManager initialRules={rules} />
    </main>
  );
}
