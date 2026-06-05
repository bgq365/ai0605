"use client";

import { useMemo, useState } from "react";
import type { ShipmentDraft } from "@/lib/domain/types";

type StoredShipment = ShipmentDraft & {
  id: string;
  createdAt: string;
};

type ShipmentsHistoryProps = {
  initialShipments: StoredShipment[];
};

const pageSize = 8;

export function ShipmentsHistory({ initialShipments }: ShipmentsHistoryProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filteredShipments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return initialShipments;
    }

    return initialShipments.filter((shipment) =>
      [shipment.externalCode, shipment.recipientName, shipment.storeName, shipment.recipientPhone]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [initialShipments, search]);

  const totalPages = Math.max(1, Math.ceil(filteredShipments.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedShipments = filteredShipments.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <section className="grid gap-6">
      <div className="rounded-[28px] border border-[#c6eceb] bg-white p-5 shadow-[0_12px_32px_rgba(15,198,194,0.08)]">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <label className="grid gap-2 text-sm font-medium text-[#214447]">
            搜索历史运单
            <input
              className="rounded-2xl border border-[#d2e7e6] bg-[#fbffff] px-4 py-3 outline-none focus:border-[#0fc6c2]"
              placeholder="按外部编码 / 收件人 / 门店 / 电话筛选"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="rounded-2xl bg-[#f7fefe] px-4 py-3 text-sm text-[#557679]">
            共 {filteredShipments.length} 条记录，第 {safePage} / {totalPages} 页
          </div>
        </div>
      </div>

      {pagedShipments.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[#c6eceb] bg-white px-8 py-16 text-center text-sm text-[#5c7a7d]">
          暂无符合条件的运单记录。你可以先在首页完成导入，或调整搜索条件。
        </div>
      ) : (
        <div className="grid gap-4">
          {pagedShipments.map((shipment) => (
            <article
              key={shipment.id}
              className="rounded-[24px] border border-[#c6eceb] bg-white p-5 shadow-[0_12px_32px_rgba(15,198,194,0.08)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#153436]">
                    {shipment.storeName || shipment.recipientName || "未命名运单"}
                  </h2>
                  <p className="mt-1 text-sm text-[#557679]">
                    {shipment.externalCode || "无外部编码"} · {shipment.recipientPhone || "待确认电话"}
                  </p>
                  <p className="mt-2 text-sm text-[#6a888b]">{shipment.recipientAddress || "待补充地址"}</p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-[#e8fafa] px-3 py-1 text-xs font-medium text-[#0b6e6e]">
                    {shipment.items.length} 个 SKU
                  </span>
                  <p className="mt-3 text-xs text-[#6a888b]">
                    提交时间 {new Date(shipment.createdAt).toLocaleString("zh-CN")}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#c6eceb] bg-white px-5 py-4">
        <p className="text-sm text-[#557679]">分页浏览历史导入结果，支持继续按关键字段筛选。</p>
        <div className="flex gap-2">
          <button
            className="rounded-xl border border-[#d5e8e7] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={safePage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            上一页
          </button>
          <button
            className="rounded-xl border border-[#d5e8e7] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={safePage >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            type="button"
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  );
}
