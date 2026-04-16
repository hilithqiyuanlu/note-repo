import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { embedText } from "@/lib/embeddings";
import { getSourceDetail, replaceSourceContent, updateSource } from "@/lib/db/queries";
import { ingestWeb } from "@/lib/ingest/web";
import { ingestYoutube } from "@/lib/ingest/youtube";
import { createId } from "@/lib/utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = getSourceDetail(id);

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  let result;

  if (source.type === "web" && source.url) {
    result = await ingestWeb(source.url);
  } else if (source.type === "youtube" && source.url) {
    result = await ingestYoutube(source.url);
  } else if (source.type === "pdf") {
    const pdfAsset = source.assets.find((asset) => asset.kind === "pdf");

    if (!pdfAsset) {
      return NextResponse.json({ error: "PDF asset missing" }, { status: 400 });
    }

    const buffer = await fs.readFile(pdfAsset.filePath);
    const filename = path.basename(pdfAsset.filePath);
    const file = new File([buffer], filename, {
      type: pdfAsset.mimeType || "application/pdf",
    });
    const { ingestPdf } = await import("@/lib/ingest/pdf");
    result = await ingestPdf(file);
  } else {
    return NextResponse.json({ error: "Source cannot be reprocessed" }, { status: 400 });
  }

  const embeddings = await Promise.all(
    result.segments.map(async (segment, index) => ({
      segmentId: createId(`seg${index}`),
      vector: await embedText(segment.content),
    })),
  );

  replaceSourceContent(
    source.id,
    source.notebookId,
    result.segments.map((segment, index) => ({
      id: embeddings[index].segmentId,
      ...segment,
    })),
    embeddings,
    result.assets,
  );

  updateSource(source.id, {
    title: result.title,
    status: result.status ?? "ready",
    metadata: result.metadata,
  });

  return NextResponse.json({ ok: true });
}
