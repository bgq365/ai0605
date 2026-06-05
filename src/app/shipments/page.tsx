import { listShipments } from "@/server/stores/shipments-store";

export default async function ShipmentsPage() {
  const shipments = await listShipments();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-12">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0b8f8c]">Shipments</p>
        <h1 className="mt-2 text-4xl font-semibold text-[#153436]">已导入运单</h1>
      </div>

      {shipments.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[#c6eceb] bg-white px-8 py-16 text-center text-sm text-[#5c7a7d]">
          还没有已提交运单。先在首页完成一次试解析与提交。
        </div>
      ) : (
        <div className="grid gap-4">
          {shipments.map((shipment) => (
            <article
              key={shipment.id}
              className="rounded-[24px] border border-[#c6eceb] bg-white p-5 shadow-[0_12px_32px_rgba(15,198,194,0.08)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#153436]">
                    {shipment.storeName || shipment.recipientName || "未命名运单"}
                  </h2>
                  <p className="mt-1 text-sm text-[#557679]">
                    {shipment.externalCode || "无外部编码"} · {shipment.recipientPhone || "待确认电话"}
                  </p>
                </div>
                <span className="rounded-full bg-[#e8fafa] px-3 py-1 text-xs font-medium text-[#0b6e6e]">
                  {shipment.items.length} 个 SKU
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
