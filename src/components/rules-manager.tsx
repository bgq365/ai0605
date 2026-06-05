"use client";

import { useMemo, useState, useTransition } from "react";
import type { DocumentKind, ImportRule, ImportRuleDefinition, ShipmentDraft, ValidationIssue } from "@/lib/domain/types";

type RulesManagerProps = {
  initialRules: ImportRule[];
};

type RuleTestResult = {
  shipments: ShipmentDraft[];
  issues: ValidationIssue[];
} | null;

const emptyDefinition = JSON.stringify(
  {
    source: { mode: "excelSheets" },
    segment: { mode: "wholeSheet" },
    table: {},
    transforms: [],
    output: { fields: {}, itemFields: {} },
  } satisfies ImportRuleDefinition,
  null,
  2,
);

function cloneRule(rule: ImportRule) {
  return {
    ...rule,
    definition: JSON.parse(JSON.stringify(rule.definition)) as ImportRuleDefinition,
  };
}

export function RulesManager({ initialRules }: RulesManagerProps) {
  const [rules, setRules] = useState(initialRules.map(cloneRule));
  const [selectedId, setSelectedId] = useState(initialRules[0]?.id ?? "");
  const [name, setName] = useState(initialRules[0]?.name ?? "");
  const [description, setDescription] = useState(initialRules[0]?.description ?? "");
  const [documentKind, setDocumentKind] = useState<DocumentKind>(initialRules[0]?.documentKind ?? "excel");
  const [definitionText, setDefinitionText] = useState(
    initialRules[0] ? JSON.stringify(initialRules[0].definition, null, 2) : emptyDefinition,
  );
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [testResult, setTestResult] = useState<RuleTestResult>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedRule = useMemo(
    () => rules.find((rule) => rule.id === selectedId) ?? null,
    [rules, selectedId],
  );

  function loadRule(rule: ImportRule) {
    setSelectedId(rule.id);
    setName(rule.name);
    setDescription(rule.description);
    setDocumentKind(rule.documentKind);
    setDefinitionText(JSON.stringify(rule.definition, null, 2));
    setTestResult(null);
    setMessage(null);
    setError(null);
  }

  function startNewRule(copyCurrent = false) {
    if (copyCurrent && selectedRule) {
      setSelectedId("");
      setName(`${selectedRule.name} - 副本`);
      setDescription(selectedRule.description);
      setDocumentKind(selectedRule.documentKind);
      setDefinitionText(JSON.stringify(selectedRule.definition, null, 2));
      setMessage("已复制当前规则，请确认后保存。");
      setError(null);
      setTestResult(null);
      return;
    }

    setSelectedId("");
    setName("");
    setDescription("");
    setDocumentKind("excel");
    setDefinitionText(emptyDefinition);
    setMessage("已创建空白规则草稿。");
    setError(null);
    setTestResult(null);
  }

  async function saveRule() {
    let definition: ImportRuleDefinition;
    try {
      definition = JSON.parse(definitionText) as ImportRuleDefinition;
    } catch {
      setError("规则 JSON 解析失败，请先修正格式。");
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        documentKind,
        definition,
      };

      const response = await fetch(selectedId ? `/api/rules/${selectedId}` : "/api/rules", {
        method: selectedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "规则保存失败");
        return;
      }

      const nextRule = data as ImportRule;
      setRules((current) => {
        const exists = current.some((rule) => rule.id === nextRule.id);
        return exists
          ? current.map((rule) => (rule.id === nextRule.id ? cloneRule(nextRule) : rule))
          : [...current, cloneRule(nextRule)];
      });
      loadRule(nextRule);
      setMessage(selectedId ? "规则更新成功。" : "规则创建成功。");
    });
  }

  function deleteRuleById(id: string) {
    startTransition(async () => {
      const response = await fetch(`/api/rules/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "规则删除失败");
        return;
      }

      const nextRules = rules.filter((rule) => rule.id !== id);
      setRules(nextRules);
      if (selectedId === id) {
        if (nextRules[0]) {
          loadRule(nextRules[0]);
        } else {
          startNewRule();
        }
      }
      setMessage("规则删除成功。");
    });
  }

  function testCurrentRule() {
    if (!sampleFile) {
      setError("请先上传一份样例文件再执行试解析。");
      return;
    }

    let parsed: ImportRuleDefinition;
    try {
      parsed = JSON.parse(definitionText) as ImportRuleDefinition;
    } catch {
      setError("规则 JSON 解析失败，请先修正格式。");
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", sampleFile);
      formData.append("ruleDefinition", JSON.stringify(parsed));

      const response = await fetch("/api/rules/test", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "试解析失败");
        return;
      }

      setTestResult(data as RuleTestResult);
      setMessage("试解析完成，可根据结果继续微调规则。");
    });
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[28px] border border-[#c6eceb] bg-white/90 p-6 shadow-[0_16px_40px_rgba(15,198,194,0.12)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0b8f8c]">Rules</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#153436]">规则列表</h2>
          </div>
          <button
            className="rounded-2xl bg-[#0fc6c2] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => startNewRule(false)}
            type="button"
          >
            新建规则
          </button>
        </div>

        <div className="grid gap-3">
          {rules.map((rule) => (
            <article
              key={rule.id}
              className={[
                "rounded-[24px] border p-4 transition",
                selectedId === rule.id
                  ? "border-[#0fc6c2] bg-[#f4ffff] shadow-[0_12px_28px_rgba(15,198,194,0.12)]"
                  : "border-[#d6eceb] bg-white",
              ].join(" ")}
            >
              <button className="w-full text-left" onClick={() => loadRule(rule)} type="button">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#153436]">{rule.name}</h3>
                    <p className="mt-1 text-sm text-[#557679]">{rule.description}</p>
                  </div>
                  <span className="rounded-full bg-[#e8fafa] px-3 py-1 text-xs font-medium text-[#0b6e6e]">
                    {rule.documentKind}
                  </span>
                </div>
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-xl border border-[#d5e8e7] px-3 py-2 text-xs" onClick={() => loadRule(rule)} type="button">
                  编辑
                </button>
                <button className="rounded-xl border border-[#d5e8e7] px-3 py-2 text-xs" onClick={() => {
                  loadRule(rule);
                  startNewRule(true);
                }} type="button">
                  复制
                </button>
                <button
                  className="rounded-xl border border-[#f0d1d1] px-3 py-2 text-xs text-[#934a4a]"
                  onClick={() => deleteRuleById(rule.id)}
                  type="button"
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-[#c6eceb] bg-white/90 p-6 shadow-[0_16px_40px_rgba(15,198,194,0.12)]">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0b8f8c]">Editor</p>
        <h2 className="mt-2 text-2xl font-semibold text-[#153436]">
          {selectedId ? "编辑解析规则" : "新建解析规则"}
        </h2>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-[#214447]">
            规则名称
            <input
              className="rounded-2xl border border-[#d2e7e6] bg-[#fbffff] px-4 py-3 outline-none focus:border-[#0fc6c2]"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-[#214447]">
            规则说明
            <input
              className="rounded-2xl border border-[#d2e7e6] bg-[#fbffff] px-4 py-3 outline-none focus:border-[#0fc6c2]"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-[#214447]">
            文档类型
            <select
              className="rounded-2xl border border-[#d2e7e6] bg-[#fbffff] px-4 py-3 outline-none focus:border-[#0fc6c2]"
              value={documentKind}
              onChange={(event) => setDocumentKind(event.target.value as DocumentKind)}
            >
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
              <option value="docx">Word</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-[#214447]">
            规则 JSON DSL
            <textarea
              className="min-h-[300px] rounded-3xl border border-[#d2e7e6] bg-[#fbffff] px-4 py-4 font-mono text-sm outline-none focus:border-[#0fc6c2]"
              value={definitionText}
              onChange={(event) => setDefinitionText(event.target.value)}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <label className="grid gap-2 text-sm font-medium text-[#214447]">
              试解析样例文件
              <input
                className="rounded-2xl border border-dashed border-[#8ad8d6] bg-[#f8ffff] px-4 py-5 text-sm text-[#153436]"
                type="file"
                onChange={(event) => setSampleFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button
              className="rounded-2xl border border-[#0fc6c2] bg-white px-4 py-3 text-sm font-semibold text-[#0b8f8c] self-end"
              disabled={isPending}
              onClick={testCurrentRule}
              type="button"
            >
              试解析预览
            </button>
            <button
              className="rounded-2xl bg-[#0fc6c2] px-4 py-3 text-sm font-semibold text-white self-end"
              disabled={isPending}
              onClick={() => void saveRule()}
              type="button"
            >
              {selectedId ? "保存修改" : "创建规则"}
            </button>
          </div>

          {message ? (
            <div className="rounded-2xl border border-[#bfe7d1] bg-[#f3fff7] px-4 py-3 text-sm text-[#2a7458]">{message}</div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-[#f3b3b3] bg-[#fff4f4] px-4 py-3 text-sm text-[#a34040]">{error}</div>
          ) : null}

          {testResult ? (
            <div className="rounded-3xl border border-[#d7eceb] bg-[#fbffff] p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <MetricCard label="解析运单数" value={String(testResult.shipments.length)} />
                <MetricCard label="校验问题" value={String(testResult.issues.length)} />
              </div>
              <div className="mt-4 space-y-3">
                {testResult.shipments.map((shipment, index) => (
                  <article key={`${shipment.externalCode ?? "shipment"}-${index}`} className="rounded-2xl border border-[#e1eded] bg-white p-4">
                    <p className="font-semibold text-[#153436]">
                      {shipment.storeName || shipment.recipientName || "未命名运单"}
                    </p>
                    <p className="mt-1 text-sm text-[#557679]">
                      {shipment.externalCode || "无外部编码"} · {shipment.items.length} 个 SKU
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
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
