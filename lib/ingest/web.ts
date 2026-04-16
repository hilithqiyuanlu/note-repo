import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

import { chunkParagraphs } from "@/lib/ingest/shared";
import type { IngestResult } from "@/lib/ingest/types";

export async function ingestWeb(url: string): Promise<IngestResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "NoteRepo/0.2",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("网页抓取失败");
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const fallbackTitle = dom.window.document.title || url;
  const textSource =
    article?.textContent?.trim() || dom.window.document.body?.textContent?.trim() || "";

  if (!textSource) {
    throw new Error("未提取到正文");
  }

  const paragraphs = textSource
    .split(/\n+/)
    .map((content) => ({ content }))
    .filter((item) => item.content.trim().length > 20);

  if (paragraphs.length === 0) {
    throw new Error("正文内容过短或不可解析");
  }

  return {
    type: "web",
    title: article?.title || fallbackTitle,
    input: url,
    url,
    metadata: {
      byline: article?.byline ?? null,
      excerpt: article?.excerpt ?? null,
      siteName: article?.siteName ?? null,
      length: article?.length ?? textSource.length,
    },
    segments: chunkParagraphs(paragraphs),
  };
}
