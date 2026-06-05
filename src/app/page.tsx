import Link from "next/link";
import { ImportWorkbench } from "@/components/import-workbench";
import { listRules } from "@/server/stores/rules-store";

export default async function Home() {
  const rules = await listRules();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,198,194,0.26),_transparent_32%),linear-gradient(180deg,#f3fbfb_0%,#edf8f8_42%,#f8fcfc_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10 lg:px-10">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[#c7eceb] bg-white/82 p-7 shadow-[0_18px_48px_rgba(15,198,194,0.12)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#0b8f8c]">Universal Import</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#153436] sm:text-5xl">万能导入 V2</h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[#46696d] sm:text-lg">
                规则驱动的多格式批量下单系统，覆盖 Excel / PDF 复杂结构解析、试解析预览、规则管理与后续自动部署。
              </p>
            </div>

            <nav className="flex flex-wrap gap-3 text-sm font-medium">
              <Link className="rounded-full border border-[#b7dfde] bg-[#f7fefe] px-4 py-2 text-[#0b6e6e]" href="/">
                导入工作台
              </Link>
              <Link className="rounded-full border border-[#b7dfde] bg-white px-4 py-2 text-[#234548] hover:bg-[#f7fefe]" href="/rules">
                解析规则
              </Link>
              <Link className="rounded-full border border-[#b7dfde] bg-white px-4 py-2 text-[#234548] hover:bg-[#f7fefe]" href="/shipments">
                已导入运单
              </Link>
            </nav>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <HeroMetric label="已内置规则" value={String(rules.length)} detail="覆盖 5 份真实附件验收" />
            <HeroMetric label="已验证格式" value="Excel / PDF" detail="Word 适配器接口已预留" />
            <HeroMetric label="执行方式" value="手动选规则" detail="支持试解析预览与 AI 建议" />
          </div>
        </header>

        <ImportWorkbench rules={rules} />
      </div>
    </main>
  );
}

function HeroMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[24px] bg-[#f8ffff] px-5 py-5">
      <p className="text-xs uppercase tracking-[0.22em] text-[#6d9294]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[#153436]">{value}</p>
      <p className="mt-2 text-sm text-[#557679]">{detail}</p>
    </div>
  );
}
