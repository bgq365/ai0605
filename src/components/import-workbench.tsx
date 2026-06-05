"use client";

import { useState, useTransition } from "react";
import type { ImportRule, ShipmentDraft, ValidationIssue } from "@/lib/domain/types";

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

export function ImportWorkbench({ rules }: ImportWorkbenchProps) {
  const [selectedRuleId, setSelectedRuleId] = useState(rules[0]?.id ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestionState>(null);
  const [commitResult, setCommitResult] = useState<{ successCount: number; failureCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedRule = rules.find((rule) => rule.id === selectedRuleId);

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

      setPreview({
        shipments: data.shipments,
        issues: data.issues,
      });
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

  function handleCommit() {
    if (!preview) {
      setError("请先完成试解析预览");
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/imports/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shipments: preview.shipments }),
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
    });
  }

  const blockingIssues = preview?.issues.filter((issue) => issue.severity === "error").length ?? 0;
  const highConfidenceCount = suggestion
    ? Object.values(suggestion.confidenceByField).filter((value) => value >= 0.85).length
    : 0;

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[28px] border border-[#c6eceb] bg-white/90 p-6 shadow-[0_16px_40px_rgba(15,198,194,0.12)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0b8f8c]">Import</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#153436]">上传文件并手动选择规则</h2>
          </div>
          <span className="rounded-full bg-[#e8fafa] px-3 py-1 text-xs font-medium text-[#0b6e6e]">
            真实附件已接入
          </span>
        </div>

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

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="inline-flex items-center justify-center rounded-2xl bg-[#0fc6c2] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0badaa] disabled:cursor-not-allowed disabled:bg-[#7bdad7]"
              disabled={isPending}
              onClick={handlePreview}
              type="button"
            >
              {isPending ? "试解析中..." : "试解析预览"}
            </button>

            <button
              className="inline-flex items-center justify-center rounded-2xl border border-[#0fc6c2] bg-white px-4 py-3 text-sm font-semibold text-[#0b8f8c] transition hover:bg-[#f2fbfb] disabled:cursor-not-allowed disabled:border-[#9adedd] disabled:text-[#8abcbc]"
              disabled={isPending}
              onClick={handleSuggestRule}
              type="button"
            >
              {isPending ? "AI 分析中..." : "AI 规则建议"}
            </button>
          </div>
        </div>

        {selectedRule ? (
          <div className="mt-6 rounded-2xl bg-[#f6fbfb] p-4 text-sm text-[#335b60]">
            <p className="font-semibold text-[#153436]">{selectedRule.name}</p>
            <p className="mt-1">{selectedRule.description}</p>
          </div>
        ) : null}

        {suggestion ? (
          <div className="mt-4 rounded-2xl border border-[#d2eceb] bg-[#fbfefe] p-4 text-sm text-[#335b60]">
            <p className="font-semibold text-[#153436]">AI 推荐结果</p>
            <p className="mt-2">高置信字段数：{highConfidenceCount}</p>
            <p className="mt-2">假设：{suggestion.assumptions.join("；") || "暂无"}</p>
            <p className="mt-2">待确认：{suggestion.unknowns.join("；") || "暂无"}</p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-[#f3b3b3] bg-[#fff4f4] px-4 py-3 text-sm text-[#a34040]">
            {error}
          </div>
        ) : null}

        {commitResult ? (
          <div className="mt-4 rounded-2xl border border-[#bfe7d1] bg-[#f3fff7] px-4 py-3 text-sm text-[#2a7458]">
            提交完成：成功 {commitResult.successCount} 条，失败 {commitResult.failureCount} 条。
          </div>
        ) : null}
      </div>

      <div className="rounded-[28px] border border-[#c6eceb] bg-white/90 p-6 shadow-[0_16px_40px_rgba(15,198,194,0.12)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0b8f8c]">Preview</p>
        <h2 className="mt-2 text-2xl font-semibold text-[#153436]">结构化运单预览</h2>

        {preview ? (
          <div className="mt-5 grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="运单数" value={String(preview.shipments.length)} />
              <MetricCard label="校验问题" value={String(preview.issues.length)} />
            </div>

            <button
              className="inline-flex items-center justify-center rounded-2xl bg-[#153436] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1b4649] disabled:cursor-not-allowed disabled:bg-[#8ba6a8]"
              disabled={isPending || blockingIssues > 0}
              onClick={handleCommit}
              type="button"
            >
              {isPending ? "提交中..." : "提交下单"}
            </button>

            <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
              {preview.shipments.map((shipment, index) => (
                <article
                  key={`${shipment.externalCode ?? "shipment"}-${index}`}
                  className="rounded-2xl border border-[#d8eded] bg-[#fbfefe] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#153436]">
                        {shipment.storeName || shipment.recipientName || "未命名运单"}
                      </p>
                      <p className="mt-1 text-xs text-[#557679]">
                        {shipment.externalCode || "无外部编码"} · {shipment.recipientPhone || "待确认电话"}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#e8fafa] px-2.5 py-1 text-xs font-medium text-[#0b6e6e]">
                      {shipment.items.length} 个 SKU
                    </span>
                  </div>

                  <ul className="mt-3 space-y-2 text-sm text-[#335b60]">
                    {shipment.items.slice(0, 4).map((item) => (
                      <li key={`${item.skuCode}-${item.skuName}`} className="rounded-xl bg-white px-3 py-2">
                        <span className="font-medium text-[#153436]">{item.skuCode}</span> {item.skuName} x{" "}
                        {item.quantity}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-dashed border-[#c6eceb] bg-[#f9fefe] p-8 text-center text-sm text-[#5c7a7d]">
            上传文件后，这里会展示结构化运单与校验问题。
          </div>
        )}
      </div>
    </section>
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
