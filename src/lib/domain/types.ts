export type DocumentKind = "excel" | "pdf" | "docx";

export interface CellSnapshot {
  row: number;
  col: number;
  value: string;
}

export interface RowSnapshot {
  row: number;
  cells: CellSnapshot[];
}

export interface SheetSnapshot {
  name: string;
  rows: RowSnapshot[];
}

export interface PageSnapshot {
  index: number;
  text: string;
  lines: string[];
}

export interface DocumentSnapshot {
  kind: DocumentKind;
  fileName: string;
  sheets: SheetSnapshot[];
  pages: PageSnapshot[];
}

export interface DocumentSnapshotSummary {
  kind: DocumentKind;
  fileName: string;
  sheetNames: string[];
  pageCount: number;
  previewLines: string[];
}

export type RuleSourceMode = "excelSheets" | "pdfPages" | "docxParagraphs";
export type SegmentMode = "wholeSheet" | "perSheet" | "cardBlocks" | "pdfSingle" | "textBlocks";

export interface SourceConfig {
  mode: RuleSourceMode;
}

export interface SegmentConfig {
  mode: SegmentMode;
  marker?: string;
}

export interface TableConfig {
  headerRow?: number;
  dataStartRow?: number;
  dataEndRow?: number;
  skipRowsContaining?: string[];
  columnMap?: Record<string, string | number>;
  footerRowStart?: number;
  footerExtractors?: FooterExtractor[];
}

export interface FooterExtractor {
  label: string;
  targetField: string;
  strategy: "adjacentCell" | "sameRowByLabel";
}

export type TransformType =
  | "skipLeadingRows"
  | "locateHeaderRow"
  | "readTabularRows"
  | "ignoreSummaryRows"
  | "extractFooterKeyValues"
  | "groupRowsByField"
  | "mergeSharedFields"
  | "iterateSheets"
  | "segmentCardsByMarker"
  | "extractTextByRegex"
  | "pivotMatrixColumns"
  | "explodeMultiLineCell"
  | "splitPdfBySeparator"
  | "staticValue"
  | "defaultValue";

export interface TransformConfig {
  type: TransformType;
  options?: Record<string, unknown>;
}

export interface OutputConfig {
  groupingField?: string;
  fields: Record<string, string>;
  itemFields: Record<string, string>;
}

export interface ImportRuleDefinition {
  source: SourceConfig;
  segment: SegmentConfig;
  table: TableConfig;
  transforms: TransformConfig[];
  output: OutputConfig;
}

export interface ImportRule {
  id: string;
  name: string;
  description: string;
  documentKind: DocumentKind;
  definition: ImportRuleDefinition;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentItemDraft {
  skuCode: string;
  skuName: string;
  skuSpec?: string;
  quantity: number;
}

export interface ShipmentDraft {
  externalCode?: string;
  storeName?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  remark?: string;
  items: ShipmentItemDraft[];
  sourceRowIds: string[];
}

export interface ValidationIssue {
  rowKey: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface RuleSuggestionResult {
  suggestedRule: ImportRuleDefinition;
  confidenceByField: Record<string, number>;
  assumptions: string[];
  unknowns: string[];
}

export interface ImportBatch {
  id: string;
  fileName: string;
  ruleId?: string;
  status: "previewed" | "committed" | "failed";
  createdAt: string;
}
