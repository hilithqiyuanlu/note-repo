export type SourceType = "web" | "youtube" | "pdf";

export type Citation = {
  sourceId: string;
  segmentId?: string | null;
  sourceTitle: string;
  kind: SourceType;
  locator: string;
  quotedText: string;
  segmentOrder?: number | null;
  page?: number | null;
  timestampStart?: number | null;
  timestampEnd?: number | null;
};

export type AppSettingsRecord = {
  chatProvider: string;
  chatBaseUrl: string | null;
  chatApiKey: string | null;
  chatModel: string;
  embeddingProvider: string;
  embeddingBaseUrl: string | null;
  embeddingApiKey: string | null;
  embeddingModel: string;
  tavilyApiKey: string | null;
  exportDir: string | null;
  updatedAt: string;
};

export type ModelOption = {
  key: string;
  label: string;
  provider: string;
  kind: "chat" | "embedding";
};

export type SegmentRecord = {
  id: string;
  sourceId: string;
  notebookId: string;
  sourceTitle: string;
  sourceType: SourceType;
  content: string;
  order: number;
  page: number | null;
  timestampStart: number | null;
  timestampEnd: number | null;
};

export type NotebookSnapshot = {
  notebook: {
    id: string;
    title: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  };
  note: {
    id: string;
    markdown: string;
    updatedAt: string;
  } | null;
  sources: Array<{
    id: string;
    notebookId: string;
    type: SourceType;
    title: string;
    input: string;
    url: string | null;
    status: string;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }>;
};
