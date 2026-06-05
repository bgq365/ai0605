import { NextResponse } from "next/server";
import { createDocumentSnapshotFromBuffer } from "@/lib/documents/snapshot";
import { previewImportFromSnapshot } from "@/lib/imports/service";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const ruleDefinition = form.get("ruleDefinition");

  if (!(file instanceof File) || typeof ruleDefinition !== "string") {
    return NextResponse.json({ error: "缺少文件或规则定义" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const snapshot = await createDocumentSnapshotFromBuffer(file.name, buffer);
  const result = await previewImportFromSnapshot(snapshot, JSON.parse(ruleDefinition));

  return NextResponse.json(result);
}
