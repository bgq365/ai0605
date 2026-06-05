import { randomUUID } from "node:crypto";
import { sampleRules } from "@/lib/domain/sample-rules";
import type { ImportRule, ImportRuleDefinition } from "@/lib/domain/types";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

const rules = new Map<string, ImportRule>(
  sampleRules.map((rule) => [
    rule.id,
    {
      ...rule,
      definition: JSON.parse(JSON.stringify(rule.definition)) as ImportRuleDefinition,
    },
  ]),
);

function sortRules(items: ImportRule[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listRules() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return sortRules(Array.from(rules.values()));
  }

  const { data, error } = await supabase.from("import_rules").select("*").order("created_at", { ascending: false });
  if (error || !data) {
    return sortRules(Array.from(rules.values()));
  }

  return sortRules(
    data.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      description: String(row.description ?? ""),
      documentKind: row.document_kind as ImportRule["documentKind"],
      definition: row.definition_json as ImportRuleDefinition,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })),
  );
}

export async function getRuleById(id: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return rules.get(id) ?? null;
  }

  const { data, error } = await supabase.from("import_rules").select("*").eq("id", id).single();
  if (error || !data) {
    return rules.get(id) ?? null;
  }

  return {
    id: String(data.id),
    name: String(data.name),
    description: String(data.description ?? ""),
    documentKind: data.document_kind as ImportRule["documentKind"],
    definition: data.definition_json as ImportRuleDefinition,
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  } satisfies ImportRule;
}

export async function createRule(input: Omit<ImportRule, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const rule: ImportRule = {
    ...input,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("import_rules")
      .insert({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        document_kind: rule.documentKind,
        definition_json: rule.definition,
        created_at: rule.createdAt,
        updated_at: rule.updatedAt,
      })
      .select("*")
      .single();

    if (!error && data) {
      return {
        id: String(data.id),
        name: String(data.name),
        description: String(data.description ?? ""),
        documentKind: data.document_kind as ImportRule["documentKind"],
        definition: data.definition_json as ImportRuleDefinition,
        createdAt: String(data.created_at),
        updatedAt: String(data.updated_at),
      } satisfies ImportRule;
    }
  }

  rules.set(rule.id, rule);
  return rule;
}

export async function updateRule(id: string, patch: Partial<Omit<ImportRule, "id" | "createdAt">>) {
  const current = await getRuleById(id);
  if (!current) {
    return null;
  }
  const next: ImportRule = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("import_rules")
      .update({
        name: next.name,
        description: next.description,
        document_kind: next.documentKind,
        definition_json: next.definition,
        updated_at: next.updatedAt,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (!error && data) {
      return {
        id: String(data.id),
        name: String(data.name),
        description: String(data.description ?? ""),
        documentKind: data.document_kind as ImportRule["documentKind"],
        definition: data.definition_json as ImportRuleDefinition,
        createdAt: String(data.created_at),
        updatedAt: String(data.updated_at),
      } satisfies ImportRule;
    }
  }

  rules.set(id, next);
  return next;
}

export async function deleteRule(id: string) {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { error } = await supabase.from("import_rules").delete().eq("id", id);
    if (!error) {
      return true;
    }
  }

  return rules.delete(id);
}
