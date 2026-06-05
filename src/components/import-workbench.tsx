"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import type { ImportRule, ShipmentDraft, ValidationIssue } from "@/lib/domain/types";
import {
  applyRowsToShipments,
  buildEditableRows,
  detectShipmentRowIssues,
  type EditableShipmentRow,
} from "@/lib/shipments/editor";

type ImportWorkbenchProps = {
  rules: ImportRule[];
};

type PreviewResponse = {
  shipments: ShipmentDraft[];
  issues: ValidationIssue[];
};

type SuggestionState = {
  confidenceByField: Record<string, number>;
  assumptions: string[];
  unknowns: string[];
} | null;

type RowField = keyof EditableShipmentRow;

const editableColumns: Array<{ key: RowField; label: string; width?: string }> = [
  { key: "externalCode", label: "外部编码", width: "min-w-[180px]" },
  { key: "storeName", label: "收货门店", width: "min-w-[180px]" },
  { key: "recipientName", label: "收件人", width: "min-w-[120px]" },
  { key: "recipientPhone", label: "联系电话", width: "min-w-[140px]" },
  { key: "recipientAddress", label: "收货地址", width: "min-w-[220px]" },
  { key: "remark", label: "备注", width: "min-w-[140px]" },
  { key: "skuCode", label: "SKU 编码", width: "min-w-[130px]" },
  { key: "skuName", label: "SKU 名称", width: "min-w-[220px]" },
  { key: "skuSpec", label: "规格", width: "min-w-[140px]" },
  { key: "quantity", label: "数量", width: "min-w-[90px]" },
];

function createEmptyRow(): EditableShipmentRow {
  return {
    id: `manual-${crypto.randomUUID()}`,
    externalCode: "",
    storeName: "",
    recipientName: "",
    recipientPhone: "",
    recipientAddress: "",
    remark: "",
    skuCode: "",
    skuName: "",
    skuSpec: "",
    quantity: "1",
    sourceRowId: "manual",
  };
}

