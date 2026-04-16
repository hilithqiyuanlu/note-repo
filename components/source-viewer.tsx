"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, LocateFixed } from "lucide-react";

import type { SourceDetail } from "@/lib/types";
import { cn, formatTimestamp } from "@/lib/utils";

type FocusTarget = {
  sourceId: string;
  segmentId?: string | null;
  page?: number | null;
  timestampStart?: number | null;
  nonce: string;
};

function buildPdfUrl(baseUrl: string | null, page: number | null) {
  if (!baseUrl) {
    return null;
  }

  const viewerParams = "toolbar=0&navpanes=0&scrollbar=1&view=FitH";

  if (!page) {
    return `${baseUrl}#${viewerParams}`;
  }

  return `${baseUrl}#page=${page}&${viewerParams}`;
}

function normalizeYoutubeRange(start: number | null, end: number | null) {
  if (start == null) {
    return {
      start: null,
      end,
    };
  }

  const duration = end != null ? end - start : null;
  if (duration != null && duration > 120) {
    return {
      start: start / 1000,
      end: end != null ? end / 1000 : null,
    };
  }

  return {
    start,
    end,
  };
}

export function SourceViewer({
  source,
  focusTarget,
  onSubmitTranscript,
  reprocessLoading = false,
}: {
  source: SourceDetail | null;
  focusTarget?: FocusTarget | null;
  onSubmitTranscript?: (transcriptText: string) => void;
  reprocessLoading?: boolean;
}) {
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [playerStart, setPlayerStart] = useState(0);
  const [playerNonce, setPlayerNonce] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [pdfPage, setPdfPage] = useState<number | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState("");

  const pdfUrl = useMemo(() => {
    if (!source || source.preview.mode !== "pdf") {
      return null;
    }

    return buildPdfUrl(source.preview.url, pdfPage ?? source.preview.page ?? null);
  }, [pdfPage, source]);

  useEffect(() => {
    setActiveSegmentId(null);
    setPlayerStart(0);
    setPlayerNonce(0);
    setAutoplay(false);
    setPdfPage(null);
    setTranscriptDraft("");
  }, [source?.id, source?.status]);

  const focusSegment = (segmentId?: string | null) => {
    if (!segmentId) {
      return;
    }

    setActiveSegmentId(segmentId);
    segmentRefs.current[segmentId]?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (!source || !focusTarget || focusTarget.sourceId !== source.id) {
      return;
    }

    const matchedSegment = focusTarget.segmentId
      ? source.segments.find((segment) => segment.id === focusTarget.segmentId)
      : null;
    const normalizedMatchedRange =
      source.preview.mode === "youtube" && matchedSegment
        ? normalizeYoutubeRange(matchedSegment.timestampStart, matchedSegment.timestampEnd)
        : null;

    if (focusTarget.segmentId) {
      focusSegment(focusTarget.segmentId);
    }

    const nextPlayerStart = normalizedMatchedRange?.start ?? focusTarget.timestampStart ?? null;

    if (nextPlayerStart != null && source.preview.mode === "youtube") {
      setPlayerStart(Math.max(0, Math.floor(nextPlayerStart)));
      setAutoplay(true);
      setPlayerNonce((current) => current + 1);
    }

    if (focusTarget.page != null && source.preview.mode === "pdf") {
      setPdfPage(focusTarget.page);
    }
  }, [focusTarget, source]);

  if (!source) {
    return (
      <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-line bg-white/70 p-8 text-center text-sm text-slate-500">
        选择一个来源开始查看
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <section className="min-h-[240px] shrink-0 overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-panel">
        <div className="h-[min(42vh,360px)] overflow-hidden bg-fog/70">
          {source.preview.mode === "web-iframe" ? (
            <iframe
              className="h-full w-full border-0 bg-white"
              src={source.preview.url}
              title={source.title}
            />
          ) : null}

          {source.preview.mode === "web-reader" ? (
            <div className="h-full overflow-y-auto px-6 py-5">
              {source.preview.blockedReason ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {source.preview.blockedReason}
                </div>
              ) : null}
              <article
                className="prose prose-slate max-w-none text-sm leading-7"
                dangerouslySetInnerHTML={{
                  __html:
                    source.preview.readerHtml ??
                    "<p class='text-slate-500'>当前网页未提取到可展示的阅读视图。</p>",
                }}
              />
            </div>
          ) : null}

          {source.preview.mode === "pdf" ? (
            pdfUrl ? (
              <iframe className="h-full w-full border-0 bg-white" src={pdfUrl} title={source.title} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                PDF 预览不可用
              </div>
            )
          ) : null}

          {source.preview.mode === "youtube" ? (
            source.preview.videoId ? (
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full border-0 bg-black"
                key={`${source.preview.videoId}-${playerNonce}`}
                src={`https://www.youtube.com/embed/${source.preview.videoId}?playsinline=1&rel=0&autoplay=${autoplay ? 1 : 0}&start=${playerStart}`}
                title={source.title}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                当前视频无法解析播放地址
              </div>
            )
          ) : null}
        </div>
      </section>

      <section className="min-h-0 flex-1 overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-panel">
        <div className="h-full overflow-y-auto px-5 py-4">
          {source.status === "needs_input" ? (
            <div className="mb-4 rounded-[20px] border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-medium text-amber-900">当前未获取到字幕</div>
              <p className="mt-2 text-sm leading-6 text-amber-900/90">
                可以直接粘贴字幕文本后重试，系统会重新切分并建立可引用片段。
              </p>
              <textarea
                className="mt-3 h-32 w-full resize-none rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-accent"
                onChange={(event) => setTranscriptDraft(event.target.value)}
                placeholder="将字幕或转写文本粘贴到这里"
                value={transcriptDraft}
              />
              <div className="mt-3 flex justify-end">
                <button
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent disabled:opacity-60"
                  disabled={!transcriptDraft.trim() || reprocessLoading}
                  onClick={() => onSubmitTranscript?.(transcriptDraft)}
                  type="button"
                >
                  {reprocessLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  重新生成字幕片段
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-3 pb-10">
            {source.segments.map((segment, index) => {
              const normalizedRange =
                source.preview.mode === "youtube"
                  ? normalizeYoutubeRange(segment.timestampStart, segment.timestampEnd)
                  : {
                      start: segment.timestampStart,
                      end: segment.timestampEnd,
                    };

              return (
                <div
                className={cn(
                  "rounded-[20px] border px-4 py-4 transition duration-300",
                  activeSegmentId === segment.id
                    ? "border-accent bg-accentSoft/70 shadow-sm"
                    : "border-line/70 bg-fog/80 hover:border-accent/40 hover:bg-white",
                )}
                key={segment.id}
                ref={(node) => {
                  segmentRefs.current[segment.id] = node;
                }}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    {segment.page ? <span>第 {segment.page} 页</span> : null}
                    {normalizedRange.start != null ? (
                      <span>
                        {formatTimestamp(normalizedRange.start)}
                        {normalizedRange.end != null
                          ? ` - ${formatTimestamp(normalizedRange.end)}`
                          : null}
                      </span>
                    ) : null}
                    {!segment.page && normalizedRange.start == null ? (
                      <span>段落 {index + 1}</span>
                    ) : null}
                  </div>
                  <button
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-accent hover:text-accent"
                    onClick={() => {
                      setActiveSegmentId(segment.id);
                      if (normalizedRange.start != null && source.preview.mode === "youtube") {
                        setPlayerStart(Math.max(0, Math.floor(normalizedRange.start)));
                        setAutoplay(true);
                        setPlayerNonce((current) => current + 1);
                      }
                      if (segment.page != null && source.preview.mode === "pdf") {
                        setPdfPage(segment.page);
                      }
                    }}
                    type="button"
                  >
                    <LocateFixed className="h-3.5 w-3.5" />
                    定位
                  </button>
                </div>
                <p className="select-text whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {segment.content}
                </p>
              </div>
            );
            })}
            {source.segments.length === 0 && source.status !== "needs_input" ? (
              <div className="rounded-[20px] border border-dashed border-line bg-fog/50 px-4 py-8 text-center text-sm text-slate-500">
                当前来源还没有可展示的文本片段
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
