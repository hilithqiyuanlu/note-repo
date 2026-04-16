import { YoutubeTranscript } from "youtube-transcript";

import { chunkParagraphs } from "@/lib/ingest/shared";
import type { IngestResult } from "@/lib/ingest/types";
import { createId, normalizeWhitespace } from "@/lib/utils";

export interface VideoProvider {
  match(url: string): boolean;
  fetchMeta(url: string): Promise<{ title: string; author?: string; thumbnail?: string }>;
  fetchTranscript(url: string): Promise<
    Array<{ text: string; offset: number; duration: number }>
  >;
}

function parseYouTubeId(url: string) {
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

function parseTranscriptText(text: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  return lines.map((line, index) => ({
    text: line,
    offset: index * 8,
    duration: 8,
  }));
}

export class YouTubeProvider implements VideoProvider {
  match(url: string) {
    return /youtu\.?be/.test(url);
  }

  async fetchMeta(url: string) {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return { title: url };
    }

    const payload = (await response.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };

    return {
      title: payload.title || url,
      author: payload.author_name,
      thumbnail: payload.thumbnail_url,
    };
  }

  async fetchTranscript(url: string) {
    const videoId = parseYouTubeId(url);
    if (!videoId) {
      throw new Error("无法识别 YouTube 视频 ID");
    }

    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript.map((item) => ({
      text: item.text,
      offset: item.offset,
      duration: item.duration,
    }));
  }
}

const provider = new YouTubeProvider();

export async function ingestYoutube(url: string, transcriptText?: string | null): Promise<IngestResult> {
  const meta = await provider.fetchMeta(url);

  try {
    const transcript = await provider.fetchTranscript(url);
    return {
      type: "youtube",
      title: meta.title,
      input: url,
      url,
      metadata: {
        author: meta.author,
        thumbnail: meta.thumbnail,
      },
      segments: chunkParagraphs(
        transcript.map((item) => ({
          content: item.text,
          timestampStart: item.offset,
          timestampEnd: item.offset + item.duration,
        })),
      ),
      assets: meta.thumbnail
        ? [
            {
              kind: "thumbnail",
              label: "thumbnail",
              filePath: meta.thumbnail,
              mimeType: "image/jpeg",
              metadata: {
                remote: true,
                id: createId("thumb"),
              },
            },
          ]
        : [],
    };
  } catch (error) {
    if (transcriptText?.trim()) {
      return {
        type: "youtube",
        title: meta.title,
        input: url,
        url,
        status: "ready",
        metadata: {
          author: meta.author,
          thumbnail: meta.thumbnail,
          fallbackTranscript: true,
        },
        segments: chunkParagraphs(
          parseTranscriptText(transcriptText).map((item) => ({
            content: item.text,
            timestampStart: item.offset,
            timestampEnd: item.offset + item.duration,
          })),
        ),
      };
    }

    return {
      type: "youtube",
      title: meta.title,
      input: url,
      url,
      status: "needs_input",
      metadata: {
        author: meta.author,
        thumbnail: meta.thumbnail,
        error: error instanceof Error ? error.message : "字幕不可用",
      },
      segments: [],
    };
  }
}