export function ImportWorkbench({ rules }: ImportWorkbenchProps) {
  const [selectedRuleId, setSelectedRuleId] = useState(rules[0]?.id ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [editableRows, setEditableRows] = useState<EditableShipmentRow[]>([]);
  const [suggestion, setSuggestion] = useState<SuggestionState>(null);
  const [commitResult, setCommitResult] = useState<{ successCount: number; failureCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingExternalCodes, setExistingExternalCodes] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const selectedRule = rules.find((rule) => rule.id === selectedRuleId);

  useEffect(() => {
    let active = true;

    void fetch("/api/shipments")
      .then(async (response) => {
        if (!response.ok) {
          return { shipments: [] };
        }
        return (await response.json()) as { shipments?: Array<{ externalCode?: string }> };
      })
      .then((data) => {
        if (!active) {
          return;
        }
        const codes = (data.shipments ?? [])
          .map((shipment) => shipment.externalCode?.trim())
          .filter((value): value is string => Boolean(value));
        setExistingExternalCodes(codes);
      })
      .catch(() => {
        if (active) {
          setExistingExternalCodes([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const rowIssues = useMemo(
    () => detectShipmentRowIssues(editableRows, existingExternalCodes),
    [editableRows, existingExternalCodes],
  );

  const blockingIssues = rowIssues.filter((issue) => issue.severity === "error");
  const selectedRuleName = selectedRule?.name ?? "未选择规则";

  function ensureFileSelected(message: string) {
    if (!selectedFile) {
      setError(message);
      return false;
    }

    return true;
  }

  function handlePreview() {
    if (!ensureFileSelected("请选择文件后再试解析") || !selectedRuleId) {
      return;
    }

    setError(null);
    startTransition(async () => {
      if (!selectedFile) {
        return;
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("ruleId", selectedRuleId);

      const response = await fetch("/api/imports/preview", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "试解析失败");
        return;
      }

      const nextPreview = {
        shipments: data.shipments as ShipmentDraft[],
        issues: data.issues as ValidationIssue[],
      };

      setPreview(nextPreview);
      setEditableRows(buildEditableRows(nextPreview.shipments));
      setCommitResult(null);
    });
  }

  function handleSuggestRule() {
    if (!ensureFileSelected("请选择文件后再生成 AI 规则建议")) {
      return;
    }

    setError(null);
    startTransition(async () => {
      if (!selectedFile) {
        return;
      }

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/rules/suggest", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "AI 规则建议生成失败");
        return;
      }

      setSuggestion({
        confidenceByField: data.confidenceByField ?? {},
        assumptions: data.assumptions ?? [],
        unknowns: data.unknowns ?? [],
      });
    });
  }

  function updateCell(rowId: string, field: RowField, value: string) {
    setEditableRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  }

  function addRow() {
    setEditableRows((current) => [...current, createEmptyRow()]);
  }

  function deleteRow(rowId: string) {
    setEditableRows((current) => current.filter((row) => row.id !== rowId));
  }

  function exportRows() {
    if (editableRows.length === 0) {
      setError("当前没有可导出的预览数据");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(
      editableRows.map((row) => ({
        外部编码: row.externalCode,
        收货门店: row.storeName,
        收件人: row.recipientName,
        联系电话: row.recipientPhone,
        收货地址: row.recipientAddress,
        备注: row.remark,
        SKU编码: row.skuCode,
        SKU名称: row.skuName,
        规格: row.skuSpec,
        数量: row.quantity,
      })),
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "预览结果");
    XLSX.writeFile(workbook, "万能导入预览.xlsx");
  }

  function handleCommit() {
    if (editableRows.length === 0) {
      setError("请先完成试解析预览");
      return;
    }

    if (blockingIssues.length > 0) {
      setError("请先修复表格中的校验错误后再提交");
      return;
    }

    setError(null);
    startTransition(async () => {
      const shipments = applyRowsToShipments(editableRows);
      const response = await fetch("/api/imports/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shipments }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "提交下单失败");
        return;
      }

      setCommitResult({
        successCount: data.successCount,
        failureCount: data.failureCount,
      });

      const codes = shipments
        .map((shipment) => shipment.externalCode?.trim())
        .filter((value): value is string => Boolean(value));
      setExistingExternalCodes((current) => Array.from(new Set([...current, ...codes])));
    });
  }

  const groupedIssues = editableRows.map((row) => ({
    rowId: row.id,
    issues: rowIssues.filter((issue) => issue.rowKey === row.id),
  }));

  return (
    <section className="grid gap-6">
      <div className="rounded-[28px] border border-[#c6eceb] bg-white/90 p-6 shadow-[0_16px_40px_rgba(15,198,194,0.12)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0b8f8c]">Import</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#153436]">上传文件并手动选择规则</h2>
          </div>
          <span className="rounded-full bg-[#e8fafa] px-3 py-1 text-xs font-medium text-[#0b6e6e]">
            真实附件已接入
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-[#214447]">
              解析规则
              <select
                id="ruleId"
                className="rounded-2xl border border-[#b7dfde] bg-[#f8ffff] px-4 py-3 text-sm text-[#153436] outline-none transition focus:border-[#0fc6c2]"
                name="ruleId"
                value={selectedRuleId}
                onChange={(event) => setSelectedRuleId(event.target.value)}
              >
                {rules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-[#214447]">
              上传文件
              <input
                id="sourceFile"
                className="rounded-2xl border border-dashed border-[#8ad8d6] bg-[#f8ffff] px-4 py-5 text-sm text-[#153436]"
                name="sourceFile"
                type="file"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ActionButton disabled={isPending} onClick={handlePreview} primary>
                {isPending ? "试解析中..." : "试解析预览"}
              </ActionButton>
              <ActionButton disabled={isPending} onClick={handleSuggestRule}>
                {isPending ? "AI 分析中..." : "AI 规则建议"}
              </ActionButton>
              <ActionButton disabled={editableRows.length === 0} onClick={exportRows}>
                导出预览
              </ActionButton>
              <ActionButton
                disabled={isPending || editableRows.length === 0 || blockingIssues.length > 0}
                onClick={handleCommit}
                primary
              >
                {isPending ? "提交中..." : "提交下单"}
              </ActionButton>
            </div>
          </div>

          <div className="rounded-[24px] bg-[#f6fbfb] p-4 text-sm text-[#335b60]">
            <p className="font-semibold text-[#153436]">{selectedRuleName}</p>
            <p className="mt-1">{selectedRule?.description ?? "请选择一条规则执行试解析。"}</p>
            <div className="mt-4 grid gap-2 text-xs text-[#557679]">
              <p>当前预览行数：{editableRows.length}</p>
              <p>校验错误：{blockingIssues.length}</p>
              <p>重复预警：{rowIssues.filter((issue) => issue.severity === "warning").length}</p>
            </div>

            {suggestion ? (
              <div className="mt-4 rounded-2xl border border-[#d2eceb] bg-[#fbfefe] p-4 text-sm text-[#335b60]">
                <p className="font-semibold text-[#153436]">AI 推荐结果</p>
                <p className="mt-2">
                  高置信字段数：
                  {Object.values(suggestion.confidenceByField).filter((value) => value >= 0.85).length}
                </p>
                <p className="mt-2">假设：{suggestion.assumptions.join("；") || "暂无"}</p>
                <p className="mt-2">待确认：{suggestion.unknowns.join("；") || "暂无"}</p>
              </div>
            ) : null}

            {commitResult ? (
              <div className="mt-4 rounded-2xl border border-[#bfe7d1] bg-[#f3fff7] px-4 py-3 text-sm text-[#2a7458]">
                提交完成：成功 {commitResult.successCount} 条，失败 {commitResult.failureCount} 条。
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-2xl border border-[#f3b3b3] bg-[#fff4f4] px-4 py-3 text-sm text-[#a34040]">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-[#c6eceb] bg-white/90 p-6 shadow-[0_16px_40px_rgba(15,198,194,0.12)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0b8f8c]">Preview</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#153436]">结构化运单预览</h2>
          </div>
          <div className="flex gap-2">
            <ActionButton disabled={isPending} onClick={addRow}>
              新增空行
            </ActionButton>
          </div>
        </div>

        {!preview && editableRows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#c6eceb] bg-[#f9fefe] p-8 text-center text-sm text-[#5c7a7d]">
            上传文件后，这里会展示结构化运单与可编辑预览表格。
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="解析运单数" value={String(preview?.shipments.length ?? 0)} />
              <MetricCard label="可编辑行数" value={String(editableRows.length)} />
              <MetricCard label="校验问题" value={String(rowIssues.length)} />
            </div>

            {rowIssues.length > 0 ? (
              <div className="rounded-2xl border border-[#ead9af] bg-[#fffaf0] px-4 py-3 text-sm text-[#8a641c]">
                <p className="font-semibold text-[#7a5612]">全量校验结果</p>
                <ul className="mt-2 grid gap-1">
                  {rowIssues.map((issue) => (
                    <li key={`${issue.rowKey}-${issue.field}-${issue.message}`}>
                      {issue.rowKey} · {issue.field} · {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[24px] border border-[#d6eceb]">
              <div className="max-h-[540px] overflow-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-[#eefafa]">
                    <tr>
                      <th className="border-b border-[#d6eceb] px-3 py-3 text-left font-semibold text-[#0b6e6e]">
                        操作
                      </th>
                      {editableColumns.map((column) => (
                        <th
                          key={column.key}
                          className={`border-b border-[#d6eceb] px-3 py-3 text-left font-semibold text-[#0b6e6e] ${column.width ?? ""}`}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {editableRows.map((row) => {
                      const issuesForRow = groupedIssues.find((entry) => entry.rowId === row.id)?.issues ?? [];
                      return (
                        <tr key={row.id} className="border-b border-[#edf4f4] align-top">
                          <td className="px-3 py-3">
                            <button
                              className="rounded-xl border border-[#d7e7e6] px-3 py-2 text-xs font-medium text-[#7d4d4d] hover:bg-[#fff4f4]"
                              onClick={() => deleteRow(row.id)}
                              type="button"
                            >
                              删除行
                            </button>
                          </td>
                          {editableColumns.map((column) => {
                            const fieldIssues = issuesForRow.filter(
                              (issue) => issue.field === column.key || issue.field === "recipientGroup",
                            );
                            const hasError = fieldIssues.some((issue) => issue.severity === "error");
                            const hasWarning = fieldIssues.some((issue) => issue.severity === "warning");

                            return (
                              <td key={`${row.id}-${column.key}`} className="px-3 py-3">
                                <input
                                  className={[
                                    "w-full rounded-xl border bg-[#fbffff] px-3 py-2 text-sm text-[#153436] outline-none transition",
                                    hasError
                                      ? "border-[#ef9a9a] bg-[#fff5f5] focus:border-[#d34b4b]"
                                      : hasWarning
                                        ? "border-[#f0cf84] bg-[#fffaf0] focus:border-[#d39e1d]"
                                        : "border-[#d2e7e6] focus:border-[#0fc6c2]",
                                  ].join(" ")}
                                  value={row[column.key]}
                                  onChange={(event) => updateCell(row.id, column.key, event.target.value)}
                                />
                                {fieldIssues.length > 0 ? (
                                  <div className="mt-1 space-y-1 text-xs">
                                    {fieldIssues.map((issue) => (
                                      <p
                                        key={`${issue.rowKey}-${issue.field}-${issue.message}`}
                                        className={issue.severity === "error" ? "text-[#b24747]" : "text-[#9d7620]"}
                                      >
                                        {issue.message}
                                      </p>
                                    ))}
                                  </div>
                                ) : null}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ActionButton({
  children,
  disabled = false,
  onClick,
  primary = false,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition",
        primary
          ? "bg-[#0fc6c2] text-white hover:bg-[#0badaa] disabled:bg-[#7bdad7]"
          : "border border-[#0fc6c2] bg-white text-[#0b8f8c] hover:bg-[#f2fbfb] disabled:border-[#9adedd] disabled:text-[#8abcbc]",
        "disabled:cursor-not-allowed",
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f7fefe] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[#6b9496]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#153436]">{value}</p>
    </div>
  );
}
