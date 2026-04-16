import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

import { chunkParagraphs } from "@/lib/ingest/shared";
import type { IngestResult } from "@/lib/ingest/types";
import { AppError, ensureRemoteOk, fetchWithTimeout } from "@/lib/remote";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReaderHtml(articleHtml: string | null, paragraphs: string[]) {
  if (articleHtml?.trim()) {
    return articleHtml;
  }

  if (paragraphs.length === 0) {
    return null;
  }

  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
}

function resolvePreviewMode(response: Response) {
  const xFrameOptions = response.headers.get("x-frame-options")?.toLowerCase() ?? "";
  const contentSecurityPolicy =
    response.headers.get("content-security-policy")?.toLowerCase() ?? "";

  if (
    xFrameOptions.includes("deny") ||
    xFrameOptions.includes("sameorigin") ||
    (contentSecurityPolicy.includes("frame-ancestors") &&
      !contentSecurityPolicy.includes("frame-ancestors *"))
  ) {
    return {
      previewMode: "web-reader" as const,
      blockedReason: "目标网页禁止嵌入，已切换到阅读视图",
    };
  }

  return {
    previewMode: "web-iframe" as const,
    blockedReason: null,
  };
}

export async function ingestWeb(url: string): Promise<IngestResult> {
  const response = ensureRemoteOk(
    await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Douhua/0.4",
      },
    }),
    "网页抓取失败",
  );

  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const fallbackTitle = dom.window.document.title || url;
  const textSource =
    article?.textContent?.trim() || dom.window.document.body?.textContent?.trim() || "";

  if (!textSource) {
    throw new AppError({
      code: "missing_content",
      message: "未提取到网页正文",
    });
  }

  const paragraphStrings = textSource
    .split(/\n+/)
    .map((content) => content.trim())
    .filter((content) => content.length > 20);

  if (paragraphStrings.length === 0) {
    throw new AppError({
      code: "parsing_failed",
      message: "网页正文过短或不可解析",
    });
  }

  const preview = resolvePreviewMode(response);

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
      previewMode: preview.previewMode,
      blockedReason: preview.blockedReason,
      readerHtml: buildReaderHtml(article?.content ?? null, paragraphStrings),
      readerText: textSource,
    },
    segments: chunkParagraphs(paragraphStrings.map((content) => ({ content }))),
  };
}
