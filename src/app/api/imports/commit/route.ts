import { NextResponse } from "next/server";
import { validateShipmentDrafts } from "@/lib/shipments/validation";
import { commitShipments } from "@/server/stores/shipments-store";

export async function POST(request: Request) {
  const body = await request.json();
  const shipments = Array.isArray(body.shipments) ? body.shipments : [];
  const issues = validateShipmentDrafts(shipments);

  if (issues.some((issue) => issue.severity === "error")) {
    return NextResponse.json({ error: "存在未修复校验错误", issues }, { status: 400 });
  }

  try {
    const inserted = await commitShipments(shipments);

    return NextResponse.json({
      successCount: inserted.length,
      failureCount: 0,
      shipments: inserted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shipment persistence failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
