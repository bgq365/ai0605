import { z } from "zod";
import type { ImportRuleDefinition } from "@/lib/domain/types";

const footerExtractorSchema = z.object({
  label: z.string().min(1),
  targetField: z.string().min(1),
  strategy: z.enum(["adjacentCell", "sameRowByLabel"]),
});

const transformSchema = z.object({
  type: z.enum([
    "skipLeadingRows",
    "locateHeaderRow",
    "readTabularRows",
    "ignoreSummaryRows",
    "extractFooterKeyValues",
    "groupRowsByField",
    "mergeSharedFields",
    "iterateSheets",
    "segmentCardsByMarker",
    "extractTextByRegex",
    "pivotMatrixColumns",
    "explodeMultiLineCell",
    "splitPdfBySeparator",
    "staticValue",
    "defaultValue",
  ]),
  options: z.record(z.string(), z.unknown()).optional(),
});

const importRuleDefinitionSchema = z.object({
  source: z.object({
    mode: z.enum(["excelSheets", "pdfPages", "docxParagraphs"]),
  }),
  segment: z.object({
    mode: z.enum(["wholeSheet", "perSheet", "cardBlocks", "pdfSingle", "textBlocks"]),
    marker: z.string().optional(),
  }),
  table: z.object({
    headerRow: z.number().int().positive().optional(),
    dataStartRow: z.number().int().positive().optional(),
    dataEndRow: z.number().int().positive().optional(),
    skipRowsContaining: z.array(z.string()).optional(),
    columnMap: z.record(z.string(), z.union([z.string(), z.number().int().positive()])).optional(),
    footerRowStart: z.number().int().positive().optional(),
    footerExtractors: z.array(footerExtractorSchema).optional(),
  }),
  transforms: z.array(transformSchema),
  output: z.object({
    groupingField: z.string().optional(),
    fields: z.record(z.string(), z.string()),
    itemFields: z.record(z.string(), z.string()),
  }),
});

export function validateImportRuleDefinition(definition: ImportRuleDefinition) {
  return importRuleDefinitionSchema.safeParse(definition);
}

export { importRuleDefinitionSchema };
