export type SourceType = "web" | "youtube" | "pdf";

export type SourceSegment = {
  id: string;
  content: string;
  page: number | null;
  timestampStart: number | null;
  timestampEnd: number | null;
  metadata?: Record<string, unknown>;
};

export type SourceAsset = {
  id: string;
  kind: string;
  label: string | null;
  filePath: string;
  mimeType: string | null;
  metadata: Record<string, unknown>;
};

export type SourcePreview =
  | {
      mode: "web-iframe";
      url: string;
      readerHtml: string | null;
      readerText: string | null;
      blockedReason: string | null;
    }
  | {
      mode: "web-reader";
      url: string | null;
      readerHtml: string | null;
      readerText: string | null;
      blockedReason: string | null;
    }
  | {
      mode: "pdf";
      url: string | null;
      page: number | null;
    }
  | {
      mode: "youtube";
      url: string | null;
      videoId: string | null;
    }
  | {
      mode: "empty";
    };

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
  localChatEnabled: boolean;
  localChatBaseUrl: string | null;
  localChatModel: string | null;
  localChatLabel: string | null;
  embeddingProvider: string;
  embeddingBaseUrl: string | null;
  embeddingApiKey: string | null;
  embeddingModel: string;
  proxyEnabled: boolean;
  proxyProtocol: "http" | "https";
  proxyHost: string | null;
  proxyPort: number | null;
  proxyBypassHosts: string | null;
  tavilyApiKey: string | null;
  exportDir: string | null;
  updatedAt: string;
};

export type ModelOption = {
  key: string;
  label: string;
  provider: string;
  source: "remote" | "local" | "heuristic";
  kind: "chat" | "embedding";
};

export type ModelCatalog = {
  models: ModelOption[];
  degraded: boolean;
  reason: string | null;
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
  initialSourceDetail: SourceDetail | null;
};

export type SourceDetail = {
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
  segments: SourceSegment[];
  assets: SourceAsset[];
  preview: SourcePreview;
};

export type ThreadSummary = {
  id: string;
  notebookId: string;
  title: string;
  modelKey: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string | null;
};

export type ThreadMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  usedWebSearch: boolean;
  createdAt: string;
};
