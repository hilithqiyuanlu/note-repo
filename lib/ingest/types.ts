import type { SourceType } from "@/lib/types";

export type ParsedSegment = {
  content: string;
  page?: number | null;
  timestampStart?: number | null;
  timestampEnd?: number | null;
  metadata?: Record<string, unknown>;
};

export type ParsedAsset = {
  kind: string;
  label?: string;
  filePath: string;
  mimeType?: string | null;
  metadata?: Record<string, unknown>;
};

export type IngestResult = {
  type: SourceType;
  title: string;
  input: string;
  url?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
  segments: ParsedSegment[];
  assets?: ParsedAsset[];
};

export type SourceImportPayload = {
  type: SourceType;
  input: string;
  notebookId: string;
  file?: File | null;
  transcriptText?: string | null;
};
