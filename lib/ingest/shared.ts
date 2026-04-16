import { normalizeWhitespace } from "@/lib/utils";
import type { ParsedSegment } from "@/lib/ingest/types";

export function chunkParagraphs(
  paragraphs: Array<{ content: string; page?: number | null; timestampStart?: number | null; timestampEnd?: number | null }>,
  maxChars = 600,
) {
  const chunks: ParsedSegment[] = [];
  let bucket = "";
  let page: number | null | undefined = null;
  let timestampStart: number | null | undefined = null;
  let timestampEnd: number | null | undefined = null;

  const flush = () => {
    if (!bucket.trim()) {
      return;
    }

    chunks.push({
      content: normalizeWhitespace(bucket),
      page: page ?? null,
      timestampStart: timestampStart ?? null,
      timestampEnd: timestampEnd ?? null,
    });
    bucket = "";
    page = null;
    timestampStart = null;
    timestampEnd = null;
  };

  paragraphs.forEach((paragraph) => {
    const cleaned = normalizeWhitespace(paragraph.content);
    if (!cleaned) {
      return;
    }

    if (!bucket) {
      page = paragraph.page ?? null;
      timestampStart = paragraph.timestampStart ?? null;
    }

    const candidate = bucket ? `${bucket}\n${cleaned}` : cleaned;

    if (candidate.length > maxChars && bucket) {
      flush();
      page = paragraph.page ?? null;
      timestampStart = paragraph.timestampStart ?? null;
      bucket = cleaned;
    } else {
      bucket = candidate;
    }

    timestampEnd = paragraph.timestampEnd ?? paragraph.timestampStart ?? null;
  });

  flush();
  return chunks;
}
