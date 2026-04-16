import fs from "node:fs/promises";
import path from "node:path";
import pdf from "pdf-parse";

import { chunkParagraphs } from "@/lib/ingest/shared";
import type { IngestResult } from "@/lib/ingest/types";
import { getUploadsRoot } from "@/lib/storage";
import { createId } from "@/lib/utils";

export async function ingestPdf(file: File): Promise<IngestResult> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = `${createId("pdf")}-${file.name.replace(/\s+/g, "-")}`;
  const savePath = path.join(getUploadsRoot(), filename);

  await fs.writeFile(savePath, buffer);

  const pages: string[] = [];
  const parsed = await pdf(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const strings = textContent.items
        .map((item: { str?: string }) => item.str ?? "")
        .filter(Boolean)
        .join(" ");
      pages.push(strings);
      return strings;
    },
  });

  const segments = chunkParagraphs(
    pages.flatMap((content, index) =>
      content
        .split(/\n+/)
        .map((paragraph) => ({
          content: paragraph,
          page: index + 1,
        })),
    ),
  );

  return {
    type: "pdf",
    title: parsed.info?.Title || file.name,
    input: file.name,
    status: "ready",
    metadata: {
      pages: parsed.numpages,
      info: parsed.info,
    },
    segments,
    assets: [
      {
        kind: "pdf",
        label: file.name,
        filePath: savePath,
        mimeType: file.type || "application/pdf",
        metadata: {
          originalName: file.name,
        },
      },
    ],
  };
}
