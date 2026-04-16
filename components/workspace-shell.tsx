"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  History,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RefreshCcw,
  Save,
  Send,
  Settings2,
  Upload,
  Video,
  Wifi,
} from "lucide-react";

import { SourceViewer } from "@/components/source-viewer";
import type { AppSettingsRecord, Citation, ModelOption, NotebookSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [sourceType, setSourceType] = useState<"web" | "youtube" | "pdf">("web");
  const [sourceInput, setSourceInput] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState(initialSnapshot.sources[0]?.id ?? null);
  const [selectedSource, setSelectedSource] = useState<SourceDetail | null>(null);
  const [markdown, setMarkdown] = useState(initialSnapshot.note?.markdown || "");
  const [question, setQuestion] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    initialThreads[0]?.id ?? null,
  );
  const [selectedModel, setSelectedModel] = useState(initialSettings.chatModel || "heuristic-chat");
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

  const refreshSnapshot = async () => {
    const response = await fetch(`/api/notebooks/${snapshot.notebook.id}`);
    const payload = (await response.json()) as NotebookSnapshot;
    setSnapshot(payload);
    setMarkdown(payload.note?.markdown || "");
    if (!selectedSourceId && payload.sources[0]) {
      setSelectedSourceId(payload.sources[0].id);
    }
  };

  const importSource = () => {
    setImportLoading(true);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("type", sourceType);
        formData.set("input", sourceType === "pdf" ? sourceFile?.name || "" : sourceInput);
        formData.set("notebookId", snapshot.notebook.id);
        if (sourceFile) {
          formData.set("file", sourceFile);
        }
        if (transcriptText.trim()) {
          formData.set("transcriptText", transcriptText);
        }

        const response = await fetch("/api/sources/import", {
          method: "POST",
          body: formData,
        });
        const payload = await response.json();
        await refreshSnapshot();
        if (payload.sourceId) {
          setSelectedSourceId(payload.sourceId);
        }
        setSourceInput("");
        setTranscriptText("");
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
          body: JSON.stringify({ modelKey: selectedModel }),
        });
        const payload = await response.json();
        setMarkdown(payload.markdown);
        await refreshSnapshot();
      } finally {
        setSummaryLoading(false);
      }
    });
  };

  const saveSummary = () => {
    startTransition(async () => {
      await fetch(`/api/notebooks/${snapshot.notebook.id}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, modelKey: selectedModel }),
      });
      await refreshSnapshot();
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1400);
    });
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
          }),
        });
        const payload = await response.json();
        setThreads(payload.threads);
        setActiveThreadId(payload.threadId);
        setQuestion("");
      } finally {
        setChatLoading(false);
      }
    });
  };

  const exportMarkdown = () => {
    startTransition(async () => {
      await fetch(`/api/notebooks/${snapshot.notebook.id}/export-markdown`, {
        method: "POST",
      });
    });
  };

  const gridTemplateColumns = `${leftCollapsed ? "72px" : "minmax(280px, 360px)"} minmax(0, 1fr) ${
    rightCollapsed ? "72px" : "minmax(320px, 420px)"
  }`;

  return (
    <main className="flex h-screen overflow-hidden bg-fog px-4 py-4">
      <div className="flex min-h-0 w-full flex-col gap-4">
        <header className="flex h-[68px] shrink-0 items-center justify-between rounded-[28px] border border-white/70 bg-white/90 px-5 shadow-panel">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              className="inline-flex items-center gap-2 rounded-2xl border border-line bg-fog px-4 py-2 text-sm text-slate-600 transition hover:border-accent hover:text-accent"
              href="/"
            >
              <ChevronLeft className="h-4 w-4" />
              笔记库
            </Link>
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold text-slate-900">
                {snapshot.notebook.title}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-accent hover:text-accent"
              onClick={exportMarkdown}
              type="button"
            >
              导出
            </button>
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
          className="grid min-h-0 flex-1 gap-4 transition-[grid-template-columns] duration-300"
          style={{ gridTemplateColumns }}
        >
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-panel">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line/70 px-4">
              {!leftCollapsed ? <div className="font-semibold text-slate-900">输入源</div> : null}
              <button
                className="rounded-full border border-line p-2 text-slate-500 transition hover:border-accent hover:text-accent"
                onClick={() => setLeftCollapsed((value) => !value)}
                type="button"
              >
                {leftCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>

            {leftCollapsed ? (
              <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto p-3">
                {snapshot.sources.map((source) => {
                  const Icon =
                    source.type === "web" ? Globe : source.type === "youtube" ? Video : FileText;
                  return (
                    <button
                      className={cn(
                        "inline-flex h-12 w-12 items-center justify-center rounded-2xl border transition",
                        selectedSourceId === source.id
                          ? "border-accent bg-accentSoft text-accent"
                          : "border-line bg-white text-slate-500",
                      )}
                      key={source.id}
                      onClick={() => {
                        setSelectedSourceId(source.id);
                        setLeftCollapsed(false);
                      }}
                      type="button"
                    >
                      <Icon className="h-5 w-5" />
                    </button>
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

                  {sourceType === "pdf" ? (
                    <input
                      accept="application/pdf"
                      className="w-full rounded-2xl border border-line bg-fog px-4 py-3 text-sm"
                      onChange={(event) => setSourceFile(event.target.files?.[0] || null)}
                      type="file"
                    />
                  ) : (
                    <input
                      className="w-full rounded-2xl border border-line bg-fog px-4 py-3 text-sm outline-none focus:border-accent"
                      onChange={(event) => setSourceInput(event.target.value)}
                      placeholder={sourceType === "web" ? "网页 URL" : "YouTube URL"}
                      value={sourceInput}
                    />
                  )}

                  {sourceType === "youtube" ? (
                    <textarea
                      className="min-h-20 w-full rounded-2xl border border-line bg-fog px-4 py-3 text-sm outline-none focus:border-accent"
                      onChange={(event) => setTranscriptText(event.target.value)}
                      placeholder="可选：字幕文本"
                      value={transcriptText}
                    />
                  ) : null}

                  <button
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-accent disabled:opacity-50"
                    disabled={
                      importLoading || isPending || (sourceType === "pdf" ? !sourceFile : !sourceInput.trim())
                    }
                    onClick={importSource}
                    type="button"
                  >
                    <Upload className="h-4 w-4" />
                    {importLoading ? "导入中..." : "导入"}
                  </button>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-[64px_minmax(0,1fr)]">
                  <div className="overflow-y-auto border-r border-line/70 p-3">
                    <div className="flex flex-col gap-2">
                      {snapshot.sources.map((source) => {
                        const Icon =
                          source.type === "web" ? Globe : source.type === "youtube" ? Video : FileText;
                        return (
                          <button
                            className={cn(
                              "inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition",
                              selectedSourceId === source.id
                                ? "border-accent bg-accentSoft text-accent"
                                : "border-line bg-white text-slate-500",
                            )}
                            key={source.id}
                            onClick={() => setSelectedSourceId(source.id)}
                            title={source.title}
                            type="button"
                          >
                            <Icon className="h-5 w-5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="min-h-0 overflow-hidden p-3">
                    <SourceViewer source={selectedSource} />
                  </div>
                </div>
              </>
            )}
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-panel">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line/70 px-5">
              <div className="font-semibold text-slate-900">摘要</div>
              <div className="flex items-center gap-2">
                {saveState === "saved" ? (
                  <span className="text-sm text-accent">已保存</span>
                ) : null}
                <button
                  className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-accent hover:text-accent disabled:opacity-60"
                  disabled={summaryLoading}
                  onClick={regenerateSummary}
                  type="button"
                >
                  <RefreshCcw className={cn("h-4 w-4", summaryLoading && "animate-spin")} />
                  {summaryLoading ? "生成中..." : "刷新"}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-accent"
                  onClick={saveSummary}
                  type="button"
                >
                  <Save className="h-4 w-4" />
                  保存
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 p-4">
              <textarea
                className="h-full w-full resize-none overflow-y-auto rounded-[24px] border border-line bg-fog/80 px-5 py-5 text-sm leading-7 outline-none transition focus:border-accent"
                onChange={(event) => setMarkdown(event.target.value)}
                value={markdown}
              />
            </div>
          </section>

          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-panel">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line/70 px-4">
              {!rightCollapsed ? <div className="font-semibold text-slate-900">聊天</div> : null}
              <div className="flex items-center gap-2">
                {!rightCollapsed ? (
                  <>
                    <button
                      className="rounded-full border border-line p-2 text-slate-500 transition hover:border-accent hover:text-accent"
                      onClick={() => setActiveThreadId(null)}
                      title="新建聊天"
                      type="button"
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                    </button>
                    {threads.length > 0 ? (
                      <div className="relative">
                        <History className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <select
                          className="h-9 max-w-[160px] rounded-full border border-line bg-white pl-9 pr-3 text-sm text-slate-600 outline-none"
                          onChange={(event) => setActiveThreadId(event.target.value || null)}
                          value={activeThread?.id || ""}
                        >
                          <option value="">新聊天</option>
                          {threads.map((thread) => (
                            <option key={thread.id} value={thread.id}>
                              {thread.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </>
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

            {rightCollapsed ? (
              <div className="flex flex-1 items-start justify-center p-3">
                <button
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-white text-slate-500"
                  onClick={() => setRightCollapsed(false)}
                  type="button"
                >
                  <PanelRightOpen className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <>
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
                        <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {message.content}
                        </div>
                        {message.citations.length ? (
                          <div className="mt-4 grid gap-2">
                            {message.citations.map((citation, index) => (
                              <button
                                className="rounded-2xl border border-line bg-fog/80 px-3 py-3 text-left text-xs text-slate-600"
                                key={`${message.id}-${index}`}
                                onClick={() => setSelectedSourceId(citation.sourceId)}
                                type="button"
                              >
                                <div className="mb-1 font-medium text-slate-700">
                                  {citation.sourceTitle} · {citation.locator}
                                </div>
                                <div>{citation.quotedText}</div>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-line bg-white/70 p-8 text-sm leading-7 text-slate-600">
                      你好，我可以基于当前笔记回答问题。
                    </div>
                  )}
                  {chatLoading ? (
                    <div className="rounded-[24px] border border-line bg-white px-4 py-4 text-sm text-slate-500">
                      思考中...
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 border-t border-line/70 p-4">
                  <div className="rounded-[24px] border border-line bg-white p-3">
                    <textarea
                      className="h-28 w-full resize-none px-2 py-2 text-sm leading-7 outline-none"
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                          sendMessage();
                        }
                      }}
                      placeholder="输入你的问题..."
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
                          className="h-10 max-w-[170px] rounded-2xl border-0 bg-fog px-3 text-sm text-slate-700 outline-none"
                          onChange={(event) => setSelectedModel(event.target.value)}
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
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
