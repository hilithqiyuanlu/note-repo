"use client";

import { ExternalLink } from "lucide-react";

import { formatTimestamp } from "@/lib/utils";

type SourceDetail = {
  id: string;
  type: "web" | "youtube" | "pdf";
  title: string;
  url: string | null;
  status: string;
  metadata: Record<string, unknown>;
  segments: Array<{
    id: string;
    content: string;
    page: number | null;
    timestampStart: number | null;
    timestampEnd: number | null;
  }>;
  assets: Array<{
    id: string;
    kind: string;
    filePath: string;
  }>;
};

function pdfFileUrl(filePath: string) {
  const filename = filePath.split("/").pop() || filePath;
  return `/api/files/${filename}`;
}

export function SourceViewer({ source }: { source: SourceDetail | null }) {
  if (!source) {
    return (
      <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-line bg-white/60 p-8 text-center text-sm text-slate-500">
        选择一个输入源后，这里会显示网页正文、视频字幕或 PDF 预览。
      </div>
    );
  }

  const pdfAsset = source.assets.find((asset) => asset.kind === "pdf");

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-white/80 bg-white/85 shadow-panel">
      <div className="border-b border-line/80 px-5 py-4">
        <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">{source.type}</div>
        <div className="text-lg font-semibold text-slate-900">{source.title}</div>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
          <span>状态：{source.status}</span>
          {source.url ? (
            <a
              className="inline-flex items-center gap-1 text-accent"
              href={source.url}
              rel="noreferrer"
              target="_blank"
            >
              打开原始链接
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {pdfAsset ? (
          <iframe
            className="h-[420px] w-full rounded-2xl border border-line bg-slate-50"
            src={pdfFileUrl(pdfAsset.filePath)}
            title={source.title}
          />
        ) : null}

        {source.status === "needs_input" ? (
          <div className="rounded-2xl border border-amber-200 bg-amberSoft p-4 text-sm leading-6 text-amber-900">
            该视频没有拿到现成字幕。你可以在左侧重新导入时补充字幕文本，工作台会继续使用该 source。
          </div>
        ) : null}

        <div className="space-y-3">
          {source.segments.map((segment, index) => (
            <div className="rounded-2xl border border-line/70 bg-fog/80 p-4" key={segment.id}>
              <div className="mb-2 flex flex-wrap gap-2 text-xs text-slate-500">
                {segment.page ? <span>第 {segment.page} 页</span> : null}
                {segment.timestampStart != null ? (
                  <span>
                    {formatTimestamp(segment.timestampStart)}
                    {segment.timestampEnd != null ? ` - ${formatTimestamp(segment.timestampEnd)}` : null}
                  </span>
                ) : null}
                {!segment.page && segment.timestampStart == null ? <span>段落 {index + 1}</span> : null}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{segment.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
