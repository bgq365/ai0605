import { randomUUID } from "node:crypto";
import type { ShipmentDraft } from "@/lib/domain/types";
import { getSupabaseAdminClient, getSupabaseAdminCredentials } from "@/server/supabase/admin";

export interface StoredShipment extends ShipmentDraft {
  id: string;
  createdAt: string;
}

const shipments: StoredShipment[] = [];

function listLocalShipments(query?: { search?: string }) {
  const search = query?.search?.trim().toLowerCase();
  if (!search) {
    return [...shipments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return shipments
    .filter((shipment) =>
      [shipment.externalCode, shipment.recipientName, shipment.storeName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function shouldRequirePersistentStorage() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

export async function listShipments(query?: { search?: string }) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return listLocalShipments(query);
  }

  let request = supabase.from("shipments").select("*");
  const search = query?.search?.trim();
  if (search) {
    request = request.or(`external_code.ilike.%${search}%,recipient_name.ilike.%${search}%,store_name.ilike.%${search}%`);
  }

  const { data: shipmentRows, error: shipmentsError } = await request.order("created_at", { ascending: false });
  if (shipmentsError || !shipmentRows) {
    return listLocalShipments(query);
  }

  const shipmentIds = shipmentRows.map((row) => String(row.id)).filter(Boolean);
  let itemsByShipmentId = new Map<string, Array<Record<string, unknown>>>();

  if (shipmentIds.length > 0) {
    const { data: itemRows, error: itemsError } = await supabase
      .from("shipment_items")
      .select("*")
      .in("shipment_id", shipmentIds);

    if (itemsError) {
      return listLocalShipments(query);
    }

    itemsByShipmentId = (itemRows ?? []).reduce<Map<string, Array<Record<string, unknown>>>>((grouped, item) => {
      const shipmentId = String(item.shipment_id ?? "");
      if (!shipmentId) {
        return grouped;
      }

      const existing = grouped.get(shipmentId) ?? [];
      existing.push(item as Record<string, unknown>);
      grouped.set(shipmentId, existing);
      return grouped;
    }, new Map<string, Array<Record<string, unknown>>>());
  }

  return shipmentRows.map((row) => ({
    id: String(row.id),
    externalCode: row.external_code ? String(row.external_code) : undefined,
    storeName: row.store_name ? String(row.store_name) : undefined,
    recipientName: row.recipient_name ? String(row.recipient_name) : undefined,
    recipientPhone: row.recipient_phone ? String(row.recipient_phone) : undefined,
    recipientAddress: row.recipient_address ? String(row.recipient_address) : undefined,
    remark: row.remark ? String(row.remark) : undefined,
    items: (itemsByShipmentId.get(String(row.id)) ?? []).map((item: Record<string, unknown>) => ({
          skuCode: String(item.sku_code ?? ""),
          skuName: String(item.sku_name ?? ""),
          skuSpec: item.sku_spec ? String(item.sku_spec) : undefined,
          quantity: Number(item.quantity ?? 0),
        })),
    sourceRowIds: [],
    createdAt: String(row.created_at),
  }));
}

export async function commitShipments(drafts: ShipmentDraft[]) {
  const createdAt = new Date().toISOString();
  const inserted = drafts.map((draft) => ({
    ...draft,
    id: randomUUID(),
    createdAt,
  }));

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    if (shouldRequirePersistentStorage() || getSupabaseAdminCredentials()) {
      throw new Error("Supabase persistence is unavailable");
    }

    shipments.unshift(...inserted);
    return inserted;
  }

  {
    const shipmentRows = inserted.map((shipment) => ({
      id: shipment.id,
      external_code: shipment.externalCode ?? null,
      store_name: shipment.storeName ?? null,
      recipient_name: shipment.recipientName ?? null,
      recipient_phone: shipment.recipientPhone ?? null,
      recipient_address: shipment.recipientAddress ?? null,
      remark: shipment.remark ?? null,
      item_count: shipment.items.length,
      created_at: shipment.createdAt,
    }));

    const itemRows = inserted.flatMap((shipment) =>
      shipment.items.map((item) => ({
        id: randomUUID(),
        shipment_id: shipment.id,
        sku_code: item.skuCode,
        sku_name: item.skuName,
        sku_spec: item.skuSpec ?? null,
        quantity: item.quantity,
      })),
    );

    const shipmentsInsert = await supabase.from("shipments").insert(shipmentRows);
    if (shipmentsInsert.error) {
      throw new Error(shipmentsInsert.error.message);
    }

    const itemsInsert = await supabase.from("shipment_items").insert(itemRows);
    if (itemsInsert.error) {
      await supabase.from("shipments").delete().in(
        "id",
        inserted.map((shipment) => shipment.id),
      );
      throw new Error(itemsInsert.error.message);
    }

    return inserted;
  }
}
