"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleCheck,
  ExternalLink,
  Maximize2,
  Minimize2,
  Play,
  X,
} from "lucide-react";

import { cn, formatTimestamp } from "@/lib/utils";

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

type FocusTarget = {
  sourceId: string;
  segmentId?: string | null;
  page?: number | null;
  timestampStart?: number | null;
  nonce: string;
};

type PlayerSize = "compact" | "large";

function pdfFileUrl(filePath: string) {
  const filename = filePath.split("/").pop() || filePath;
  return `/api/files/${filename}`;
}

function parseYouTubeId(url: string | null) {
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

function playerDimensions(size: PlayerSize) {
  return size === "large"
    ? { width: 480, height: 270 }
    : { width: 360, height: 202 };
}

export function SourceViewer({
  source,
  onDelete,
  onToggleScope,
  inScope = false,
  focusTarget,
}: {
  source: SourceDetail | null;
  onDelete?: () => void;
  onToggleScope?: () => void;
  inScope?: boolean;
  focusTarget?: FocusTarget | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const segmentRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const playerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number; dragging: boolean }>({
    offsetX: 0,
    offsetY: 0,
    dragging: false,
  });
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [playerSize, setPlayerSize] = useState<PlayerSize>("compact");
  const [playerPos, setPlayerPos] = useState({ x: 32, y: 132 });
  const [playerStart, setPlayerStart] = useState(0);
  const [playerNonce, setPlayerNonce] = useState(0);
  const [autoplay, setAutoplay] = useState(false);

  const youtubeId = useMemo(() => parseYouTubeId(source?.url ?? null), [source?.url]);
  const pdfAsset = source?.assets.find((asset) => asset.kind === "pdf");
  const dims = playerDimensions(playerSize);

  useEffect(() => {
    setActiveSegmentId(null);
    setPlayerSize("compact");
    setAutoplay(false);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPlayerPos({
        x: Math.max(24, rect.left + 24),
        y: Math.max(96, rect.top + 64),
      });
    }
  }, [source?.id]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!dragRef.current.dragging) {
        return;
      }

      setPlayerPos({
        x: Math.max(12, event.clientX - dragRef.current.offsetX),
        y: Math.max(88, event.clientY - dragRef.current.offsetY),
      });
    };

    const stopDragging = () => {
      dragRef.current.dragging = false;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", stopDragging);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", stopDragging);
    };
  }, []);

  const seekToTimestamp = (seconds?: number | null) => {
    if (seconds == null) {
      return;
    }

    setPlayerStart(Math.max(0, Math.floor(seconds)));
    setAutoplay(true);
    setPlayerNonce((current) => current + 1);
  };

  const focusSegment = (segmentId?: string | null, seconds?: number | null) => {
    if (!segmentId) {
      return;
    }

    setActiveSegmentId(segmentId);
    segmentRefs.current[segmentId]?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
    seekToTimestamp(seconds);
  };

  useEffect(() => {
    if (!source || !focusTarget || focusTarget.sourceId !== source.id) {
      return;
    }

    if (focusTarget.segmentId) {
      focusSegment(focusTarget.segmentId, focusTarget.timestampStart ?? null);
      return;
    }

    if (focusTarget.page != null) {
      const matched = source.segments.find((segment) => segment.page === focusTarget.page);
      if (matched) {
        focusSegment(matched.id, matched.timestampStart ?? null);
      }
      return;
    }

    if (focusTarget.timestampStart != null && source.type === "youtube") {
      const matched = source.segments.find(
        (segment) =>
          segment.timestampStart != null &&
          Math.abs(segment.timestampStart - focusTarget.timestampStart!) < 1,
      );
      if (matched) {
        focusSegment(matched.id, focusTarget.timestampStart);
      } else {
        seekToTimestamp(focusTarget.timestampStart);
      }
    }
  }, [focusTarget, source]);

  if (!source) {
    return (
      <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-line bg-white/60 p-8 text-center text-sm text-slate-500">
        选择输入源
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full flex-col overflow-visible rounded-[24px] border border-white/80 bg-white/85 shadow-panel"
      ref={containerRef}
    >
      <div className="flex items-center justify-between border-b border-line/80 px-5 py-4">
        <div className="flex items-center gap-2">
          {onToggleScope ? (
            <button
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs transition",
                inScope
                  ? "border-accent bg-accentSoft text-accent"
                  : "border-line bg-white text-slate-500",
              )}
              onClick={onToggleScope}
              type="button"
            >
              {inScope ? <Check className="h-3.5 w-3.5" /> : <CircleCheck className="h-3.5 w-3.5" />}
              对话
            </button>
          ) : null}
          {source.url ? (
            <a
              className="inline-flex items-center gap-1 text-xs text-accent"
              href={source.url}
              rel="noreferrer"
              target="_blank"
            >
              打开原始链接
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
        {onDelete ? (
          <button
            className="rounded-full border border-line p-1.5 text-slate-400 transition hover:border-red-300 hover:text-red-500"
            onClick={onDelete}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {youtubeId ? (
        <div
          className="fixed z-40 rounded-[22px] border border-line bg-white shadow-panel"
          ref={playerRef}
          style={{
            width: dims.width,
            left: playerPos.x,
            top: playerPos.y,
          }}
        >
          <div
            className="flex cursor-move items-center justify-between rounded-t-[22px] border-b border-line bg-fog px-3 py-2"
            onMouseDown={(event) => {
              const rect = playerRef.current?.getBoundingClientRect();
              dragRef.current.dragging = true;
              dragRef.current.offsetX = event.clientX - (rect?.left ?? 0);
              dragRef.current.offsetY = event.clientY - (rect?.top ?? 0);
            }}
          >
            <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
              <Play className="h-3.5 w-3.5" />
              视频
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-line p-1.5 text-slate-500 transition hover:border-accent hover:text-accent"
                onClick={() =>
                  setPlayerSize((current) => (current === "compact" ? "large" : "compact"))
                }
                type="button"
              >
                {playerSize === "compact" ? (
                  <Maximize2 className="h-3.5 w-3.5" />
                ) : (
                  <Minimize2 className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                className="rounded-full border border-line p-1.5 text-slate-500 transition hover:border-accent hover:text-accent"
                onClick={() => {
                  playerRef.current?.requestFullscreen().catch(() => undefined);
                }}
                type="button"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="block rounded-b-[22px]"
            height={dims.height}
            key={`${youtubeId}-${playerNonce}`}
            src={`https://www.youtube.com/embed/${youtubeId}?playsinline=1&rel=0&autoplay=${autoplay ? 1 : 0}&start=${playerStart}`}
            title={source.title}
            width={dims.width}
          />
        </div>
      ) : null}

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
            未获取到字幕，可继续播放视频。
          </div>
        ) : null}

        <div className="space-y-3">
          {source.segments.map((segment, index) => (
            <button
              className={cn(
                "block w-full rounded-2xl border bg-fog/80 p-4 text-left transition",
                activeSegmentId === segment.id
                  ? "border-accent bg-accentSoft/70"
                  : "border-line/70 hover:border-accent/40",
              )}
              key={segment.id}
              onClick={() => focusSegment(segment.id, segment.timestampStart)}
              ref={(node) => {
                segmentRefs.current[segment.id] = node;
              }}
              type="button"
            >
              <div className="mb-2 flex flex-wrap gap-2 text-xs text-slate-500">
                {segment.page ? <span>第 {segment.page} 页</span> : null}
                {segment.timestampStart != null ? (
                  <span>
                    {formatTimestamp(segment.timestampStart)}
                    {segment.timestampEnd != null
                      ? ` - ${formatTimestamp(segment.timestampEnd)}`
                      : null}
                  </span>
                ) : null}
                {!segment.page && segment.timestampStart == null ? (
                  <span>段落 {index + 1}</span>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {segment.content}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
