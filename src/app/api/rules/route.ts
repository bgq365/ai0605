import { NextResponse } from "next/server";
import { createRule, listRules } from "@/server/stores/rules-store";

export async function GET() {
  return NextResponse.json({ rules: await listRules() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const rule = await createRule(body);
  return NextResponse.json(rule, { status: 201 });
}
