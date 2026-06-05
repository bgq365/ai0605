import type { DocumentSnapshot, ImportRuleDefinition } from "@/lib/domain/types";
import { validateShipmentDrafts } from "@/lib/shipments/validation";
import { previewImport } from "@/lib/imports/preview";

export async function previewImportFromSnapshot(snapshot: DocumentSnapshot, ruleDefinition: ImportRuleDefinition) {
  const result = await previewImport({
    filePath: "",
    rule: {
      id: "inline-rule",
      name: "Inline Rule",
      description: "Temporary rule execution",
      documentKind: snapshot.kind,
      definition: ruleDefinition,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    snapshot,
  });

  return {
    shipments: result.shipments,
    issues: validateShipmentDrafts(result.shipments),
  };
}
