import { describe, expect, it } from "vitest";
import { sampleRules } from "@/lib/domain/sample-rules";
import { previewImport } from "@/lib/imports/preview";
import { fixtureFiles } from "../fixtures/files";

describe("preview import with real fixtures", () => {
  it("parses the Haikou dispatch sheet and extracts footer recipient info", async () => {
    const result = await previewImport({
      filePath: fixtureFiles.haikouExcel,
      rule: sampleRules.find((rule) => rule.id === "haikou-footer-excel")!,
    });

    expect(result.shipments).toHaveLength(1);
    expect(result.shipments[0]).toMatchObject({
      recipientPhone: "18533660999",
      items: expect.arrayContaining([expect.objectContaining({ skuCode: "LMTZ0160009", quantity: 20 })]),
    });
  });

  it("parses the Hunan warehouse sheet and groups rows by delivery order code", async () => {
    const result = await previewImport({
      filePath: fixtureFiles.hunanExcel,
      rule: sampleRules.find((rule) => rule.id === "hunan-grouped-excel")!,
    });

    expect(result.shipments.length).toBeGreaterThan(1);
    expect(result.shipments[0].items.length).toBeGreaterThan(0);
    expect(result.shipments[0].recipientAddress).toBeTruthy();
  });

  it("parses the multi-sheet workbook and merges per-sheet footer information", async () => {
    const result = await previewImport({
      filePath: fixtureFiles.multiSheetExcel,
      rule: sampleRules.find((rule) => rule.id === "multi-sheet-footer-excel")!,
    });

    expect(result.shipments).toHaveLength(3);
    expect(result.shipments.every((shipment) => shipment.recipientAddress)).toBe(true);
  });

  it("parses card-style transfer sheets by marker blocks", async () => {
    const result = await previewImport({
      filePath: fixtureFiles.cardExcel,
      rule: sampleRules.find((rule) => rule.id === "card-transfer-excel")!,
    });

    expect(result.shipments).toHaveLength(3);
    expect(result.shipments[1]?.recipientName).toBeTruthy();
    expect(result.shipments[1]?.items.length).toBeGreaterThan(0);
  });

  it("parses matrix store quantities into one shipment per store", async () => {
    const result = await previewImport({
      filePath: fixtureFiles.matrixExcel,
      rule: sampleRules.find((rule) => rule.id === "matrix-store-excel")!,
    });

    expect(result.shipments.map((shipment) => shipment.storeName)).toEqual(
      expect.arrayContaining(["银泰", "金银潭", "金桥", "门店D"]),
    );

    const yintaiShipment = result.shipments.find((shipment) => shipment.storeName === "银泰");
    expect(yintaiShipment?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ skuCode: "05010138", quantity: 1 }),
        expect.objectContaining({ skuCode: "06040282", quantity: 3 }),
      ]),
    );

    const mendianDShipment = result.shipments.find((shipment) => shipment.storeName === "门店D");
    expect(mendianDShipment?.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ skuCode: "07010696", quantity: 3 })]),
    );
  });

  it("parses the PDF dispatch sheet and skips summary rows", async () => {
    const result = await previewImport({
      filePath: fixtureFiles.pdfDelivery,
      rule: sampleRules.find((rule) => rule.id === "pdf-delivery-text")!,
    });

    expect(result.shipments).toHaveLength(1);
    expect(result.shipments[0]).toMatchObject({
      recipientName: "荣丽",
      recipientPhone: "13130093946",
    });
    expect(result.shipments[0].items.some((item) => item.skuCode === "ZBWP0099")).toBe(true);
  });
});
