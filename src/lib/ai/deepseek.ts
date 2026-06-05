import { z } from "zod";
import { sampleRules } from "@/lib/domain/sample-rules";
import type {
  DocumentSnapshotSummary,
  ImportRuleDefinition,
  RuleSuggestionResult,
} from "@/lib/domain/types";
import { importRuleDefinitionSchema } from "@/lib/rules/schema";

const deepSeekRuleSuggestionSchema = z.object({
  suggestedRule: importRuleDefinitionSchema,
  confidenceByField: z.record(z.string(), z.number().min(0).max(1)).default({}),
  assumptions: z.array(z.string()).default([]),
  unknowns: z.array(z.string()).default([]),
});

function cloneDefinition(definition: ImportRuleDefinition): ImportRuleDefinition {
  return JSON.parse(JSON.stringify(definition)) as ImportRuleDefinition;
}

function inferRuleFromSummary(summary: DocumentSnapshotSummary): ImportRuleDefinition {
  const previewText = summary.previewLines.join("\n");

  if (summary.kind === "pdf") {
    return cloneDefinition(sampleRules.find((rule) => rule.id === "pdf-delivery-text")!.definition);
  }

  if (summary.sheetNames.length > 1) {
    return cloneDefinition(sampleRules.find((rule) => rule.id === "multi-sheet-footer-excel")!.definition);
  }

  if (previewText.includes("调拨记录")) {
    return cloneDefinition(sampleRules.find((rule) => rule.id === "card-transfer-excel")!.definition);
  }

  if (previewText.includes("配送汇总单号")) {
    return cloneDefinition(sampleRules.find((rule) => rule.id === "hunan-grouped-excel")!.definition);
  }

  return cloneDefinition(sampleRules.find((rule) => rule.id === "haikou-footer-excel")!.definition);
}

function createFallbackSuggestion(
  summary: DocumentSnapshotSummary,
  reason?: string,
): RuleSuggestionResult {
  const suggestedRule = inferRuleFromSummary(summary);
  const assumptions = [
    "已按文档结构特征推荐最接近的规则模板。",
    "低置信字段建议在保存前通过试解析预览确认。",
  ];

  if (reason) {
    assumptions.unshift(`AI 建议暂不可用，已回退到本地规则推断：${reason}`);
  }

  return {
    suggestedRule,
    confidenceByField: {
      externalCode: 0.88,
      storeName: 0.92,
      recipientName: 0.83,
      recipientPhone: 0.8,
      recipientAddress: 0.78,
      items: 0.94,
    },
    assumptions,
    unknowns:
      summary.kind === "docx"
        ? ["当前还没有真实 Word 样例，建议保存前人工复核文本规则。"]
        : [],
  };
}

function buildPrompt(summary: DocumentSnapshotSummary) {
  return [
    "你是一个物流导入规则生成器。",
    "请根据文档摘要输出 JSON，不要输出 markdown，不要输出额外解释。",
    "JSON 必须包含 suggestedRule、confidenceByField、assumptions、unknowns。",
    "suggestedRule 需要满足 DSL 结构：source、segment、table、transforms、output。",
    "仅推荐规则，不要生成运单结果。",
    "如果字段不确定，写入 unknowns，并降低对应 confidenceByField。",
    "",
    `文件名: ${summary.fileName}`,
    `文档类型: ${summary.kind}`,
    `Sheet 名称: ${summary.sheetNames.join(", ") || "无"}`,
    `页数: ${summary.pageCount}`,
    "预览行:",
    ...summary.previewLines.map((line, index) => `${index + 1}. ${line}`),
  ].join("\n");
}

async function requestDeepSeekSuggestion(summary: DocumentSnapshotSummary): Promise<RuleSuggestionResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("missing DEEPSEEK_API_KEY");
  }

  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是规则驱动导入系统的 DSL 设计助手。你的唯一任务是返回可直接解析的 JSON 对象。",
        },
        {
          role: "user",
          content: buildPrompt(summary),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("DeepSeek response did not contain JSON content");
  }

  const parsedContent = JSON.parse(content) as unknown;
  const validated = deepSeekRuleSuggestionSchema.safeParse(parsedContent);
  if (!validated.success) {
    throw new Error(`DeepSeek JSON validation failed: ${validated.error.issues[0]?.message ?? "unknown error"}`);
  }

  return validated.data satisfies RuleSuggestionResult;
}

export async function suggestRuleFromDocumentSummary(
  summary: DocumentSnapshotSummary,
): Promise<RuleSuggestionResult> {
  if (!process.env.DEEPSEEK_API_KEY) {
    return createFallbackSuggestion(summary);
  }

  try {
    return await requestDeepSeekSuggestion(summary);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown DeepSeek error";
    return createFallbackSuggestion(summary, reason);
  }
}
