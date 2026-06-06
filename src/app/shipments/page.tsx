import { AppNav } from "@/components/app-nav";
import { ShipmentsHistory } from "@/components/shipments-history";
import { listShipments } from "@/server/stores/shipments-store";

export const dynamic = "force-dynamic";

export default async function ShipmentsPage() {
  const shipments = await listShipments();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,198,194,0.18),_transparent_28%),linear-gradient(180deg,#f7fcfc_0%,#eff8f8_100%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <section className="rounded-[30px] border border-[#c7eceb] bg-white/88 p-6 shadow-[0_18px_48px_rgba(15,198,194,0.1)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0b8f8c]">Shipments</p>
              <h1 className="mt-2 text-4xl font-semibold text-[#153436]">已导入运单</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#557679]">
                浏览已提交的运单批次，按门店、收件人、电话等关键字段继续检索和复核。
              </p>
            </div>

            <AppNav />
          </div>
        </section>

        <ShipmentsHistory initialShipments={shipments} />
      </div>
    </main>
  );
}
