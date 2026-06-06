import { AppNav } from "@/components/app-nav";
import { RulesManager } from "@/components/rules-manager";
import { listRules } from "@/server/stores/rules-store";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const rules = await listRules();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,198,194,0.18),_transparent_28%),linear-gradient(180deg,#f7fcfc_0%,#eff8f8_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <section className="rounded-[30px] border border-[#c7eceb] bg-white/88 p-6 shadow-[0_18px_48px_rgba(15,198,194,0.1)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0b8f8c]">Rules</p>
              <h1 className="mt-2 text-4xl font-semibold text-[#153436]">解析规则列表</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#557679]">
                维护规则 DSL、测试解析效果，并为不同单据模板沉淀可复用的导入策略。
              </p>
            </div>

            <AppNav />
          </div>
        </section>

        <RulesManager initialRules={rules} />
      </div>
    </main>
  );
}
