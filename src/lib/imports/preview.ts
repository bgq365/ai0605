import type {
  DocumentSnapshot,
  ImportRule,
  ImportRuleDefinition,
  ShipmentDraft,
  ShipmentItemDraft,
  ValidationIssue,
} from "@/lib/domain/types";
import { createDocumentSnapshot } from "@/lib/documents/snapshot";
import { validateShipmentDrafts } from "@/lib/shipments/validation";

type PreviewImportParams = {
  filePath: string;
  rule: ImportRule;
  snapshot?: DocumentSnapshot;
};

type PreviewImportResult = {
  shipments: ShipmentDraft[];
  issues: ValidationIssue[];
};

type RowRecord = Record<string, string>;

type SegmentContext = {
  name: string;
  rows: string[][];
};

type ParsedSegment = {
  meta: Record<string, string>;
  rows: RowRecord[];
};

type MatrixPivotOptions = {
  storeColumns: string[];
  quantityField?: string;
  storeField?: string;
};

function rowsToMatrix(snapshot: DocumentSnapshot): SegmentContext[] {
  return snapshot.sheets.map((sheet) => ({
    name: sheet.name,
    rows: sheet.rows.map((row) => row.cells.map((cell) => cell.value)),
  }));
}

function firstNonEmptyRight(row: string[], startIndex: number) {
  for (let index = startIndex + 1; index < row.length; index += 1) {
    if ((row[index] ?? "").trim()) {
      return (row[index] ?? "").trim();
    }
  }

  return "";
}

function mapRowByHeader(header: string[], row: string[], columnMap: Record<string, string | number>): RowRecord {
  const mapped: RowRecord = {};

  for (const [target, source] of Object.entries(columnMap)) {
    if (typeof source === "number") {
      mapped[target] = row[source - 1] ?? "";
      continue;
    }

    const headerIndex = header.findIndex((label) => label.trim() === source.trim());
    mapped[target] = headerIndex >= 0 ? row[headerIndex] ?? "" : "";
  }

  return mapped;
}

function isSkippableRow(row: string[], skipTerms: string[] = []) {
  const joined = row.join(" ").trim();
  if (!joined) {
    return true;
  }

  return skipTerms.some((term) => joined.includes(term));
}

function parseWholeSheetSegment(segment: SegmentContext, definition: ImportRuleDefinition): ParsedSegment {
  const matrix = segment.rows;
  const headerRowIndex = (definition.table.headerRow ?? 1) - 1;
  const dataStartIndex = (definition.table.dataStartRow ?? definition.table.headerRow ?? 1) - 1;
  const dataEndIndex = definition.table.dataEndRow ? definition.table.dataEndRow - 1 : matrix.length - 1;
  const header = matrix[headerRowIndex] ?? [];
  const columnMap = definition.table.columnMap ?? {};
  const skipTerms = definition.table.skipRowsContaining ?? [];

  const rows: RowRecord[] = [];
  for (let rowIndex = dataStartIndex; rowIndex <= dataEndIndex; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    if (isSkippableRow(row, skipTerms)) {
      continue;
    }
    rows.push(mapRowByHeader(header, row, columnMap));
  }

  const meta: Record<string, string> = {};
  const footerStartIndex = definition.table.footerRowStart ? definition.table.footerRowStart - 1 : matrix.length;
  const footerRows = matrix.slice(footerStartIndex);

  for (const extractor of definition.table.footerExtractors ?? []) {
    for (const row of footerRows) {
      const labelIndex = row.findIndex((cell) => (cell ?? "").trim() === extractor.label.trim());
      if (labelIndex >= 0) {
        meta[extractor.targetField] =
          extractor.strategy === "adjacentCell" ? firstNonEmptyRight(row, labelIndex) : row[labelIndex] ?? "";
        break;
      }
    }
  }

  return { meta, rows };
}

function parseMatrixSegments(segment: SegmentContext, definition: ImportRuleDefinition): ParsedSegment[] {
  const matrix = segment.rows;
  const headerRowIndex = (definition.table.headerRow ?? 1) - 1;
  const dataStartIndex = (definition.table.dataStartRow ?? definition.table.headerRow ?? 1) - 1;
  const dataEndIndex = definition.table.dataEndRow ? definition.table.dataEndRow - 1 : matrix.length - 1;
  const header = matrix[headerRowIndex] ?? [];
  const columnMap = definition.table.columnMap ?? {};
  const transform = definition.transforms.find((item) => item.type === "pivotMatrixColumns");
  const options = (transform?.options ?? {}) as MatrixPivotOptions;
  const storeColumns = options.storeColumns ?? [];
  const quantityField = options.quantityField ?? "quantity";
  const storeField = options.storeField ?? "storeName";
  const rows: RowRecord[] = [];

  for (let rowIndex = dataStartIndex; rowIndex <= dataEndIndex; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    if (isSkippableRow(row)) {
      continue;
    }

    const baseRow = mapRowByHeader(header, row, columnMap);
    const skuCode = baseRow.skuCode?.trim();
    const skuName = baseRow.skuName?.trim();
    if (!skuCode || !skuName) {
      continue;
    }

    for (const storeColumn of storeColumns) {
      const headerIndex = header.findIndex((label) => label.trim() === storeColumn.trim());
      if (headerIndex < 0) {
        continue;
      }

      const rawQuantity = (row[headerIndex] ?? "").trim();
      const quantity = Number(rawQuantity);
      if (!rawQuantity || !Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }

      rows.push({
        ...baseRow,
        [storeField]: storeColumn.trim(),
        [quantityField]: String(quantity),
        externalCode: storeColumn.trim(),
      });
    }
  }

  return [{ meta: {}, rows }];
}

