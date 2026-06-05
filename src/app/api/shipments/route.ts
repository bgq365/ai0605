import { NextResponse } from "next/server";
import { listShipments } from "@/server/stores/shipments-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  return NextResponse.json({ shipments: await listShipments({ search }) });
}
