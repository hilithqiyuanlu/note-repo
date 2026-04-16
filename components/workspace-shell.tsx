"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Check,
  ChevronLeft,
  CircleAlert,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Globe,
  History,
  LoaderCircle,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RefreshCcw,
  Save,
  Send,
  Settings2,
  SquarePen,
  Trash2,
  Upload,
  Video,
  Wifi,
} from "lucide-react";

import { MarkdownPreview } from "@/components/markdown-preview";
import { SourceViewer } from "@/components/source-viewer";
import type {
  AppSettingsRecord,
  Citation,
  ModelCatalog,
  NotebookSnapshot,
  SourceDetail,
  ThreadMessage,
  ThreadSummary,
} from "@/lib/types";
import { cn, formatTimestamp } from "@/lib/utils";

type FocusTarget = {
  sourceId: string;
  segmentId?: string | null;
  page?: number | null;
  timestampStart?: number | null;
  nonce: string;
};

type LeftMode = "collapsed" | "list" | "viewer";

const MODEL_CATALOG_CACHE_TTL = 60_000;

let modelCatalogCache:
  | {
      fetchedAt: number;
      catalog: ModelCatalog;
    }
  | null = null;

function LoadingDots({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <span className="inline-flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
      </span>
    </span>
  );
}

function sourceIcon(type: NotebookSnapshot["sources"][number]["type"]) {
  return type === "web" ? Globe : type === "youtube" ? Video : FileText;
}

