import { NextResponse } from "next/server";
import { deleteRule, getRuleById, updateRule } from "@/server/stores/rules-store";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const rule = await getRuleById(id);
  if (!rule) {
    return NextResponse.json({ error: "规则不存在" }, { status: 404 });
  }
  return NextResponse.json(rule);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const patch = await request.json();
  const rule = await updateRule(id, patch);
  if (!rule) {
    return NextResponse.json({ error: "规则不存在" }, { status: 404 });
  }
  return NextResponse.json(rule);
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const deleted = await deleteRule(id);
  if (!deleted) {
    return NextResponse.json({ error: "规则不存在" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
