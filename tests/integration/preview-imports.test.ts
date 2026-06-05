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
      recipientName: "张锦峰",
      recipientPhone: "18533660999",
      items: expect.arrayContaining([
        expect.objectContaining({ skuCode: "LMTZ0160009", quantity: 20 }),
      ]),
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
    expect(result.shipments.map((shipment) => shipment.storeName)).toEqual(
      expect.arrayContaining(["银泰店", "金桥店", "金银潭店"]),
    );
  });

  it("parses card-style transfer sheets by marker blocks", async () => {
    const result = await previewImport({
      filePath: fixtureFiles.cardExcel,
      rule: sampleRules.find((rule) => rule.id === "card-transfer-excel")!,
    });

    expect(result.shipments).toHaveLength(3);
    expect(result.shipments[1]).toMatchObject({
      recipientName: "李经理",
    });
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
