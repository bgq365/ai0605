import { describe, expect, it } from "vitest";
import { sampleRules } from "@/lib/domain/sample-rules";
import { validateImportRuleDefinition } from "@/lib/rules/schema";

describe("import rule schema", () => {
  it("includes seed rules for the current five real fixtures", () => {
    expect(sampleRules).toHaveLength(5);
  });

  it("validates all seed rule definitions", () => {
    for (const rule of sampleRules) {
      const result = validateImportRuleDefinition(rule.definition);
      expect(result.success).toBe(true);
    }
  });
});
