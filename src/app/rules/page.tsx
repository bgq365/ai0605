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

      <div className="grid gap-4">
        {rules.map((rule) => (
          <article
            key={rule.id}
            className="rounded-[24px] border border-[#c6eceb] bg-white p-5 shadow-[0_12px_32px_rgba(15,198,194,0.08)]"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[#153436]">{rule.name}</h2>
                <p className="mt-1 text-sm text-[#557679]">{rule.description}</p>
              </div>
              <span className="rounded-full bg-[#e8fafa] px-3 py-1 text-xs font-medium text-[#0b6e6e]">
                {rule.documentKind}
              </span>
            </div>

            <pre className="mt-4 overflow-auto rounded-2xl bg-[#f7fefe] p-4 text-xs text-[#335b60]">
              {JSON.stringify(rule.definition, null, 2)}
            </pre>
          </article>
        ))}
      </div>
    </main>
  );
}
