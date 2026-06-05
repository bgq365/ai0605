// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportWorkbench } from "@/components/import-workbench";
import { sampleRules } from "@/lib/domain/sample-rules";

describe("ImportWorkbench", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a validation message when preview is clicked without a file", async () => {
    const user = userEvent.setup();
    render(<ImportWorkbench rules={sampleRules} />);

    await user.click(screen.getByRole("button", { name: "试解析预览" }));

    expect(await screen.findByText("请选择文件后再试解析")).toBeInTheDocument();
  });

  it("renders AI suggestion details after a successful suggestion request", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        confidenceByField: {
          externalCode: 0.92,
          items: 0.87,
          recipientPhone: 0.65,
        },
        assumptions: ["识别为多 SKU 聚合模板"],
        unknowns: ["地址字段建议人工确认"],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<ImportWorkbench rules={sampleRules} />);

    const input = screen.getByLabelText("上传文件");
    const file = new File(["demo"], "demo.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: "AI 规则建议" }));

    expect(await screen.findByText("AI 推荐结果")).toBeInTheDocument();
    expect(screen.getByText("高置信字段数：2")).toBeInTheDocument();
    expect(screen.getByText("假设：识别为多 SKU 聚合模板")).toBeInTheDocument();
    expect(screen.getByText("待确认：地址字段建议人工确认")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rules/suggest",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    );
  });

  it("shows commit feedback after a preview and commit flow", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          shipments: [
            {
              externalCode: "SO-1",
              storeName: "海口龙湖店",
              recipientName: "张锦峰",
              recipientPhone: "18533660999",
              items: [
                {
                  skuCode: "SKU-1",
                  skuName: "测试商品",
                  quantity: 2,
                },
              ],
              sourceRowIds: ["1"],
            },
          ],
          issues: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          successCount: 1,
          failureCount: 0,
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    render(<ImportWorkbench rules={sampleRules} />);

    const input = screen.getByLabelText("上传文件");
    const file = new File(["demo"], "demo.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: "试解析预览" }));

    expect(await screen.findByText("结构化运单预览")).toBeInTheDocument();
    expect(await screen.findByText("海口龙湖店")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "提交下单" }));

    await waitFor(() => {
      expect(screen.getByText("提交完成：成功 1 条，失败 0 条。")).toBeInTheDocument();
    });
  });
});
