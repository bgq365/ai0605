import { sampleRules } from "@/lib/domain/sample-rules";
import type {
  DocumentSnapshotSummary,
  ImportRuleDefinition,
  RuleSuggestionResult,
} from "@/lib/domain/types";

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

  if (previewText.includes("▶ 调拨记录")) {
    return cloneDefinition(sampleRules.find((rule) => rule.id === "card-transfer-excel")!.definition);
  }

  if (previewText.includes("配送汇总单号")) {
    return cloneDefinition(sampleRules.find((rule) => rule.id === "hunan-grouped-excel")!.definition);
  }

  return cloneDefinition(sampleRules.find((rule) => rule.id === "haikou-footer-excel")!.definition);
}

export async function suggestRuleFromDocumentSummary(
  summary: DocumentSnapshotSummary,
): Promise<RuleSuggestionResult> {
  const suggestedRule = inferRuleFromSummary(summary);

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
    assumptions: [
      "已按文档结构特征推荐最接近的规则模板",
      "低置信度字段建议在保存前通过试解析确认",
    ],
    unknowns: summary.kind === "docx" ? ["当前未提供真实 Word 样例，建议人工复核文本规则"] : [],
  };
}
