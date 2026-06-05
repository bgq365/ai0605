import { ShipmentsHistory } from "@/components/shipments-history";
import { listShipments } from "@/server/stores/shipments-store";

export const dynamic = "force-dynamic";

export default async function ShipmentsPage() {
  const shipments = await listShipments();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-12">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0b8f8c]">Shipments</p>
        <h1 className="mt-2 text-4xl font-semibold text-[#153436]">已导入运单</h1>
      </div>

      <ShipmentsHistory initialShipments={shipments} />
    </main>
  );
}
