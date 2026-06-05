import { NextResponse } from "next/server";
import { createDocumentSnapshotFromBuffer, summarizeDocumentSnapshot } from "@/lib/documents/snapshot";
import { suggestRuleFromDocumentSummary } from "@/lib/ai/deepseek";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请选择文件" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const snapshot = await createDocumentSnapshotFromBuffer(file.name, buffer);
  const summary = summarizeDocumentSnapshot(snapshot);
  const suggestion = await suggestRuleFromDocumentSummary(summary);

  return NextResponse.json({
    summary,
    ...suggestion,
  });
}
