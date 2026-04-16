import { NextResponse } from "next/server";

import { importSource } from "@/lib/ingest";
import { serializeAppError } from "@/lib/remote";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  let type = "";
  let input = "";
  let notebookId = "";
  let file: File | null = null;
  let transcriptText: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    type = String(formData.get("type") || "");
    input = String(formData.get("input") || "");
    notebookId = String(formData.get("notebookId") || "");
    transcriptText = String(formData.get("transcriptText") || "") || null;
    const maybeFile = formData.get("file");
    file = maybeFile instanceof File ? maybeFile : null;
  } else {
    const payload = (await request.json()) as {
      type: string;
      input: string;
      notebookId: string;
      transcriptText?: string;
    };
    type = payload.type;
    input = payload.input;
    notebookId = payload.notebookId;
    transcriptText = payload.transcriptText ?? null;
  }

  if (!type || !notebookId) {
    return NextResponse.json({ error: "Missing import params" }, { status: 400 });
  }

  try {
    const sourceId = await importSource({
      type: type as "web" | "youtube" | "pdf",
      input,
      notebookId,
      file,
      transcriptText,
    });

    return NextResponse.json({ sourceId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(serializeAppError(error, "导入失败"), { status: 400 });
  }
}
