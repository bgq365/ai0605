import { describe, expect, it } from "vitest";
import type { ShipmentDraft } from "@/lib/domain/types";
import {
  applyRowsToShipments,
  buildEditableRows,
  detectShipmentRowIssues,
} from "@/lib/shipments/editor";

const sampleShipments: ShipmentDraft[] = [
  {
    externalCode: "SO-1",
    storeName: "Store A",
    recipientName: "",
    recipientPhone: "",
    recipientAddress: "",
    items: [
      {
        skuCode: "SKU-1",
        skuName: "Milk Tea",
        skuSpec: "12 bottles",
        quantity: 2,
      },
      {
        skuCode: "SKU-2",
        skuName: "Lemon Tea",
        skuSpec: "6 bottles",
        quantity: 3,
      },
    ],
    sourceRowIds: ["segment:1"],
  },
];

describe("shipment editor helpers", () => {
  it("builds editable rows from grouped shipments", () => {
    const rows = buildEditableRows(sampleShipments);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      externalCode: "SO-1",
      storeName: "Store A",
      skuCode: "SKU-1",
      quantity: "2",
    });
  });

  it("applies edited rows back into grouped shipments", () => {
    const rows = buildEditableRows(sampleShipments);
    rows[0].recipientName = "Alice";
    rows[0].recipientPhone = "13800138000";
    rows[0].recipientAddress = "Shanghai";
    rows[1].quantity = "5";

    const shipments = applyRowsToShipments(rows);

    expect(shipments).toHaveLength(1);
    expect(shipments[0]).toMatchObject({
      externalCode: "SO-1",
      recipientName: "Alice",
      recipientPhone: "13800138000",
      recipientAddress: "Shanghai",
    });
    expect(shipments[0].items[1]).toMatchObject({ quantity: 5 });
  });

  it("detects duplicate external codes and field validation issues", () => {
    const rows = buildEditableRows(sampleShipments);
    rows.push({
      ...rows[0],
      id: "row-2",
      skuCode: "",
      quantity: "0",
    });

    const issues = detectShipmentRowIssues(rows, ["SO-1"]);

    expect(issues.some((issue) => issue.field === "externalCode" && issue.message.includes("重复"))).toBe(true);
    expect(issues.some((issue) => issue.field === "skuCode")).toBe(true);
    expect(issues.some((issue) => issue.field === "quantity")).toBe(true);
  });
});
