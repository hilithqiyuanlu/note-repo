import { embedText } from "@/lib/embeddings";
import { insertSource, replaceSourceContent, updateSource } from "@/lib/db/queries";
import { ingestPdf } from "@/lib/ingest/pdf";
import type { IngestResult, SourceImportPayload } from "@/lib/ingest/types";
import { ingestWeb } from "@/lib/ingest/web";
import { ingestYoutube } from "@/lib/ingest/youtube";
import { createId } from "@/lib/utils";

async function dispatchIngest(payload: SourceImportPayload): Promise<IngestResult> {
  if (payload.type === "web") {
    return ingestWeb(payload.input);
  }

  if (payload.type === "youtube") {
    return ingestYoutube(payload.input, payload.transcriptText);
  }

  if (payload.type === "pdf") {
    if (!payload.file) {
      throw new Error("PDF 文件缺失");
    }

    return ingestPdf(payload.file);
  }

  throw new Error("不支持的来源类型");
}

export async function importSource(payload: SourceImportPayload) {
  const result = await dispatchIngest(payload);
  const sourceId = insertSource({
    notebookId: payload.notebookId,
    type: result.type,
    title: result.title,
    input: result.input,
    url: result.url ?? null,
    status: result.status ?? "ready",
    metadata: result.metadata,
  });

  const embeddings = await Promise.all(
    result.segments.map(async (_segment, index) => ({
      segmentId: createId(`seg${index}`),
      vector: await embedText(_segment.content),
    })),
  );

  const segments = result.segments.map((segment, index) => ({
    id: embeddings[index].segmentId,
    ...segment,
  }));

  replaceSourceContent(sourceId, payload.notebookId, segments, embeddings, result.assets);

  if (result.status === "needs_input") {
    updateSource(sourceId, {
      status: "needs_input",
      metadata: result.metadata,
    });
  }

  return sourceId;
}
