import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/stores/rules-store", () => ({
  getRuleById: vi.fn(),
  listRules: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
}));

vi.mock("@/server/stores/shipments-store", () => ({
  listShipments: vi.fn(),
  commitShipments: vi.fn(),
}));

vi.mock("@/lib/documents/snapshot", () => ({
  createDocumentSnapshotFromBuffer: vi.fn(),
  summarizeDocumentSnapshot: vi.fn(),
}));

vi.mock("@/lib/imports/service", () => ({
  previewImportFromSnapshot: vi.fn(),
}));

vi.mock("@/lib/ai/deepseek", () => ({
  suggestRuleFromDocumentSummary: vi.fn(),
}));

import { POST as filesSnapshotPost } from "@/app/api/files/snapshot/route";
import { POST as importsPreviewPost } from "@/app/api/imports/preview/route";
import { POST as importsCommitPost } from "@/app/api/imports/commit/route";
import { GET as shipmentsGet } from "@/app/api/shipments/route";
import { GET as ruleGet, PATCH as rulePatch, DELETE as ruleDelete } from "@/app/api/rules/[id]/route";
import { POST as rulesSuggestPost } from "@/app/api/rules/suggest/route";
import { POST as rulesTestPost } from "@/app/api/rules/test/route";
import { createDocumentSnapshotFromBuffer, summarizeDocumentSnapshot } from "@/lib/documents/snapshot";
import { previewImportFromSnapshot } from "@/lib/imports/service";
import { suggestRuleFromDocumentSummary } from "@/lib/ai/deepseek";
import { listShipments } from "@/server/stores/shipments-store";
import { deleteRule, getRuleById, updateRule } from "@/server/stores/rules-store";

const mockedCreateDocumentSnapshotFromBuffer = vi.mocked(createDocumentSnapshotFromBuffer);
const mockedSummarizeDocumentSnapshot = vi.mocked(summarizeDocumentSnapshot);
const mockedPreviewImportFromSnapshot = vi.mocked(previewImportFromSnapshot);
const mockedSuggestRuleFromDocumentSummary = vi.mocked(suggestRuleFromDocumentSummary);
const mockedListShipments = vi.mocked(listShipments);
const mockedGetRuleById = vi.mocked(getRuleById);
const mockedUpdateRule = vi.mocked(updateRule);
const mockedDeleteRule = vi.mocked(deleteRule);

