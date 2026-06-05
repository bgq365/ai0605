import { NextResponse } from "next/server";
import { createDocumentSnapshotFromBuffer } from "@/lib/documents/snapshot";
import { previewImportFromSnapshot } from "@/lib/imports/service";
import { getRuleById } from "@/server/stores/rules-store";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const ruleId = form.get("ruleId");

  if (!(file instanceof File) || typeof ruleId !== "string") {
    return NextResponse.json({ error: "缺少文件或规则" }, { status: 400 });
  }

  const rule = await getRuleById(ruleId);
  if (!rule) {
    return NextResponse.json({ error: "规则不存在" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const snapshot = await createDocumentSnapshotFromBuffer(file.name, buffer);
  const result = await previewImportFromSnapshot(snapshot, rule.definition);

  return NextResponse.json({
    rule,
    ...result,
  });
}
