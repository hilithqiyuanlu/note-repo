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

  if (!article?.textContent) {
    throw new Error("未提取到正文");
  }

  const paragraphs = article.textContent
    .split(/\n+/)
    .map((content) => ({ content }))
    .filter((item) => item.content.trim().length > 20);

  return {
    type: "web",
    title: article.title || url,
    input: url,
    url,
    metadata: {
      byline: article.byline,
      excerpt: article.excerpt,
      siteName: article.siteName,
      length: article.length,
    },
    segments: chunkParagraphs(paragraphs),
  };
}
