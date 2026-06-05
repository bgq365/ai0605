import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentSnapshotSummary } from "@/lib/domain/types";
import { suggestRuleFromDocumentSummary } from "@/lib/ai/deepseek";

const excelSummary: DocumentSnapshotSummary = {
  kind: "excel",
  fileName: "湖南仓.xlsx",
  sheetNames: ["Sheet1"],
  pageCount: 0,
  previewLines: ["配送汇总单号 | 收货机构 | 物品编码* | 发货数量*"],
};

describe("suggestRuleFromDocumentSummary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("falls back to heuristic rules when no DeepSeek key is configured", async () => {
    const result = await suggestRuleFromDocumentSummary(excelSummary);

    expect(result.suggestedRule.output.groupingField).toBe("groupCode");
    expect(result.assumptions.length).toBeGreaterThan(0);
  });

  it("uses the DeepSeek API when a key is configured and parses JSON output", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestedRule: {
                  source: { mode: "excelSheets" },
                  segment: { mode: "wholeSheet" },
                  table: {
                    headerRow: 2,
                    dataStartRow: 3,
                    columnMap: {
                      groupCode: "配送单号",
                      skuCode: "物品编码",
                      quantity: "发货数量",
                    },
                  },
                  transforms: [
                    { type: "readTabularRows" },
                    { type: "groupRowsByField", options: { field: "groupCode" } },
                  ],
                  output: {
                    groupingField: "groupCode",
                    fields: {
                      externalCode: "externalCode",
                      storeName: "storeName",
                    },
                    itemFields: {
                      skuCode: "skuCode",
                      quantity: "quantity",
                    },
                  },
                },
                confidenceByField: {
                  externalCode: 0.91,
                  items: 0.95,
                },
                assumptions: ["识别为按单号聚合的 Excel 模板"],
                unknowns: ["地址字段需要人工复核"],
              }),
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await suggestRuleFromDocumentSummary(excelSummary);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(result.confidenceByField.externalCode).toBe(0.91);
    expect(result.assumptions).toContain("识别为按单号聚合的 Excel 模板");
    expect(result.unknowns).toContain("地址字段需要人工复核");
    expect(result.suggestedRule.output.groupingField).toBe("groupCode");
  });

  it("falls back when the DeepSeek request fails", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network failed")),
    );

    const result = await suggestRuleFromDocumentSummary(excelSummary);

    expect(result.suggestedRule.output.groupingField).toBe("groupCode");
    expect(result.assumptions.some((message) => message.includes("AI"))).toBe(true);
  });
});