describe("API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns snapshot summary for uploaded files", async () => {
    mockedCreateDocumentSnapshotFromBuffer.mockResolvedValue({
      kind: "excel",
      fileName: "demo.xlsx",
      sheets: [],
      pages: [],
    });
    mockedSummarizeDocumentSnapshot.mockReturnValue({
      kind: "excel",
      fileName: "demo.xlsx",
      sheetNames: ["Sheet1"],
      pageCount: 0,
      previewLines: ["row-1"],
    });

    const formData = new FormData();
    formData.append("file", new File(["demo"], "demo.xlsx"));
    const response = await filesSnapshotPost(new Request("http://localhost/api/files/snapshot", {
      method: "POST",
      body: formData,
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      fileName: "demo.xlsx",
      previewLines: ["row-1"],
    });
  });

  it("previews imports with a selected rule", async () => {
    mockedGetRuleById.mockResolvedValue({
      id: "rule-1",
      name: "Rule",
      description: "desc",
      documentKind: "excel",
      definition: {
        source: { mode: "excelSheets" },
        segment: { mode: "wholeSheet" },
        table: {},
        transforms: [],
        output: { fields: {}, itemFields: {} },
      },
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:00:00.000Z",
    });
    mockedCreateDocumentSnapshotFromBuffer.mockResolvedValue({
      kind: "excel",
      fileName: "demo.xlsx",
      sheets: [],
      pages: [],
    });
    mockedPreviewImportFromSnapshot.mockResolvedValue({
      shipments: [],
      issues: [],
    });

    const formData = new FormData();
    formData.append("file", new File(["demo"], "demo.xlsx"));
    formData.append("ruleId", "rule-1");

    const response = await importsPreviewPost(new Request("http://localhost/api/imports/preview", {
      method: "POST",
      body: formData,
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      rule: expect.objectContaining({ id: "rule-1" }),
      shipments: [],
      issues: [],
    });
  });

  it("returns validation failures during commit", async () => {
    const response = await importsCommitPost(
      new Request("http://localhost/api/imports/commit", {
        method: "POST",
        body: JSON.stringify({
          shipments: [
            {
              externalCode: "SO-1",
              items: [],
              sourceRowIds: [],
            },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "存在未修复校验错误",
    });
  });

  it("lists shipments with a search term", async () => {
    mockedListShipments.mockResolvedValue([
      {
        id: "shipment-1",
        externalCode: "SO-1",
        items: [],
        sourceRowIds: [],
        createdAt: "2026-06-05T00:00:00.000Z",
      },
    ]);

    const response = await shipmentsGet(new Request("http://localhost/api/shipments?search=SO-1"));

    expect(response.status).toBe(200);
    expect(mockedListShipments).toHaveBeenCalledWith({ search: "SO-1" });
    await expect(response.json()).resolves.toMatchObject({
      shipments: [expect.objectContaining({ externalCode: "SO-1" })],
    });
  });

  it("returns AI rule suggestions from the suggestion route", async () => {
    mockedCreateDocumentSnapshotFromBuffer.mockResolvedValue({
      kind: "excel",
      fileName: "demo.xlsx",
      sheets: [],
      pages: [],
    });
    mockedSummarizeDocumentSnapshot.mockReturnValue({
      kind: "excel",
      fileName: "demo.xlsx",
      sheetNames: ["Sheet1"],
      pageCount: 0,
      previewLines: ["配送汇总单号 | 收货机构"],
    });
    mockedSuggestRuleFromDocumentSummary.mockResolvedValue({
      suggestedRule: {
        source: { mode: "excelSheets" },
        segment: { mode: "wholeSheet" },
        table: {},
        transforms: [],
        output: { fields: {}, itemFields: {} },
      },
      confidenceByField: { externalCode: 0.9 },
      assumptions: ["mocked"],
      unknowns: [],
    });

    const formData = new FormData();
    formData.append("file", new File(["demo"], "demo.xlsx"));

    const response = await rulesSuggestPost(new Request("http://localhost/api/rules/suggest", {
      method: "POST",
      body: formData,
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      assumptions: ["mocked"],
      confidenceByField: { externalCode: 0.9 },
    });
  });

  it("tests an inline rule definition against uploaded content", async () => {
    mockedCreateDocumentSnapshotFromBuffer.mockResolvedValue({
      kind: "excel",
      fileName: "demo.xlsx",
      sheets: [],
      pages: [],
    });
    mockedPreviewImportFromSnapshot.mockResolvedValue({
      shipments: [],
      issues: [],
    });

    const formData = new FormData();
    formData.append("file", new File(["demo"], "demo.xlsx"));
    formData.append(
      "ruleDefinition",
      JSON.stringify({
        source: { mode: "excelSheets" },
        segment: { mode: "wholeSheet" },
        table: {},
        transforms: [],
        output: { fields: {}, itemFields: {} },
      }),
    );

    const response = await rulesTestPost(new Request("http://localhost/api/rules/test", {
      method: "POST",
      body: formData,
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      shipments: [],
      issues: [],
    });
  });

  it("handles rule detail CRUD routes", async () => {
    mockedGetRuleById.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "rule-1",
      name: "Rule",
      description: "desc",
      documentKind: "excel",
      definition: {
        source: { mode: "excelSheets" },
        segment: { mode: "wholeSheet" },
        table: {},
        transforms: [],
        output: { fields: {}, itemFields: {} },
      },
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:00:00.000Z",
    });
    mockedUpdateRule.mockResolvedValue({
      id: "rule-1",
      name: "Rule 2",
      description: "desc",
      documentKind: "excel",
      definition: {
        source: { mode: "excelSheets" },
        segment: { mode: "wholeSheet" },
        table: {},
        transforms: [],
        output: { fields: {}, itemFields: {} },
      },
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:00:00.000Z",
    });
    mockedDeleteRule.mockResolvedValue(true);

    const missingGet = await ruleGet(new Request("http://localhost/api/rules/rule-404"), {
      params: Promise.resolve({ id: "rule-404" }),
    });
    expect(missingGet.status).toBe(404);

    const patchResponse = await rulePatch(
      new Request("http://localhost/api/rules/rule-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Rule 2" }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
      { params: Promise.resolve({ id: "rule-1" }) },
    );
    expect(patchResponse.status).toBe(200);

    const deleteResponse = await ruleDelete(new Request("http://localhost/api/rules/rule-1", {
      method: "DELETE",
    }), {
      params: Promise.resolve({ id: "rule-1" }),
    });
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toMatchObject({ success: true });
  });
});
