import path from "node:path";

import type { SourceAsset, SourcePreview, SourceType } from "@/lib/types";

export function parseYouTubeId(url: string | null) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace("/", "");
    }

    if (parsed.searchParams.get("v")) {
      return parsed.searchParams.get("v");
    }

    const match = parsed.pathname.match(/\/shorts\/([^/]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function pdfAssetUrl(asset: Pick<SourceAsset, "filePath">) {
  return `/api/files/${path.basename(asset.filePath)}`;
}

export function buildSourcePreview(params: {
  type: SourceType;
  url: string | null;
  metadata: Record<string, unknown>;
  assets: SourceAsset[];
  initialPage?: number | null;
}): SourcePreview {
  const { type, url, metadata, assets, initialPage } = params;

  if (type === "web") {
    const readerHtml =
      typeof metadata.readerHtml === "string" ? metadata.readerHtml : null;
    const readerText =
      typeof metadata.readerText === "string" ? metadata.readerText : null;
    const blockedReason =
      typeof metadata.blockedReason === "string" ? metadata.blockedReason : null;
    const previewMode =
      metadata.previewMode === "web-iframe" || metadata.previewMode === "web-reader"
        ? metadata.previewMode
        : "web-reader";

    if (previewMode === "web-iframe" && url) {
      return {
        mode: "web-iframe",
        url,
        readerHtml,
        readerText,
        blockedReason,
      };
    }

    return {
      mode: "web-reader",
      url,
      readerHtml,
      readerText,
      blockedReason,
    };
  }

  if (type === "pdf") {
    const pdfAsset = assets.find((asset) => asset.kind === "pdf");
    return {
      mode: "pdf",
      url: pdfAsset ? pdfAssetUrl(pdfAsset) : null,
      page: initialPage ?? null,
    };
  }

  if (type === "youtube") {
    return {
      mode: "youtube",
      url,
      videoId: parseYouTubeId(url),
    };
  }

  return { mode: "empty" };
}