function parseCardSegments(segment: SegmentContext, definition: ImportRuleDefinition): ParsedSegment[] {
  const marker = definition.segment.marker ?? "";
  const matrix = segment.rows;
  const skipTerms = definition.table.skipRowsContaining ?? [];
  const starts = matrix
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.some((cell) => cell.includes(marker)))
    .map(({ index }) => index);

  return starts.map((startIndex, index) => {
    const endIndex = starts[index + 1] ?? matrix.length;
    const block = matrix.slice(startIndex, endIndex);
    const meta: Record<string, string> = {};

    const recipientRow = block[1] ?? [];
    const addressRow = block[2] ?? [];
    meta.storeName = recipientRow[1] ?? "";
    meta.recipientName = recipientRow[3] ?? "";
    meta.recipientPhone = recipientRow[5] ?? "";
    meta.recipientAddress = addressRow[1] ?? "";

    const header = block[3] ?? [];
    const dataRows = block
      .slice(4)
      .filter((row) => row.some((cell) => cell.trim()))
      .filter((row) => !isSkippableRow(row, skipTerms));
    const rows = dataRows.map((row) => mapRowByHeader(header, row, definition.table.columnMap ?? {}));

    return { meta, rows };
  });
}

function buildShipmentsFromParsedSegments(
  parsedSegments: ParsedSegment[],
  definition: ImportRuleDefinition,
): ShipmentDraft[] {
  if (definition.output.groupingField) {
    const grouped = new Map<string, ParsedSegment[]>();

    for (const segment of parsedSegments) {
      for (const row of segment.rows) {
        const groupKey = row[definition.output.groupingField] ?? "ungrouped";
        const current = grouped.get(groupKey) ?? [];
        current.push({ meta: { ...segment.meta }, rows: [row] });
        grouped.set(groupKey, current);
      }
    }

    return Array.from(grouped.entries()).map(([groupKey, groupRows]) => {
      const first = groupRows[0];
      const firstRow = first.rows[0];
      return {
        externalCode: firstRow[definition.output.fields.externalCode] || groupKey,
        storeName: firstRow[definition.output.fields.storeName],
        recipientName: firstRow[definition.output.fields.recipientName],
        recipientPhone: firstRow[definition.output.fields.recipientPhone],
        recipientAddress: firstRow[definition.output.fields.recipientAddress],
        remark: firstRow[definition.output.fields.remark],
        items: groupRows.map((entry) => toItem(entry.rows[0], definition)),
        sourceRowIds: [`group:${groupKey}`],
      };
    });
  }

  return parsedSegments.map((segment, index) => ({
    externalCode: segment.meta[definition.output.fields.externalCode] || undefined,
    storeName: segment.meta[definition.output.fields.storeName] || undefined,
    recipientName: segment.meta[definition.output.fields.recipientName] || undefined,
    recipientPhone: segment.meta[definition.output.fields.recipientPhone] || undefined,
    recipientAddress: segment.meta[definition.output.fields.recipientAddress] || undefined,
    remark: segment.meta[definition.output.fields.remark] || undefined,
    items: segment.rows.map((row) => toItem(row, definition)),
    sourceRowIds: [`segment:${index + 1}`],
  }));
}

function toItem(row: RowRecord, definition: ImportRuleDefinition): ShipmentItemDraft {
  return {
    skuCode: row[definition.output.itemFields.skuCode] ?? "",
    skuName: row[definition.output.itemFields.skuName] ?? "",
    skuSpec: row[definition.output.itemFields.skuSpec] ?? "",
    quantity: Number(row[definition.output.itemFields.quantity] ?? 0),
  };
}

