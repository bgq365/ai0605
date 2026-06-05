// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/import-workbench", () => ({
  ImportWorkbench: ({ rules }: { rules: Array<{ id: string }> }) => (
    <div data-testid="import-workbench">rules:{rules.length}</div>
  ),
}));

vi.mock("@/server/stores/rules-store", async () => {
  const actual = await vi.importActual<typeof import("@/server/stores/rules-store")>("@/server/stores/rules-store");
  return {
    ...actual,
    listRules: vi.fn(),
  };
});

vi.mock("@/server/stores/shipments-store", async () => {
  const actual = await vi.importActual<typeof import("@/server/stores/shipments-store")>("@/server/stores/shipments-store");
  return {
    ...actual,
    listShipments: vi.fn(),
  };
});

vi.mock("@/server/supabase/admin", async () => {
  const actual = await vi.importActual<typeof import("@/server/supabase/admin")>("@/server/supabase/admin");
  return {
    ...actual,
    getSupabaseAdminClient: vi.fn(() => null),
  };
});

vi.mock("@/lib/imports/preview", () => ({
  previewImport: vi.fn(),
}));

import Home, * as homePageModule from "@/app/page";
import RulesPage, * as rulesPageModule from "@/app/rules/page";
import ShipmentsPage, * as shipmentsPageModule from "@/app/shipments/page";
import { sampleRules } from "@/lib/domain/sample-rules";
import type { DocumentSnapshot, ImportRuleDefinition } from "@/lib/domain/types";
import { previewImportFromSnapshot } from "@/lib/imports/service";
import { previewImport } from "@/lib/imports/preview";
import * as domainIndex from "@/lib/domain";
import { listRules } from "@/server/stores/rules-store";
import { listShipments } from "@/server/stores/shipments-store";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import {
  importBatchesTable,
  importRulesTable,
  shipmentItemsTable,
  shipmentsTable,
} from "@/server/db/schema";

const mockedListRules = vi.mocked(listRules);
const mockedListShipments = vi.mocked(listShipments);
const mockedPreviewImport = vi.mocked(previewImport);
const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);

describe("pages, stores, and support modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSupabaseAdminClient.mockReturnValue(null);
  });

  it("renders the home page with rule metrics", async () => {
    mockedListRules.mockResolvedValue(sampleRules);

    const element = await Home();
    render(element);

    expect(screen.getByText("万能导入 V2")).toBeInTheDocument();
    expect(screen.getByText("导入工作台")).toBeInTheDocument();
    expect(screen.getByTestId("import-workbench")).toHaveTextContent("rules:5");
  });

  it("marks server-rendered data pages as dynamic", () => {
    expect(homePageModule.dynamic).toBe("force-dynamic");
    expect(rulesPageModule.dynamic).toBe("force-dynamic");
    expect(shipmentsPageModule.dynamic).toBe("force-dynamic");
  });

  it("renders the rules page", async () => {
    mockedListRules.mockResolvedValue(sampleRules.slice(0, 1));

    const element = await RulesPage();
    render(element);

    expect(screen.getByText("解析规则列表")).toBeInTheDocument();
    expect(screen.getByText(sampleRules[0].name)).toBeInTheDocument();
  });

  it("renders shipment pages for both empty and populated states", async () => {
    mockedListShipments.mockResolvedValueOnce([]);
    render(await ShipmentsPage());
    expect(screen.getByText("还没有已提交运单。先在首页完成一次试解析与提交。")).toBeInTheDocument();

    mockedListShipments.mockResolvedValueOnce([
      {
        id: "shipment-1",
        externalCode: "SO-1",
        storeName: "海口龙湖店",
        recipientPhone: "18533660999",
        items: [
          {
            skuCode: "SKU-1",
            skuName: "测试商品",
            quantity: 1,
          },
        ],
        sourceRowIds: [],
        createdAt: "2026-06-05T00:00:00.000Z",
      },
    ]);
    render(await ShipmentsPage());

    expect(screen.getByText("海口龙湖店")).toBeInTheDocument();
    expect(screen.getByText(/SO-1/)).toBeInTheDocument();
  });

  it("builds preview results from snapshot service", async () => {
    const snapshot: DocumentSnapshot = {
      kind: "excel",
      fileName: "demo.xlsx",
      sheets: [],
      pages: [],
    };
    const definition: ImportRuleDefinition = sampleRules[0].definition;

    mockedPreviewImport.mockResolvedValue({
      shipments: [
        {
          externalCode: "SO-1",
          storeName: "测试门店",
          recipientName: "张三",
          items: [{ skuCode: "SKU-1", skuName: "测试商品", quantity: 2 }],
          sourceRowIds: ["1"],
        },
      ],
      issues: [],
    });

    const result = await previewImportFromSnapshot(snapshot, definition);

    expect(mockedPreviewImport).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: "",
        snapshot,
        rule: expect.objectContaining({
          id: "inline-rule",
          documentKind: "excel",
        }),
      }),
    );
    expect(result.shipments).toHaveLength(1);
    expect(result.issues).toHaveLength(0);
  });

  it("supports local rule store CRUD when Supabase is unavailable", async () => {
    const actualRulesStore = await vi.importActual<typeof import("@/server/stores/rules-store")>("@/server/stores/rules-store");

    const created = await actualRulesStore.createRule({
      name: "自定义规则",
      description: "本地测试",
      documentKind: "excel",
      definition: sampleRules[0].definition,
    });

    expect(created.id).toBeTruthy();
    expect(await actualRulesStore.getRuleById(created.id)).toMatchObject({ name: "自定义规则" });

    const updated = await actualRulesStore.updateRule(created.id, { description: "已更新" });
    expect(updated).toMatchObject({ description: "已更新" });

    const listed = await actualRulesStore.listRules();
    expect(listed.some((rule) => rule.id === created.id)).toBe(true);

    expect(await actualRulesStore.deleteRule(created.id)).toBe(true);
    expect(await actualRulesStore.getRuleById(created.id)).toBeNull();
  });

  it("supports local shipment store commit and search when Supabase is unavailable", async () => {
    const actualShipmentsStore =
      await vi.importActual<typeof import("@/server/stores/shipments-store")>("@/server/stores/shipments-store");

    const inserted = await actualShipmentsStore.commitShipments([
      {
        externalCode: "SO-LOCAL-1",
        storeName: "长沙门店",
        recipientName: "李四",
        recipientPhone: "13800000000",
        recipientAddress: "长沙测试地址",
        items: [{ skuCode: "SKU-1", skuName: "测试商品", quantity: 3 }],
        sourceRowIds: ["1"],
      },
    ]);

    expect(inserted).toHaveLength(1);

    const searched = await actualShipmentsStore.listShipments({ search: "SO-LOCAL-1" });
    expect(searched[0]).toMatchObject({ externalCode: "SO-LOCAL-1" });
  });

  it("exports domain and schema symbols", () => {
    expect(domainIndex).toBeTruthy();
    expect(importRulesTable).toBeTruthy();
    expect(importBatchesTable).toBeTruthy();
    expect(shipmentsTable).toBeTruthy();
    expect(shipmentItemsTable).toBeTruthy();
  });
});
