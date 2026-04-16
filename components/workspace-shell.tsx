"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Check,
  ChevronLeft,
  CircleCheck,
  Download,
  FileText,
  Globe,
  History,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  RefreshCcw,
  Save,
  Send,
  Settings2,
  Upload,
  Video,
  Wifi,
} from "lucide-react";

import { MarkdownPreview } from "@/components/markdown-preview";
import { SourceViewer } from "@/components/source-viewer";
import type { AppSettingsRecord, Citation, ModelOption, NotebookSnapshot } from "@/lib/types";
import { cn, formatTimestamp } from "@/lib/utils";

type ThreadRecord = {
  id: string;
  title: string;
  modelKey: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    citations: Citation[];
    usedWebSearch: boolean;
    createdAt: string;
  }>;
};

type SourceDetail = {
  id: string;
  notebookId: string;
  type: "web" | "youtube" | "pdf";
  title: string;
  input: string;
  url: string | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span>生成中</span>
      <span className="inline-flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
      </span>
    </span>
  );
}

function formatCitationLabel(citation: Citation) {
  if (citation.kind === "youtube" && citation.timestampStart != null) {
    return formatTimestamp(citation.timestampStart);
  }

  if (citation.kind === "pdf" && citation.page != null) {
    return `第 ${citation.page} 页`;
  }

  return citation.locator;
}

