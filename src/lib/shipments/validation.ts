import type { ShipmentDraft, ValidationIssue } from "@/lib/domain/types";

function hasRecipientGroup(shipment: ShipmentDraft) {
  const hasStore = Boolean(shipment.storeName?.trim());
  const hasRecipient =
    Boolean(shipment.recipientName?.trim()) &&
    Boolean(shipment.recipientPhone?.trim()) &&
    Boolean(shipment.recipientAddress?.trim());

  return hasStore || hasRecipient;
}

export function validateShipmentDrafts(shipments: ShipmentDraft[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  shipments.forEach((shipment, shipmentIndex) => {
    const rowKey = shipment.sourceRowIds[0] ?? `shipment-${shipmentIndex + 1}`;

    if (!hasRecipientGroup(shipment)) {
      issues.push({
        rowKey,
        field: "recipientGroup",
        message: "收货门店或收件人三要素至少填写一组",
        severity: "error",
      });
    }

    shipment.items.forEach((item, itemIndex) => {
      if (!item.skuCode?.trim()) {
        issues.push({
          rowKey,
          field: "items.skuCode",
          message: `第 ${itemIndex + 1} 个 SKU 缺少编码`,
          severity: "error",
        });
      }

      if (!item.skuName?.trim()) {
        issues.push({
          rowKey,
          field: "items.skuName",
          message: `第 ${itemIndex + 1} 个 SKU 缺少名称`,
          severity: "error",
        });
      }

      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        issues.push({
          rowKey,
          field: "items.quantity",
          message: `第 ${itemIndex + 1} 个 SKU 数量必须大于 0`,
          severity: "error",
        });
      }
    });
  });

  return issues;
}