function normalizePdfLines(lines: string[]) {
  const merged: string[] = [];
  const mergeStopPrefixes = ["合", "计", "制单日期", "收货人", "收货地址", "打印次数", "备注", "物品类别", "第"];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const shouldMergeWithPrevious =
      merged.length > 0 &&
      (merged[merged.length - 1].endsWith("/") ||
        /^(件|包|桶|盒|瓶)\s+(件|包|桶|盒|瓶)\s+\d+$/.test(line) ||
        /^(件|包|桶|盒|瓶)$/.test(line) ||
        /^(件|包|桶|盒|瓶)\d+$/.test(line) ||
        (!/^\d/.test(line) &&
          /ZBWP\d+/.test(merged[merged.length - 1]) &&
          !mergeStopPrefixes.some((prefix) => line.startsWith(prefix))));

    if (shouldMergeWithPrevious) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`.replace(/\s+/g, " ").trim();
      continue;
    }

    merged.push(line);
  }

  return merged;
}

function parsePdfItemLine(normalized: string): ShipmentItemDraft | null {
  const regex = /^(\d+)\s+(.+?)\s+(ZBWP\d+)\s+(.+?)\s+([^\s]+)\s+(件|包|桶|盒|瓶)\s+(\d+)$/;
  const directMatch = normalized.match(regex);

  if (directMatch) {
    return {
      skuCode: directMatch[3],
      skuName: directMatch[4].trim(),
      skuSpec: directMatch[5].trim(),
      quantity: Number(directMatch[7]),
    };
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const skuIndex = tokens.findIndex((token) => /^ZBWP\d+$/.test(token));
  const quantityToken = tokens.at(-1);
  const unitToken = tokens.at(-2);
  const specToken = tokens.at(-3);

  if (skuIndex < 0 || !quantityToken || !/^\d+$/.test(quantityToken) || !unitToken || !specToken) {
    const compactMatch = normalized.match(/^(\d+)(.+?)(ZBWP\d+)(.+?)(件|包|桶|盒|瓶)(\d+)$/);
    if (!compactMatch) {
      return null;
    }

    return {
      skuCode: compactMatch[3],
      skuName: compactMatch[4].trim(),
      skuSpec: "",
      quantity: Number(compactMatch[6]),
    };
  }

  const skuNameTokens = tokens.slice(skuIndex + 1, -3);
  if (skuNameTokens.length === 0) {
    return null;
  }

  return {
    skuCode: tokens[skuIndex],
    skuName: skuNameTokens.join(" ").trim(),
    skuSpec: specToken.trim(),
    quantity: Number(quantityToken),
  };
}

function parsePdfSnapshot(snapshot: DocumentSnapshot, definition: ImportRuleDefinition): ShipmentDraft[] {
  const options = definition.transforms.find((transform) => transform.type === "extractTextByRegex")?.options ?? {};
  const allLines = normalizePdfLines(snapshot.pages.flatMap((page) => page.lines));
  const joinedText = allLines.join("\n");
  const recipientPattern = new RegExp(String(options.recipientPattern));
  const phonePattern = new RegExp(String(options.phonePattern));
  const addressPattern = new RegExp(String(options.addressPattern), "m");
  const externalCodePattern = new RegExp(String(options.externalCodePattern));
  const storeNamePattern = new RegExp(String(options.storeNamePattern));

  const items: ShipmentItemDraft[] = [];
  for (const line of allLines) {
    const normalized = line.replace(/\s+/g, " ").trim();
    if (!/^\d+/.test(normalized) || !/ZBWP\d+/.test(normalized)) {
      continue;
    }
    const item = parsePdfItemLine(normalized);
    if (item) {
      items.push(item);
    }
  }

  const recipientName = joinedText.match(recipientPattern)?.[1]?.trim();
  const recipientPhone = joinedText.match(phonePattern)?.[1]?.trim();
  const recipientAddress = joinedText.match(addressPattern)?.[1]?.trim();
  const externalCode = joinedText.match(externalCodePattern)?.[1]?.trim();
  const storeName = joinedText.match(storeNamePattern)?.[1]?.split("订货机构")[0]?.trim();

  return [
    {
      externalCode,
      storeName,
      recipientName,
      recipientPhone,
      recipientAddress,
      items,
      sourceRowIds: ["pdf:1"],
    },
  ];
}

function parseExcelSnapshot(snapshot: DocumentSnapshot, definition: ImportRuleDefinition): ShipmentDraft[] {
  const segments = rowsToMatrix(snapshot);

  if (definition.segment.mode === "cardBlocks") {
    const parsed = segments.flatMap((segment) => parseCardSegments(segment, definition));
    return buildShipmentsFromParsedSegments(parsed, definition);
  }

  if (definition.transforms.some((transform) => transform.type === "pivotMatrixColumns")) {
    const applicableSegments =
      definition.segment.mode === "perSheet" ? segments : segments.length > 0 ? [segments[0]] : [];
    const parsed = applicableSegments.flatMap((segment) => parseMatrixSegments(segment, definition));
    return buildShipmentsFromParsedSegments(parsed, definition);
  }

  const applicableSegments =
    definition.segment.mode === "perSheet" ? segments : segments.length > 0 ? [segments[0]] : [];
  const parsed = applicableSegments.map((segment) => parseWholeSheetSegment(segment, definition));
  return buildShipmentsFromParsedSegments(parsed, definition);
}

export async function previewImport({
  filePath,
  rule,
  snapshot,
}: PreviewImportParams): Promise<PreviewImportResult> {
  const activeSnapshot = snapshot ?? (await createDocumentSnapshot(filePath));

  const shipments =
    activeSnapshot.kind === "pdf"
      ? parsePdfSnapshot(activeSnapshot, rule.definition)
      : parseExcelSnapshot(activeSnapshot, rule.definition);
  const issues = validateShipmentDrafts(shipments);

  return {
    shipments,
    issues,
  };
}