export function WorkspaceShell({
  initialSnapshot,
  initialThreads,
  initialModels,
  initialSettings,
}: {
  initialSnapshot: NotebookSnapshot;
  initialThreads: ThreadRecord[];
  initialModels: ModelOption[];
  initialSettings: AppSettingsRecord;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [threads, setThreads] = useState(initialThreads);
  const [models, setModels] = useState(initialModels);
  const [settingsState, setSettingsState] = useState(initialSettings);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [hoveredSourceId, setHoveredSourceId] = useState<string | null>(null);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initialSnapshot.notebook.title);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [selectedScopeSourceIds, setSelectedScopeSourceIds] = useState<string[]>([]);
  const [sourceType, setSourceType] = useState<"web" | "youtube" | "pdf">("web");
  const [sourceInput, setSourceInput] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState(initialSnapshot.sources[0]?.id ?? null);
  const [selectedSource, setSelectedSource] = useState<SourceDetail | null>(null);
  const [markdown, setMarkdown] = useState(initialSnapshot.note?.markdown || "");
  const [question, setQuestion] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    initialThreads[0]?.id ?? null,
  );
  const [selectedModel, setSelectedModel] = useState(
    initialSettings.chatModel || "gemini-2.5-pro",
  );
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [isPending, startTransition] = useTransition();

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads],
  );
  const chatMessages = activeThread?.messages ?? [];
  const chatModels = models.filter((model) => model.kind === "chat");
  const sourceScopeIds = selectedScopeSourceIds.length > 0 ? selectedScopeSourceIds : undefined;

  useEffect(() => {
    const updateLayout = () => {
      const compact = window.innerWidth < 1280;
      setIsCompact(compact);

      if (compact) {
        setLeftCollapsed(true);
        setRightCollapsed(true);
        setHistoryOpen(false);
      } else {
        setLeftCollapsed(false);
        setRightCollapsed(false);
      }
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    if (!selectedSourceId) {
      setSelectedSource(null);
      return;
    }

    let ignore = false;
    fetch(`/api/sources/${selectedSourceId}`)
      .then((response) => response.json())
      .then((payload) => {
        if (!ignore) {
          setSelectedSource(payload);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedSourceId]);

  useEffect(() => {
    fetch("/api/models")
      .then((response) => response.json())
      .then((payload) => setModels(payload.models ?? initialModels))
      .catch(() => setModels(initialModels));
  }, [initialModels]);

  useEffect(() => {
    setTitleDraft(snapshot.notebook.title);
  }, [snapshot.notebook.title]);

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

  const refreshSnapshot = async () => {
    const response = await fetch(`/api/notebooks/${snapshot.notebook.id}`);
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as NotebookSnapshot;
    setSnapshot(payload);
    setMarkdown(payload.note?.markdown || "");
    setFocusTarget(null);
    setSelectedScopeSourceIds((current) =>
      current.filter((sourceId) => payload.sources.some((source) => source.id === sourceId)),
    );
    if (!selectedSourceId || !payload.sources.some((source) => source.id === selectedSourceId)) {
      setSelectedSourceId(payload.sources[0]?.id ?? null);
    }
  };

  const openLeftPanel = () => {
    if (isCompact) {
      setRightCollapsed(true);
    }
    setLeftCollapsed(false);
  };

  const openRightPanel = () => {
    if (isCompact) {
      setLeftCollapsed(true);
    }
    setRightCollapsed(false);
  };

  const closeCompactPanels = () => {
    if (isCompact) {
      setLeftCollapsed(true);
      setRightCollapsed(true);
      setHistoryOpen(false);
    }
  };

  const importSource = () => {
    setImportError(null);
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

        await refreshSnapshot();
        if (payload.sourceId) {
          setSelectedSourceId(payload.sourceId);
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
        body: JSON.stringify({ markdown, modelKey: selectedModel }),
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
            threadId: activeThread?.id,
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
        setThreads(payload.threads);
        setActiveThreadId(payload.threadId);
        setHistoryOpen(false);
        setQuestion("");
      } finally {
        setChatLoading(false);
      }
    });
  };

  const deleteCurrentSource = () => {
    if (!selectedSourceId) {
      return;
    }

    startTransition(async () => {
      const deletingId = selectedSourceId;
      const response = await fetch(`/api/sources/${deletingId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        return;
      }

      const nextSources = snapshot.sources.filter((source) => source.id !== deletingId);
      const nextSelectedId = nextSources[0]?.id ?? null;
      setSnapshot((current) => ({
        ...current,
        sources: nextSources,
      }));
      setSelectedScopeSourceIds((current) => current.filter((id) => id !== deletingId));
      setSelectedSourceId(nextSelectedId);
      setSelectedSource(null);
      setFocusTarget(null);
      setHoveredSourceId((current) => (current === deletingId ? null : current));
    });
  };

  const handleCitationClick = (citation: Citation) => {
    if (selectedSourceId !== citation.sourceId) {
      setSelectedSourceId(citation.sourceId);
    }

    setFocusTarget({
      sourceId: citation.sourceId,
      segmentId: citation.segmentId ?? null,
      page: citation.page ?? null,
      timestampStart: citation.timestampStart ?? null,
      nonce: `${citation.sourceId}-${citation.segmentId ?? "none"}-${Date.now()}`,
    });
    openLeftPanel();
  };

  const exportMarkdown = async () => {
    const response = await fetch(`/api/notebooks/${snapshot.notebook.id}/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown, modelKey: selectedModel }),
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
    selectedScopeSourceIds.length > 0 ? `${selectedScopeSourceIds.length}个来源` : "全部来源";

  const gridTemplateColumns = `${leftCollapsed ? "72px" : "minmax(280px, 360px)"} minmax(0, 1fr) ${
    rightCollapsed ? "72px" : "minmax(320px, 420px)"
  }`;

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
              笔记库
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
                onClick={openLeftPanel}
                type="button"
              >
                资料
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
              href="/settings"
            >
              <Settings2 className="h-4 w-4" />
              设置
            </Link>
          </div>
        </header>

        <section
          className={cn(
            "min-h-0 flex-1",
            isCompact ? "relative overflow-hidden" : "grid gap-4 transition-[grid-template-columns] duration-300",
          )}
          style={isCompact ? undefined : { gridTemplateColumns }}
        >
          {isCompact && (!leftCollapsed || !rightCollapsed) ? (
            <button
              aria-label="关闭侧栏"
              className="absolute inset-0 z-10 bg-slate-900/20"
              onClick={closeCompactPanels}
              type="button"
            />
          ) : null}

          <aside
            className={cn(
              "flex min-h-0 flex-col overflow-visible rounded-[28px] border border-white/70 bg-white/90 shadow-panel",
              isCompact
                ? "absolute inset-y-0 left-0 z-20 w-[min(88vw,360px)] transition-transform duration-300"
                : "",
              isCompact && leftCollapsed ? "-translate-x-[110%]" : "translate-x-0",
            )}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line/70 px-4">
              {!leftCollapsed || isCompact ? <div className="font-semibold text-slate-900">输入源</div> : null}
              <button
                className="rounded-full border border-line p-2 text-slate-500 transition hover:border-accent hover:text-accent"
                onClick={() => setLeftCollapsed((value) => !value)}
                type="button"
              >
                {leftCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>

            {!isCompact && leftCollapsed ? (
              <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto p-3">
                {snapshot.sources.map((source) => {
                  const Icon =
                    source.type === "web" ? Globe : source.type === "youtube" ? Video : FileText;
                  const inScope = selectedScopeSourceIds.includes(source.id);
                  return (
                    <div
                      className="relative"
                      key={source.id}
                      onMouseEnter={() => setHoveredSourceId(source.id)}
                      onMouseLeave={() =>
                        setHoveredSourceId((current) => (current === source.id ? null : current))
                      }
                    >
                      <button
                        className={cn(
                          "inline-flex h-12 w-12 items-center justify-center rounded-2xl border transition",
                          selectedSourceId === source.id
                            ? "border-accent bg-accentSoft text-accent"
                            : "border-line bg-white text-slate-500",
                        )}
                        onClick={() => {
                          setSelectedSourceId(source.id);
                          setLeftCollapsed(false);
                        }}
                        type="button"
                      >
                        <Icon className="h-5 w-5" />
                      </button>
                      <button
                        className={cn(
                          "absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition",
                          inScope
                            ? "border-accent bg-accent text-white"
                            : "border-line bg-white text-slate-400",
                        )}
                        onClick={() => toggleSourceScope(source.id)}
                        type="button"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      {hoveredSourceId === source.id ? (
                        <div className="pointer-events-none absolute left-[56px] top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                          {source.title}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="shrink-0 space-y-3 border-b border-line/70 p-4">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: "web" as const, Icon: Globe },
                      { type: "youtube" as const, Icon: Video },
                      { type: "pdf" as const, Icon: FileText },
                    ].map(({ type, Icon }) => (
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
                        {type}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    {sourceType === "pdf" ? (
                      <label className="flex flex-1 items-center rounded-2xl border border-line bg-fog px-4 py-3 text-sm text-slate-600">
                        <input
                          accept="application/pdf"
                          className="hidden"
                          onChange={(event) => setSourceFile(event.target.files?.[0] || null)}
                          type="file"
                        />
                        <span className="truncate">{sourceFile?.name || "选择文件"}</span>
                      </label>
                    ) : (
                      <input
                        className="min-w-0 flex-1 rounded-2xl border border-line bg-fog px-4 py-3 text-sm outline-none focus:border-accent"
                        onChange={(event) => setSourceInput(event.target.value)}
                        placeholder={sourceType === "web" ? "网页 URL" : "YouTube URL"}
                        value={sourceInput}
                      />
                    )}

                    <button
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-accent disabled:opacity-50"
                      disabled={
                        importLoading || isPending || (sourceType === "pdf" ? !sourceFile : !sourceInput.trim())
                      }
                      onClick={importSource}
                      type="button"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  </div>

                  {importError ? (
                    <div className="text-xs text-red-500">{importError}</div>
                  ) : null}
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-[64px_minmax(0,1fr)]">
                  <div className="overflow-visible border-r border-line/70 p-3">
                    <div className="flex flex-col gap-2">
                      {snapshot.sources.map((source) => {
                        const Icon =
                          source.type === "web" ? Globe : source.type === "youtube" ? Video : FileText;
                        const inScope = selectedScopeSourceIds.includes(source.id);
                        return (
                          <div
                            className="relative"
                            key={source.id}
                            onMouseEnter={() => setHoveredSourceId(source.id)}
                            onMouseLeave={() =>
                              setHoveredSourceId((current) =>
                                current === source.id ? null : current,
                              )
                            }
                          >
                            <button
                              className={cn(
                                "inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition",
                                selectedSourceId === source.id
                                  ? "border-accent bg-accentSoft text-accent"
                                  : "border-line bg-white text-slate-500",
                              )}
                              onClick={() => setSelectedSourceId(source.id)}
                              title={source.title}
                              type="button"
                            >
                              <Icon className="h-5 w-5" />
                            </button>
                            <button
                              className={cn(
                                "absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition",
                                inScope
                                  ? "border-accent bg-accent text-white"
                                  : "border-line bg-white text-slate-400",
                              )}
                              onClick={() => toggleSourceScope(source.id)}
                              type="button"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            {hoveredSourceId === source.id ? (
                              <div className="pointer-events-none absolute left-[52px] top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
                                {source.title}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="min-h-0 overflow-visible p-3">
                    <SourceViewer
                      focusTarget={focusTarget}
                      inScope={selectedSourceId ? selectedScopeSourceIds.includes(selectedSourceId) : false}
                      onDelete={deleteCurrentSource}
                      onToggleScope={
                        selectedSourceId ? () => toggleSourceScope(selectedSourceId) : undefined
                      }
                      source={selectedSource}
                    />
                  </div>
                </div>
              </>
            )}
          </aside>

          <section
            className={cn(
              "flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-panel",
              isCompact ? "h-full" : "",
            )}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line/70 px-5">
              <div className="font-semibold text-slate-900">摘要</div>
              <div className="flex items-center gap-2">
                {saveState === "saved" ? (
                  <span className="text-sm text-accent">已保存</span>
                ) : null}
                <button
                  className="inline-flex items-center gap-2 rounded-2xl bg-accent px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                  disabled={summaryLoading}
                  onClick={regenerateSummary}
                  type="button"
                >
                  <RefreshCcw className={cn("h-4 w-4", summaryLoading && "animate-spin")} />
                  {summaryLoading ? <LoadingDots /> : "生成"}
                </button>
                <button
                  className="inline-flex items-center rounded-2xl border border-line bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-accent hover:text-accent"
                  onClick={() => setIsEditingSummary((value) => !value)}
                  type="button"
                >
                  {isEditingSummary ? "预览" : "编辑"}
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
              "relative flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-panel",
              isCompact
                ? "absolute inset-y-0 right-0 z-20 w-[min(92vw,420px)] transition-transform duration-300"
                : "",
              isCompact && rightCollapsed ? "translate-x-[110%]" : "translate-x-0",
            )}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line/70 px-4">
              {!rightCollapsed || isCompact ? <div className="font-semibold text-slate-900">聊天</div> : null}
              <div className="flex items-center gap-2">
                {(!rightCollapsed || isCompact) && threads.length > 0 ? (
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
                      {threads.map((thread) => (
                        <button
                          className={cn(
                            "rounded-2xl border px-4 py-3 text-left text-sm transition",
                            activeThreadId === thread.id
                              ? "border-accent bg-accentSoft text-accent"
                              : "border-line bg-white text-slate-700 hover:border-accent",
                          )}
                          key={thread.id}
                          onClick={() => {
                            setActiveThreadId(thread.id);
                            setHistoryOpen(false);
                          }}
                          type="button"
                        >
                          <div className="truncate font-medium">{thread.title}</div>
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
                                className="rounded-2xl border border-line bg-fog/80 px-3 py-3 text-left text-xs text-slate-600"
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
                  ) : null}
                  {chatLoading ? (
                    <div className="rounded-[24px] border border-line bg-white px-4 py-4 text-sm text-slate-500">
                      思考中...
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 border-t border-line/70 p-4">
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
            ) : (
              <div className="flex flex-1 items-start justify-center p-3">
                <button
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-white text-slate-500"
                  onClick={() => setRightCollapsed(false)}
                  type="button"
                >
                  <PanelRightOpen className="h-5 w-5" />
                </button>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