function sortSources<T extends { title: string }>(sources: T[]) {
  return [...sources].sort((left, right) =>
    left.title.localeCompare(right.title, "zh-CN", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

function formatCitationLabel(citation: Citation) {
  const normalizedTimestamp =
    citation.timestampStart != null &&
    citation.timestampEnd != null &&
    citation.timestampEnd - citation.timestampStart > 120
      ? citation.timestampStart / 1000
      : citation.timestampStart;

  if (citation.kind === "youtube" && citation.timestampStart != null) {
    return formatTimestamp(normalizedTimestamp);
  }

  if (citation.kind === "pdf" && citation.page != null) {
    return `第 ${citation.page} 页`;
  }

  return citation.locator;
}

function SourceRow({
  source,
  selected,
  inScope,
  loading,
  editing,
  editingTitle,
  onSelect,
  onToggleScope,
  onView,
  onDelete,
  onStartEdit,
  onEditChange,
  onEditCancel,
  onEditCommit,
}: {
  source: NotebookSnapshot["sources"][number];
  selected: boolean;
  inScope: boolean;
  loading: boolean;
  editing: boolean;
  editingTitle: string;
  onSelect: () => void;
  onToggleScope: () => void;
  onView: () => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onEditChange: (value: string) => void;
  onEditCancel: () => void;
  onEditCommit: () => void;
}) {
  const Icon = sourceIcon(source.type);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-[20px] border px-3 py-3 transition duration-300",
        selected
          ? "border-accent bg-accentSoft/60 shadow-sm"
          : "border-line/70 bg-white hover:border-accent/35 hover:bg-fog/70",
      )}
    >
      <button
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-line bg-fog text-slate-600 transition hover:border-accent hover:text-accent"
        onClick={onSelect}
        type="button"
      >
        <Icon className="h-4.5 w-4.5" />
      </button>

      <button
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border transition",
          inScope
            ? "border-accent bg-accent text-white"
            : "border-line bg-white text-transparent hover:border-accent/50",
        )}
        onClick={onToggleScope}
        type="button"
      >
        <Check className="h-3.5 w-3.5" />
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent"
            onBlur={onEditCommit}
            onChange={(event) => onEditChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onEditCommit();
              }

              if (event.key === "Escape") {
                event.preventDefault();
                onEditCancel();
              }
            }}
            value={editingTitle}
          />
        ) : (
          <button
            className="block w-full truncate text-left text-sm font-medium text-slate-800"
            onClick={onSelect}
            onDoubleClick={onStartEdit}
            title={source.title}
            type="button"
          >
            {source.title}
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-slate-500 transition hover:border-accent hover:text-accent"
          onClick={onView}
          title="查看"
          type="button"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-slate-500 transition hover:border-red-300 hover:text-red-500"
          onClick={onDelete}
          title="删除"
          type="button"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function WorkspaceShell({
  initialSnapshot,
  initialThreadSummaries,
  initialActiveThreadId,
  initialActiveThreadMessages,
  initialModelCatalog,
  initialSettings,
}: {
  initialSnapshot: NotebookSnapshot;
  initialThreadSummaries: ThreadSummary[];
  initialActiveThreadId: string | null;
  initialActiveThreadMessages: ThreadMessage[];
  initialModelCatalog: ModelCatalog;
  initialSettings: AppSettingsRecord;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [threadSummaries, setThreadSummaries] = useState(initialThreadSummaries);
  const [modelCatalog, setModelCatalog] = useState(initialModelCatalog);
  const [settingsState, setSettingsState] = useState(initialSettings);
  const [leftMode, setLeftMode] = useState<LeftMode>("list");
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initialSnapshot.notebook.title);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [selectedScopeSourceIds, setSelectedScopeSourceIds] = useState<string[]>([]);
  const [sourceType, setSourceType] = useState<"web" | "youtube" | "pdf">("web");
  const [sourceInput, setSourceInput] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState(
    initialSnapshot.initialSourceDetail?.id ?? initialSnapshot.sources[0]?.id ?? null,
  );
  const [sourceDetails, setSourceDetails] = useState<Record<string, SourceDetail>>(() =>
    initialSnapshot.initialSourceDetail
      ? { [initialSnapshot.initialSourceDetail.id]: initialSnapshot.initialSourceDetail }
      : {},
  );
  const [sourceDetailLoadingId, setSourceDetailLoadingId] = useState<string | null>(null);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editingSourceTitle, setEditingSourceTitle] = useState("");
  const [sourceActionError, setSourceActionError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialActiveThreadId);
  const [messagesByThreadId, setMessagesByThreadId] = useState<Record<string, ThreadMessage[]>>(
    () =>
      initialActiveThreadId
        ? {
            [initialActiveThreadId]: initialActiveThreadMessages,
          }
        : {},
  );
  const [markdown, setMarkdown] = useState(initialSnapshot.note?.markdown || "");
  const [question, setQuestion] = useState("");
  const [selectedModel, setSelectedModel] = useState(initialSettings.chatModel || "gemini-2.5-pro");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [reprocessLoading, setReprocessLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [threadLoadingId, setThreadLoadingId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [isPending, startTransition] = useTransition();

  const sortedSources = useMemo(() => sortSources(snapshot.sources), [snapshot.sources]);
  const chatMessages = activeThreadId ? messagesByThreadId[activeThreadId] ?? [] : [];
  const chatModels = modelCatalog.models.filter((model) => model.kind === "chat");
  const sourceScopeIds = selectedScopeSourceIds.length > 0 ? selectedScopeSourceIds : undefined;
  const selectedSource = selectedSourceId ? sourceDetails[selectedSourceId] ?? null : null;

  useEffect(() => {
    const updateLayout = () => {
      const compact = window.innerWidth < 1280;
      setIsCompact(compact);

      if (compact) {
        setLeftMode("collapsed");
        setRightCollapsed(true);
        setHistoryOpen(false);
      } else {
        setLeftMode((current) => (current === "collapsed" ? "list" : current));
        setRightCollapsed(false);
      }
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    setTitleDraft(snapshot.notebook.title);
  }, [snapshot.notebook.title]);

  useEffect(() => {
    if (
      modelCatalogCache &&
      Date.now() - modelCatalogCache.fetchedAt < MODEL_CATALOG_CACHE_TTL
    ) {
      setModelCatalog(modelCatalogCache.catalog);
      return;
    }

    void refreshModels(true);
  }, []);

  useEffect(() => {
    if (leftMode !== "viewer" || !selectedSourceId || sourceDetails[selectedSourceId]) {
      return;
    }

    let ignore = false;
    setSourceDetailLoadingId(selectedSourceId);
    fetch(`/api/sources/${selectedSourceId}`)
      .then((response) => response.json())
      .then((payload) => {
        if (!ignore && payload?.id) {
          setSourceDetails((current) => ({ ...current, [payload.id]: payload }));
        }
      })
      .finally(() => {
        if (!ignore) {
          setSourceDetailLoadingId((current) => (current === selectedSourceId ? null : current));
        }
      });

    return () => {
      ignore = true;
    };
  }, [leftMode, selectedSourceId, sourceDetails]);

  useEffect(() => {
    if (selectedSourceId && snapshot.sources.some((source) => source.id === selectedSourceId)) {
      return;
    }

    setSelectedSourceId(sortedSources[0]?.id ?? null);
  }, [selectedSourceId, snapshot.sources, sortedSources]);

  useEffect(() => {
    if (!activeThreadId || messagesByThreadId[activeThreadId]) {
      return;
    }

    void loadThreadMessages(activeThreadId);
  }, [activeThreadId, messagesByThreadId]);

  const syncLocalNote = (nextMarkdown: string) => {
    const updatedAt = new Date().toISOString();
    setSnapshot((current) => ({
      ...current,
      notebook: {
        ...current.notebook,
        updatedAt,
      },
      note: current.note
        ? {
            ...current.note,
            markdown: nextMarkdown,
            updatedAt,
          }
        : {
            id: "local-note",
            markdown: nextMarkdown,
            updatedAt,
          },
    }));
  };

  const mergeSourceDetail = (detail: SourceDetail | null) => {
    if (!detail) {
      return;
    }

    setSourceDetails((current) => ({ ...current, [detail.id]: detail }));
  };

  const refreshSnapshot = async (preferredSourceId?: string | null) => {
    const response = await fetch(`/api/notebooks/${snapshot.notebook.id}`);
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as NotebookSnapshot;
    setSnapshot(payload);
    setMarkdown(payload.note?.markdown || "");
    mergeSourceDetail(payload.initialSourceDetail);
    setSelectedScopeSourceIds((current) =>
      current.filter((sourceId) => payload.sources.some((source) => source.id === sourceId)),
    );

    const nextSelectedId =
      preferredSourceId && payload.sources.some((source) => source.id === preferredSourceId)
        ? preferredSourceId
        : payload.sources[0]?.id ?? null;
    setSelectedSourceId(nextSelectedId);
    return payload;
  };

  const openListPanel = () => {
    if (isCompact) {
      setRightCollapsed(true);
    }
    setLeftMode("list");
  };

  const openViewer = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    setLeftMode("viewer");
    if (isCompact) {
      setRightCollapsed(true);
    }
  };

  const openRightPanel = () => {
    if (isCompact) {
      setLeftMode("collapsed");
    }
    setRightCollapsed(false);
  };

  const closeCompactPanels = () => {
    if (isCompact) {
      setLeftMode("collapsed");
      setRightCollapsed(true);
      setHistoryOpen(false);
    }
  };

  const importSource = () => {
    setImportError(null);
    setSourceActionError(null);
    setImportLoading(true);
    startTransition(async () => {
      try {
        let response: Response;

        if (sourceType === "pdf") {
          const formData = new FormData();
          formData.set("type", sourceType);
          formData.set("input", sourceFile?.name || "");
          formData.set("notebookId", snapshot.notebook.id);
          if (sourceFile) {
            formData.set("file", sourceFile);
          }
          response = await fetch("/api/sources/import", {
            method: "POST",
            body: formData,
          });
        } else {
          response = await fetch("/api/sources/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: sourceType,
              input: sourceInput,
              notebookId: snapshot.notebook.id,
            }),
          });
        }

        const payload = await response.json();
        if (!response.ok) {
          setImportError(payload.error || "导入失败");
          return;
        }

        await refreshSnapshot(payload.sourceId ?? null);
        if (payload.sourceId) {
          setSelectedSourceId(payload.sourceId);
          openListPanel();
        }
        setSourceInput("");
        setSourceFile(null);
      } finally {
        setImportLoading(false);
      }
    });
  };

  const regenerateSummary = () => {
    setSummaryLoading(true);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/notebooks/${snapshot.notebook.id}/summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelKey: selectedModel,
            sourceIds: sourceScopeIds,
          }),
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        setMarkdown(payload.markdown);
        syncLocalNote(payload.markdown);
        setIsEditingSummary(false);
      } finally {
        setSummaryLoading(false);
      }
    });
  };

  const saveSummary = () => {
    startTransition(async () => {
      const response = await fetch(`/api/notebooks/${snapshot.notebook.id}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, modelKey: selectedModel, sourceIds: sourceScopeIds }),
      });

      if (!response.ok) {
        return;
      }

      syncLocalNote(markdown);
      setIsEditingSummary(false);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1400);
    });
  };

  const saveTitle = () => {
    if (!titleDraft.trim()) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/notebooks/${snapshot.notebook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleDraft.trim() }),
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      setSnapshot((current) => ({
        ...current,
        notebook: payload.notebook,
      }));
      setIsEditingTitle(false);
    });
  };

  const saveSourceTitle = (sourceId: string) => {
    const nextTitle = editingSourceTitle.trim();
    if (!nextTitle) {
      setEditingSourceId(null);
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      setSnapshot((current) => ({
        ...current,
        sources: current.sources.map((source) =>
          source.id === sourceId ? { ...source, title: nextTitle, updatedAt: new Date().toISOString() } : source,
        ),
      }));
      if (payload.source?.id) {
        mergeSourceDetail(payload.source);
      }
      setEditingSourceId(null);
    });
  };

  const toggleSourceScope = (sourceId: string) => {
    setSelectedScopeSourceIds((current) =>
      current.includes(sourceId)
        ? current.filter((item) => item !== sourceId)
        : [...current, sourceId],
    );
  };

  const startNewChat = () => {
    setActiveThreadId(null);
    setHistoryOpen(false);
    setQuestion("");
  };

  const handleModelChange = (nextModel: string) => {
    setSelectedModel(nextModel);
    const nextSettings = {
      ...settingsState,
      chatModel: nextModel,
    };
    setSettingsState(nextSettings);
    void fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextSettings),
    })
      .then((response) => response.json())
      .then((payload) => {
        setSettingsState(payload.settings);
      })
      .catch(() => undefined);
  };

  const refreshModels = async (silent = false) => {
    if (!silent) {
      setModelLoading(true);
    }

    return fetch("/api/models")
      .then((response) => response.json())
      .then((payload) => {
        setModelCatalog(payload);
        modelCatalogCache = {
          fetchedAt: Date.now(),
          catalog: payload,
        };
      })
      .finally(() => {
        if (!silent) {
          setModelLoading(false);
        }
      });
  };

  const loadThreadMessages = async (threadId: string, force = false) => {
    if (!force && messagesByThreadId[threadId]) {
      return messagesByThreadId[threadId];
    }

    setThreadLoadingId(threadId);
    return fetch(`/api/notebooks/${snapshot.notebook.id}/threads/${threadId}`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.messages) {
          setMessagesByThreadId((current) => ({
            ...current,
            [threadId]: payload.messages,
          }));
          return payload.messages as ThreadMessage[];
        }

        return [];
      })
      .finally(() => setThreadLoadingId((current) => (current === threadId ? null : current)));
  };

  const sendMessage = () => {
    if (!question.trim()) {
      return;
    }

    setChatLoading(true);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/notebooks/${snapshot.notebook.id}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: activeThreadId ?? undefined,
            message: question,
            useWebSearch,
            modelKey: selectedModel,
            sourceIds: sourceScopeIds,
          }),
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        setThreadSummaries(payload.threadSummaries);
        setMessagesByThreadId((current) => ({
          ...current,
          [payload.threadId]: payload.activeThreadMessages ?? [],
        }));
        setActiveThreadId(payload.threadId);
        setHistoryOpen(false);
        setQuestion("");
      } finally {
        setChatLoading(false);
      }
    });
  };

  const deleteSource = (sourceId: string) => {
    setRowLoadingId(sourceId);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/sources/${sourceId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          return;
        }

        setSnapshot((current) => ({
          ...current,
          sources: current.sources.filter((source) => source.id !== sourceId),
        }));
        setSourceDetails((current) => {
          const next = { ...current };
          delete next[sourceId];
          return next;
        });
        setSelectedScopeSourceIds((current) => current.filter((id) => id !== sourceId));

        if (selectedSourceId === sourceId) {
          const remaining = sortedSources.filter((source) => source.id !== sourceId);
          setSelectedSourceId(remaining[0]?.id ?? null);
          setLeftMode(remaining.length ? "list" : "collapsed");
        }
      } finally {
        setRowLoadingId(null);
      }
    });
  };

  const handleCitationClick = (citation: Citation) => {
    setSelectedSourceId(citation.sourceId);
    setFocusTarget({
      sourceId: citation.sourceId,
      segmentId: citation.segmentId ?? null,
      page: citation.page ?? null,
      timestampStart: citation.timestampStart ?? null,
      nonce: `${citation.sourceId}-${citation.segmentId ?? "none"}-${Date.now()}`,
    });
    openViewer(citation.sourceId);
  };

  const reprocessSource = (transcriptText?: string) => {
    if (!selectedSourceId) {
      return;
    }

    setSourceActionError(null);
    setReprocessLoading(true);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/sources/${selectedSourceId}/reprocess`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(transcriptText ? { transcriptText } : {}),
        });

        const payload = await response.json();
        if (!response.ok) {
          setSourceActionError(payload.error || "刷新来源失败");
          return;
        }

        if (payload.source?.id) {
          mergeSourceDetail(payload.source);
        }
        await refreshSnapshot(selectedSourceId);
      } finally {
        setReprocessLoading(false);
      }
    });
  };

  const exportMarkdown = async () => {
    const response = await fetch(`/api/notebooks/${snapshot.notebook.id}/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown, modelKey: selectedModel, sourceIds: sourceScopeIds }),
    });

    if (response.ok) {
      syncLocalNote(markdown);
    }

    const exportResponse = await fetch(`/api/notebooks/${snapshot.notebook.id}/export-markdown`, {
      method: "POST",
    });

    if (exportResponse.ok) {
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1400);
    }
  };

  const sourcePlaceholder =
    selectedScopeSourceIds.length > 0 ? `当前选中 ${selectedScopeSourceIds.length} 个来源` : "全部来源";

  const leftColumn =
    leftMode === "collapsed"
      ? "72px"
      : leftMode === "viewer"
        ? "minmax(540px, 700px)"
        : "minmax(340px, 430px)";
  const rightColumn = rightCollapsed ? "72px" : "minmax(320px, 420px)";
  const gridTemplateColumns = `${leftColumn} minmax(0, 1fr) ${rightColumn}`;

  return (
    <main className="flex h-screen overflow-hidden bg-fog px-4 py-4">
      <div className="flex min-h-0 w-full flex-col gap-4">
        <header className="flex h-[68px] shrink-0 items-center justify-between rounded-[28px] border border-white/70 bg-white/90 px-5 shadow-panel">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              className="inline-flex items-center gap-2 rounded-2xl border border-line bg-fog px-4 py-2 text-sm text-slate-600 transition hover:border-accent hover:text-accent"
              href="/"
            >
              <ChevronLeft className="h-4 w-4" />
              豆花
            </Link>
            {isEditingTitle ? (
              <input
                autoFocus
                className="min-w-0 rounded-xl border border-line bg-fog px-3 py-2 text-lg font-semibold text-slate-900 outline-none focus:border-accent"
                onBlur={saveTitle}
                onChange={(event) => setTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveTitle();
                  }
                }}
                value={titleDraft}
              />
            ) : (
              <button
                className="truncate text-left text-lg font-semibold text-slate-900"
                onDoubleClick={() => setIsEditingTitle(true)}
                type="button"
              >
                {snapshot.notebook.title}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 xl:hidden">
              <button
                className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-slate-700"
                onClick={openListPanel}
                type="button"
              >
                来源
              </button>
              <button
                className="rounded-2xl border border-line bg-white px-3 py-2 text-sm text-slate-700"
                onClick={openRightPanel}
                type="button"
              >
                聊天
              </button>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-accent hover:text-accent"
              href={`/settings?back=/notebooks/${snapshot.notebook.id}`}
            >
              <Settings2 className="h-4 w-4" />
              设置
            </Link>
          </div>
        </header>

        <section
          className={cn(
            "min-h-0 flex-1",
            isCompact
              ? "relative overflow-hidden"
              : "motion-grid grid gap-4",
          )}
          style={isCompact ? undefined : { gridTemplateColumns }}
        >
          {isCompact && (leftMode !== "collapsed" || !rightCollapsed) ? (
            <button
              aria-label="关闭侧栏"
              className="absolute inset-0 z-10 bg-slate-900/20"
              onClick={closeCompactPanels}
              type="button"
            />
          ) : null}

          <aside
            className={cn(
              "motion-panel flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-panel",
              isCompact
                ? leftMode === "viewer"
                  ? "absolute inset-y-0 left-0 z-20 w-[min(96vw,720px)]"
                  : "absolute inset-y-0 left-0 z-20 w-[min(92vw,430px)]"
                : "",
              isCompact && leftMode === "collapsed" ? "-translate-x-[110%]" : "translate-x-0",
            )}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line/70 px-4">
              {leftMode === "viewer" ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <button
                    className="motion-button inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-slate-500 hover:border-accent hover:text-accent"
                    onClick={openListPanel}
                    type="button"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div
                    className={cn(
                      "title-marquee group min-w-0 flex-1 overflow-hidden font-semibold text-slate-900",
                      (selectedSource?.title?.length ?? 0) > 28 && "is-overflowing",
                    )}
                    title={selectedSource?.title || "来源查看"}
                  >
                    <div className="title-marquee-track">
                      <span>{selectedSource?.title || "来源查看"}</span>
                      {(selectedSource?.title?.length ?? 0) > 28 ? (
                        <span aria-hidden="true" className="pl-10">
                          {selectedSource?.title || "来源查看"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {selectedSource?.url ? (
                      <a
                        className="motion-button inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-slate-600 hover:border-accent hover:text-accent"
                        href={selectedSource.url}
                        rel="noreferrer"
                        target="_blank"
                        title="打开原始链接"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                    {selectedSource ? (
                      <button
                        className="motion-button inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-slate-600 hover:border-accent hover:text-accent disabled:opacity-60"
                        disabled={reprocessLoading}
                        onClick={() => reprocessSource()}
                        title="刷新来源内容"
                        type="button"
                      >
                        {reprocessLoading ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCcw className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : leftMode === "collapsed" && !isCompact ? null : (
                <div className="font-semibold text-slate-900">来源</div>
              )}
              <button
                className="motion-button rounded-full border border-line p-2 text-slate-500 hover:border-accent hover:text-accent"
                onClick={() =>
                  setLeftMode((current) => (current === "collapsed" ? "list" : "collapsed"))
                }
                type="button"
              >
                {leftMode === "collapsed" ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            </div>

            {leftMode === "collapsed" && !isCompact ? (
              <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto p-3">
                {sortedSources.map((source) => {
                  const Icon = sourceIcon(source.type);
                  const inScope = selectedScopeSourceIds.includes(source.id);
                  return (
                    <button
                      className={cn(
                        "relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border transition",
                        selectedSourceId === source.id
                          ? "border-accent bg-accentSoft text-accent"
                          : "border-line bg-white text-slate-500",
                      )}
                      key={source.id}
                      onClick={() => openViewer(source.id)}
                      title={source.title}
                      type="button"
                    >
                      <Icon className="h-5 w-5" />
                      {inScope ? (
                        <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {leftMode === "list" ? (
              <>
                <div className="shrink-0 space-y-3 border-b border-line/70 px-4 py-4">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: "web" as const, Icon: Globe, label: "网页" },
                      { type: "youtube" as const, Icon: Video, label: "视频" },
                      { type: "pdf" as const, Icon: FileText, label: "PDF" },
                    ].map(({ type, Icon, label }) => (
                      <button
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm transition",
                          sourceType === type
                            ? "border-accent bg-accentSoft text-accent"
                            : "border-line bg-white text-slate-600",
                        )}
                        key={type}
                        onClick={() => setSourceType(type)}
                        type="button"
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex min-w-0 gap-3">
                    {sourceType === "pdf" ? (
                      <label
                        className="flex min-w-0 flex-1 items-center rounded-2xl border border-line bg-fog px-4 py-3 text-sm text-slate-600"
                        title={sourceFile?.name || "选择 PDF 文件"}
                      >
                        <input
                          accept="application/pdf"
                          className="hidden"
                          onChange={(event) => setSourceFile(event.target.files?.[0] || null)}
                          type="file"
                        />
                        <span className="min-w-0 truncate">{sourceFile?.name || "选择 PDF 文件"}</span>
                      </label>
                    ) : (
                      <input
                        className="min-w-0 flex-1 rounded-2xl border border-line bg-fog px-4 py-3 text-sm outline-none focus:border-accent"
                        onChange={(event) => setSourceInput(event.target.value)}
                        placeholder={sourceType === "web" ? "输入网页 URL" : "输入 YouTube URL"}
                        value={sourceInput}
                      />
                    )}

                    <button
                      className="inline-flex w-[96px] shrink-0 items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-accent disabled:opacity-60"
                      disabled={
                        importLoading || isPending || (sourceType === "pdf" ? !sourceFile : !sourceInput.trim())
                      }
                      onClick={importSource}
                      type="button"
                    >
                      {importLoading ? <LoadingDots label="导入中" /> : <span className="inline-flex items-center gap-2"><Upload className="h-4 w-4" />导入</span>}
                    </button>
                  </div>

                  {importError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                      {importError}
                    </div>
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="space-y-3">
                    {sortedSources.map((source) => (
                      <SourceRow
                        editing={editingSourceId === source.id}
                        editingTitle={editingSourceId === source.id ? editingSourceTitle : source.title}
                        inScope={selectedScopeSourceIds.includes(source.id)}
                        key={source.id}
                        loading={rowLoadingId === source.id}
                        onDelete={() => deleteSource(source.id)}
                        onEditCancel={() => setEditingSourceId(null)}
                        onEditChange={setEditingSourceTitle}
                        onEditCommit={() => saveSourceTitle(source.id)}
                        onSelect={() => setSelectedSourceId(source.id)}
                        onStartEdit={() => {
                          setEditingSourceId(source.id);
                          setEditingSourceTitle(source.title);
                        }}
                        onToggleScope={() => toggleSourceScope(source.id)}
                        onView={() => openViewer(source.id)}
                        selected={selectedSourceId === source.id}
                        source={source}
                      />
                    ))}
                    {sortedSources.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-line bg-white/60 p-8 text-center text-sm text-slate-500">
                        还没有来源，先导入网页、视频或 PDF。
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            {leftMode === "viewer" ? (
              <div className="min-h-0 flex-1 px-4 py-4">
                {sourceActionError ? (
                  <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {sourceActionError}
                  </div>
                ) : null}
                {selectedSourceId && sourceDetailLoadingId === selectedSourceId && !selectedSource ? (
                  <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-line bg-white/60 text-sm text-slate-500">
                    <LoadingDots label="载入来源" />
                  </div>
                ) : (
                  <SourceViewer
                    focusTarget={focusTarget}
                    onSubmitTranscript={selectedSource ? (text) => reprocessSource(text) : undefined}
                    reprocessLoading={reprocessLoading}
                    source={selectedSource}
                  />
                )}
              </div>
            ) : null}
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-panel">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line/70 px-5">
              <div className="font-semibold text-slate-900">摘要</div>
              <div className="flex items-center gap-2">
                {saveState === "saved" ? <span className="text-sm text-accent">已保存</span> : null}
                <button
                  className="inline-flex items-center gap-2 rounded-2xl bg-accent px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                  disabled={summaryLoading}
                  onClick={regenerateSummary}
                  type="button"
                >
                  <RefreshCcw className={cn("h-4 w-4", summaryLoading && "animate-spin")} />
                  {summaryLoading ? <LoadingDots label="生成中" /> : "生成"}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-accent hover:text-accent"
                  onClick={() => (isEditingSummary ? saveSummary() : setIsEditingSummary(true))}
                  type="button"
                >
                  {isEditingSummary ? <Save className="h-4 w-4" /> : <SquarePen className="h-4 w-4" />}
                  {isEditingSummary ? "保存" : "编辑"}
                </button>
                {!isEditingSummary ? (
                  <button
                    className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-accent hover:text-accent"
                    onClick={() => {
                      void exportMarkdown();
                    }}
                    type="button"
                  >
                    <Download className="h-4 w-4" />
                    导出
                  </button>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 p-4">
              {isEditingSummary ? (
                <textarea
                  className="h-full w-full resize-none overflow-y-auto rounded-[24px] border border-line bg-fog/80 px-5 py-5 text-sm leading-7 outline-none transition focus:border-accent"
                  onChange={(event) => setMarkdown(event.target.value)}
                  value={markdown}
                />
              ) : (
                <div className="h-full overflow-y-auto rounded-[24px] border border-line bg-white px-5 py-5">
                  <MarkdownPreview content={markdown || "# 暂无摘要"} />
                </div>
              )}
            </div>
          </section>

          <aside
            className={cn(
              "motion-panel relative flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-panel",
              isCompact ? "absolute inset-y-0 right-0 z-20 w-[min(92vw,420px)]" : "",
              isCompact && rightCollapsed ? "translate-x-[110%]" : "translate-x-0",
            )}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line/70 px-4">
              {!rightCollapsed || isCompact ? <div className="font-semibold text-slate-900">聊天</div> : null}
              <div className="flex items-center gap-2">
                {(!rightCollapsed || isCompact) && threadSummaries.length > 0 ? (
                  <button
                    className={cn(
                      "rounded-full border p-2 text-slate-500 transition hover:border-accent hover:text-accent",
                      historyOpen ? "border-accent text-accent" : "border-line",
                    )}
                    onClick={() => setHistoryOpen((value) => !value)}
                    title="历史"
                    type="button"
                  >
                    <History className="h-4 w-4" />
                  </button>
                ) : null}
                {!rightCollapsed || isCompact ? (
                  <button
                    className="rounded-full border border-line p-2 text-slate-500 transition hover:border-accent hover:text-accent"
                    onClick={startNewChat}
                    title="新建聊天"
                    type="button"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  className="rounded-full border border-line p-2 text-slate-500 transition hover:border-accent hover:text-accent"
                  onClick={() => setRightCollapsed((value) => !value)}
                  type="button"
                >
                  {rightCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!rightCollapsed || isCompact ? (
              <>
                {historyOpen ? (
                  <div className="absolute inset-x-4 top-20 z-20 max-h-[52vh] overflow-y-auto rounded-[24px] border border-line bg-white p-3 shadow-panel">
                    <button
                      className="mb-2 w-full rounded-2xl border border-line bg-fog px-4 py-3 text-left text-sm text-slate-700 transition hover:border-accent hover:text-accent"
                      onClick={startNewChat}
                      type="button"
                    >
                      新聊天
                    </button>
                    <div className="grid gap-2">
                      {threadSummaries.map((thread) => (
                        <button
                          className={cn(
                            "rounded-2xl border px-4 py-3 text-left text-sm transition",
                            activeThreadId === thread.id
                              ? "border-accent bg-accentSoft text-accent"
                              : "border-line bg-white text-slate-700 hover:border-accent",
                          )}
                          key={thread.id}
                          onClick={async () => {
                            setActiveThreadId(thread.id);
                            setHistoryOpen(false);
                            await loadThreadMessages(thread.id);
                          }}
                          type="button"
                        >
                          <div className="truncate font-medium">{thread.title}</div>
                          {thread.lastMessagePreview ? (
                            <div className="mt-1 truncate text-xs text-slate-500">
                              {thread.lastMessagePreview}
                            </div>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5">
                  {chatMessages.length > 0 ? (
                    chatMessages.map((message) => (
                      <div
                        className={cn(
                          "rounded-[24px] border px-4 py-4",
                          message.role === "assistant"
                            ? "border-line bg-white"
                            : "border-accent/20 bg-accentSoft/60",
                        )}
                        key={message.id}
                      >
                        {message.role === "assistant" ? (
                          <MarkdownPreview content={message.content} />
                        ) : (
                          <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                            {message.content}
                          </div>
                        )}
                        {message.citations.length ? (
                          <div className="mt-4 grid gap-2">
                            {message.citations.map((citation, index) => (
                              <button
                                className="rounded-2xl border border-line bg-fog/80 px-3 py-3 text-left text-xs text-slate-600 transition hover:border-accent hover:bg-white"
                                key={`${message.id}-${index}`}
                                onClick={() => handleCitationClick(citation)}
                                type="button"
                              >
                                <div className="mb-1 font-medium text-slate-700">
                                  {citation.sourceTitle} · {formatCitationLabel(citation)}
                                </div>
                                <div>{citation.quotedText}</div>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-line bg-white/60 px-4 py-8 text-center text-sm text-slate-500">
                      从右下角输入问题，系统会基于当前选中的来源范围回答。
                    </div>
                  )}
                  {threadLoadingId === activeThreadId ? (
                    <div className="rounded-[24px] border border-line bg-white px-4 py-4 text-sm text-slate-500">
                      <LoadingDots label="载入对话" />
                    </div>
                  ) : null}
                  {chatLoading ? (
                    <div className="rounded-[24px] border border-line bg-white px-4 py-4 text-sm text-slate-500">
                      <LoadingDots label="思考中" />
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 border-t border-line/70 p-4">
                  {modelCatalog.degraded && modelCatalog.reason ? (
                    <div className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{modelCatalog.reason}</span>
                    </div>
                  ) : null}
                  <div className="rounded-[24px] border border-line bg-white p-3">
                    <textarea
                      className="h-16 w-full resize-none px-2 py-2 text-sm leading-7 outline-none"
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                          event.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder={sourcePlaceholder}
                      value={question}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          className={cn(
                            "inline-flex h-10 items-center gap-2 rounded-2xl px-3 text-sm transition",
                            useWebSearch
                              ? "bg-accentSoft text-accent"
                              : "bg-fog text-slate-600 hover:text-accent",
                          )}
                          onClick={() => setUseWebSearch((value) => !value)}
                          title="联网补充"
                          type="button"
                        >
                          <Wifi className="h-4 w-4" />
                          Tavily
                        </button>
                        <select
                          className="h-10 max-w-[190px] rounded-2xl border-0 bg-fog px-3 text-sm text-slate-700 outline-none"
                          onChange={(event) => handleModelChange(event.target.value)}
                          value={selectedModel}
                        >
                          {chatModels.map((model) => (
                            <option key={model.key} value={model.key}>
                              {model.label}
                            </option>
                          ))}
                        </select>
                        <button
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-fog text-slate-600 transition hover:text-accent"
                          onClick={() => {
                            void refreshModels();
                          }}
                          title="刷新模型列表"
                          type="button"
                        >
                          {modelLoading ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <button
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-accent disabled:opacity-50"
                        disabled={chatLoading || !question.trim()}
                        onClick={sendMessage}
                        type="button"
                      >
                        <Send className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
