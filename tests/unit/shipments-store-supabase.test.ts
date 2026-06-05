import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
  getSupabaseAdminCredentials: vi.fn(() => null),
}));

import { listShipments } from "@/server/stores/shipments-store";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);

describe("shipments store with Supabase persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads shipments even when items must be fetched from a separate query", async () => {
    const shipmentsOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: "shipment-1",
          external_code: "SO-2001",
          store_name: "尹三顺自助烤肉（银泰店）",
          recipient_name: "银泰店",
          recipient_phone: "13800138000",
          recipient_address: "武汉江汉路",
          remark: null,
          created_at: "2026-06-06T10:00:00.000Z",
        },
      ],
      error: null,
    });
    const shipmentsOr = vi.fn().mockReturnValue({
      order: shipmentsOrder,
    });

    const itemsIn = vi.fn().mockResolvedValue({
      data: [
        {
          shipment_id: "shipment-1",
          sku_code: "SKU-1",
          sku_name: "肥牛",
          sku_spec: "500g",
          quantity: 2,
        },
      ],
      error: null,
    });

    const shipmentsQuery = {
      select: vi.fn(),
      or: shipmentsOr,
      order: shipmentsOrder,
    };
    shipmentsQuery.select.mockReturnValue(shipmentsQuery);

    const itemsQuery = {
      select: vi.fn(),
      in: itemsIn,
    };
    itemsQuery.select.mockReturnValue(itemsQuery);

    mockedGetSupabaseAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "shipments") {
          return shipmentsQuery;
        }

        if (table === "shipment_items") {
          return itemsQuery;
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const shipments = await listShipments({ search: "银泰店" });

    expect(shipments).toHaveLength(1);
    expect(shipments[0]).toMatchObject({
      externalCode: "SO-2001",
      storeName: "尹三顺自助烤肉（银泰店）",
      recipientPhone: "13800138000",
      items: [
        {
          skuCode: "SKU-1",
          skuName: "肥牛",
          skuSpec: "500g",
          quantity: 2,
        },
      ],
    });
    expect(shipmentsOr).toHaveBeenCalledWith(
      "external_code.ilike.%银泰店%,recipient_name.ilike.%银泰店%,store_name.ilike.%银泰店%",
    );
    expect(itemsIn).toHaveBeenCalledWith("shipment_id", ["shipment-1"]);
  });
});
