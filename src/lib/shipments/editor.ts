import type { ShipmentDraft, ValidationIssue } from "@/lib/domain/types";

export interface EditableShipmentRow {
  id: string;
  externalCode: string;
  storeName: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  remark: string;
  skuCode: string;
  skuName: string;
  skuSpec: string;
  quantity: string;
  sourceRowId: string;
}

function rowIdFor(shipmentIndex: number, itemIndex: number) {
  return `shipment-${shipmentIndex + 1}-item-${itemIndex + 1}`;
}

export function buildEditableRows(shipments: ShipmentDraft[]): EditableShipmentRow[] {
  return shipments.flatMap((shipment, shipmentIndex) =>
    (shipment.items ?? []).map((item, itemIndex) => ({
      id: rowIdFor(shipmentIndex, itemIndex),
      externalCode: shipment.externalCode ?? "",
      storeName: shipment.storeName ?? "",
      recipientName: shipment.recipientName ?? "",
      recipientPhone: shipment.recipientPhone ?? "",
      recipientAddress: shipment.recipientAddress ?? "",
      remark: shipment.remark ?? "",
      skuCode: item.skuCode ?? "",
      skuName: item.skuName ?? "",
      skuSpec: item.skuSpec ?? "",
      quantity: String(item.quantity ?? ""),
      sourceRowId: shipment.sourceRowIds[itemIndex] ?? shipment.sourceRowIds[0] ?? `segment:${shipmentIndex + 1}`,
    })),
  );
}

export function applyRowsToShipments(rows: EditableShipmentRow[]): ShipmentDraft[] {
  const grouped = new Map<string, EditableShipmentRow[]>();

  for (const row of rows) {
    const groupKey = row.externalCode.trim() || `${row.storeName.trim()}::${row.recipientName.trim()}::${row.recipientPhone.trim()}`;
    const current = grouped.get(groupKey) ?? [];
    current.push(row);
    grouped.set(groupKey, current);
  }

  return Array.from(grouped.values()).map((groupRows) => {
    const firstRow = groupRows[0];
    return {
      externalCode: firstRow.externalCode.trim() || undefined,
      storeName: firstRow.storeName.trim() || undefined,
      recipientName: firstRow.recipientName.trim() || undefined,
      recipientPhone: firstRow.recipientPhone.trim() || undefined,
      recipientAddress: firstRow.recipientAddress.trim() || undefined,
      remark: firstRow.remark.trim() || undefined,
      items: groupRows.map((row) => ({
        skuCode: row.skuCode.trim(),
        skuName: row.skuName.trim(),
        skuSpec: row.skuSpec.trim() || undefined,
        quantity: Number(row.quantity),
      })),
      sourceRowIds: groupRows.map((row) => row.sourceRowId),
    } satisfies ShipmentDraft;
  });
}

function hasRecipientGroup(row: EditableShipmentRow) {
  const hasStore = Boolean(row.storeName.trim());
  const hasRecipient =
    Boolean(row.recipientName.trim()) &&
    Boolean(row.recipientPhone.trim()) &&
    Boolean(row.recipientAddress.trim());

  return hasStore || hasRecipient;
}

export function detectShipmentRowIssues(
  rows: EditableShipmentRow[],
  existingExternalCodes: string[] = [],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const currentBatchCounts = new Map<string, number>();

  for (const row of rows) {
    const externalCode = row.externalCode.trim();
    if (externalCode) {
      currentBatchCounts.set(externalCode, (currentBatchCounts.get(externalCode) ?? 0) + 1);
    }
  }

  for (const row of rows) {
    if (!hasRecipientGroup(row)) {
      issues.push({
        rowKey: row.id,
        field: "recipientGroup",
        message: "收货门店或收件人三要素至少填写一组",
        severity: "error",
      });
    }

    if (!row.skuCode.trim()) {
      issues.push({
        rowKey: row.id,
        field: "skuCode",
        message: "SKU 编码不能为空",
        severity: "error",
      });
    }

    if (!row.skuName.trim()) {
      issues.push({
        rowKey: row.id,
        field: "skuName",
        message: "SKU 名称不能为空",
        severity: "error",
      });
    }

    const quantity = Number(row.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      issues.push({
        rowKey: row.id,
        field: "quantity",
        message: "发货数量必须为正整数",
        severity: "error",
      });
    }

    const externalCode = row.externalCode.trim();
    if (externalCode && (currentBatchCounts.get(externalCode) ?? 0) > 1) {
      issues.push({
        rowKey: row.id,
        field: "externalCode",
        message: "外部编码在当前批次内重复",
        severity: "warning",
      });
    }

    if (externalCode && existingExternalCodes.includes(externalCode)) {
      issues.push({
        rowKey: row.id,
        field: "externalCode",
        message: "外部编码与历史数据重复",
        severity: "warning",
      });
    }
  }

  return issues;
}
