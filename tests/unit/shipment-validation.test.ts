import { describe, expect, it } from "vitest";
import { validateShipmentDrafts } from "@/lib/shipments/validation";

describe("shipment validation", () => {
  it("flags missing delivery information when neither store mode nor recipient mode is complete", () => {
    const issues = validateShipmentDrafts([
      {
        items: [
          {
            skuCode: "SKU-1",
            skuName: "Test",
            quantity: 2,
          },
        ],
        sourceRowIds: ["row-1"],
      },
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "recipientGroup",
          severity: "error",
        }),
      ]),
    );
  });

  it("flags non-positive quantities", () => {
    const issues = validateShipmentDrafts([
      {
        storeName: "Store",
        items: [
          {
            skuCode: "SKU-1",
            skuName: "Test",
            quantity: 0,
          },
        ],
        sourceRowIds: ["row-2"],
      },
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "items.quantity",
          severity: "error",
        }),
      ]),
    );
  });
});
