import { clampText, formatTimestamp } from "@/lib/utils";
import type { Citation, SegmentRecord } from "@/lib/types";

function groupTopSegments(segments: SegmentRecord[]) {
  const grouped = new Map<string, SegmentRecord[]>();

  segments.forEach((segment) => {
    const list = grouped.get(segment.sourceId) ?? [];
    list.push(segment);
    grouped.set(segment.sourceId, list);
  });

  return Array.from(grouped.values());
}

export function localSummary(title: string, segments: SegmentRecord[]) {
  if (segments.length === 0) {
    return `# ${title}\n\n还没有导入资料。\n`;
  }

  const groups = groupTopSegments(segments);
  const lines = [`# ${title}`, "", "## 学习摘要", ""];

  groups.forEach((group) => {
    const head = group[0];
    lines.push(`### ${head.sourceTitle}`);
    lines.push("");
    group.slice(0, 3).forEach((segment) => {
      lines.push(`- ${clampText(segment.content, 160)}`);
    });
    lines.push("");
  });

  lines.push("## 待追问");
  lines.push("");
  lines.push("- 这份资料最核心的结论是什么？");
  lines.push("- 哪些概念值得进一步验证？");
  lines.push("- 哪些部分可以转成行动项？");
  lines.push("");

  return lines.join("\n");
}

export function localAnswer(question: string, segments: SegmentRecord[]) {
  if (segments.length === 0) {
    return {
      answer: "当前 notebook 还没有可用资料，先导入网页、YouTube 字幕或 PDF。",
      citations: [] as Citation[],
    };
  }

  const citations = segments.slice(0, 4).map<Citation>((segment) => {
    const locator =
      segment.sourceType === "pdf"
        ? `第 ${segment.page ?? 1} 页`
        : segment.sourceType === "youtube"
          ? formatTimestamp(segment.timestampStart)
          : `段落 ${segment.order + 1}`;

    return {
      sourceId: segment.sourceId,
      segmentId: segment.id,
      sourceTitle: segment.sourceTitle,
      kind: segment.sourceType,
      locator,
      quotedText: clampText(segment.content, 180),
      segmentOrder: segment.order,
      page: segment.page,
      timestampStart: segment.timestampStart,
      timestampEnd: segment.timestampEnd,
    };
  });

  const answer = [
    "基于当前 notebook，我先给出一个压缩回答：",
    segments
      .slice(0, 3)
      .map((segment, index) => `${index + 1}. ${clampText(segment.content, 180)}`)
      .join("\n"),
    "",
    "如果你要继续追问，最适合再展开的是这些引用片段。",
  ].join("\n");

  return { answer, citations };
}
