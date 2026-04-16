"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  MessageSquare,
  RefreshCcw,
  Save,
  Search,
  Send,
  Upload,
  Video,
} from "lucide-react";

import { MarkdownPreview } from "@/components/markdown-preview";
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
  const [settings, setSettings] = useState(initialSettings);
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
  const [activeThreadId, setActiveThreadId] = useState(initialThreads[0]?.id ?? null);
  const [selectedModel, setSelectedModel] = useState(initialSettings.chatModel || "heuristic-chat");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null,
    [activeThreadId, threads],
  );

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
    startTransition(async () => {
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
    });
  };

  const regenerateSummary = () => {
    startTransition(async () => {
      const response = await fetch(`/api/notebooks/${snapshot.notebook.id}/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelKey: selectedModel,
        }),
      });
      const payload = await response.json();
      setMarkdown(payload.markdown);
      await refreshSnapshot();
    });
  };

  const saveSummary = () => {
    startTransition(async () => {
      await fetch(`/api/notebooks/${snapshot.notebook.id}/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          markdown,
          modelKey: selectedModel,
        }),
      });
      await refreshSnapshot();
    });
  };

  const sendMessage = () => {
    if (!question.trim()) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/notebooks/${snapshot.notebook.id}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    });
  };

  const exportMarkdown = () => {
    startTransition(async () => {
      await fetch(`/api/notebooks/${snapshot.notebook.id}/export-markdown`, {
        method: "POST",
      });
    });
  };

  const saveSettings = () => {
    startTransition(async () => {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      const payload = await response.json();
      setSettings(payload.settings);
      const modelsResponse = await fetch("/api/models");
      const modelsPayload = await modelsResponse.json();
      setModels(modelsPayload.models);
    });
  };

  return (
    <main className="flex min-h-screen flex-col gap-4 px-4 py-4 lg:px-6">
      <header className="flex items-center justify-between rounded-[28px] border border-white/70 bg-white/85 px-5 py-4 shadow-panel">
        <div className="flex items-center gap-4">
          <Link
            className="inline-flex items-center gap-2 rounded-2xl border border-line bg-fog px-4 py-2 text-sm text-slate-600 transition hover:border-accent hover:text-accent"
            href="/"
          >
            <ChevronLeft className="h-4 w-4" />
            返回笔记库
          </Link>
          <div>
            <div className="text-lg font-semibold text-slate-900">{snapshot.notebook.title}</div>
            <div className="text-sm text-slate-500">
              {snapshot.sources.length} 个输入源 · 最近更新 {new Date(snapshot.notebook.updatedAt).toLocaleString("zh-CN")}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-accent hover:text-accent"
            onClick={exportMarkdown}
            type="button"
          >
            导出 Markdown
          </button>
          <button
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent"
            onClick={saveSettings}
            type="button"
          >
            保存设置
          </button>
        </div>
      </header>

      <section className="grid min-h-[calc(100vh-124px)] gap-4 lg:grid-cols-[minmax(72px,0.9fr)_minmax(0,1.2fr)_minmax(72px,0.9fr)]">
        <aside
          className={cn(
            "flex min-h-0 flex-col rounded-[28px] border border-white/70 bg-white/85 shadow-panel transition-all",
            leftCollapsed ? "w-[76px]" : "w-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-line/70 px-4 py-4">
            {!leftCollapsed ? (
              <div>
                <div className="text-sm font-semibold text-slate-800">输入源</div>
                <div className="text-xs text-slate-500">网页 / YouTube / PDF</div>
              </div>
            ) : null}
            <button
              className="rounded-full border border-line p-2 text-slate-500"
              onClick={() => setLeftCollapsed((value) => !value)}
              type="button"
            >
              {leftCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {!leftCollapsed ? (
            <>
              <div className="space-y-3 border-b border-line/70 px-4 py-4">
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
                      onClick={() => setSourceType(type as "web" | "youtube" | "pdf")}
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
                    className="w-full rounded-2xl border border-line bg-fog px-4 py-3 text-sm"
                    onChange={(event) => setSourceInput(event.target.value)}
                    placeholder={sourceType === "web" ? "粘贴网页 URL" : "粘贴 YouTube URL"}
                    value={sourceInput}
                  />
                )}

                {sourceType === "youtube" ? (
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-line bg-fog px-4 py-3 text-sm"
                    onChange={(event) => setTranscriptText(event.target.value)}
                    placeholder="如果拿不到字幕，可在这里粘贴字幕文本"
                    value={transcriptText}
                  />
                ) : null}

                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-accent disabled:opacity-50"
                  disabled={isPending || (sourceType === "pdf" ? !sourceFile : !sourceInput.trim())}
                  onClick={importSource}
                  type="button"
                >
                  <Upload className="h-4 w-4" />
                  导入 source
                </button>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[84px_minmax(0,1fr)]">
                <div className="border-r border-line/70 p-3">
                  <div className="flex flex-col gap-2">
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
                          onClick={() => setSelectedSourceId(source.id)}
                          type="button"
                          title={source.title}
                        >
                          <Icon className="h-5 w-5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="min-h-0 p-3">
                  <SourceViewer source={selectedSource} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center gap-3 p-3">
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
          )}
        </aside>

        <section className="min-h-0 rounded-[28px] border border-white/70 bg-white/88 shadow-panel">
          <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">学习摘要</div>
              <div className="text-xs text-slate-500">Markdown 可编辑，适合直接同步到 Obsidian</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-accent hover:text-accent"
                onClick={regenerateSummary}
                type="button"
              >
                <RefreshCcw className="h-4 w-4" />
                刷新摘要
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-accent"
                onClick={saveSummary}
                type="button"
              >
                <Save className="h-4 w-4" />
                保存摘要
              </button>
            </div>
          </div>

          <div className="grid h-[calc(100%-73px)] min-h-0 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <textarea
              className="min-h-[60vh] rounded-[24px] border border-line bg-fog/80 px-4 py-4 text-sm leading-7 outline-none transition focus:border-accent"
              onChange={(event) => setMarkdown(event.target.value)}
              value={markdown}
            />
            <div className="min-h-[60vh] overflow-y-auto rounded-[24px] border border-line bg-white px-5 py-4">
              <MarkdownPreview content={markdown || "暂无摘要"} />
            </div>
          </div>
        </section>

        <aside
          className={cn(
            "flex min-h-0 flex-col rounded-[28px] border border-white/70 bg-white/85 shadow-panel transition-all",
            rightCollapsed ? "w-[76px]" : "w-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-line/70 px-4 py-4">
            {!rightCollapsed ? (
              <div>
                <div className="text-sm font-semibold text-slate-800">引用聊天</div>
                <div className="text-xs text-slate-500">默认只问当前 notebook，可手动开启联网补充</div>
              </div>
            ) : null}
            <button
              className="rounded-full border border-line p-2 text-slate-500"
              onClick={() => setRightCollapsed((value) => !value)}
              type="button"
            >
              {rightCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {!rightCollapsed ? (
            <>
              <div className="space-y-3 border-b border-line/70 px-4 py-4">
                <select
                  className="w-full rounded-2xl border border-line bg-fog px-4 py-3 text-sm"
                  onChange={(event) => setActiveThreadId(event.target.value)}
                  value={activeThread?.id || ""}
                >
                  {threads.map((thread) => (
                    <option key={thread.id} value={thread.id}>
                      {thread.title}
                    </option>
                  ))}
                </select>

                <select
                  className="w-full rounded-2xl border border-line bg-fog px-4 py-3 text-sm"
                  onChange={(event) => setSelectedModel(event.target.value)}
                  value={selectedModel}
                >
                  {models
                    .filter((model) => model.kind === "chat")
                    .map((model) => (
                      <option key={model.key} value={model.key}>
                        {model.label}
                      </option>
                    ))}
                </select>

                <label className="flex items-center gap-3 rounded-2xl border border-line bg-fog px-4 py-3 text-sm text-slate-600">
                  <input
                    checked={useWebSearch}
                    onChange={(event) => setUseWebSearch(event.target.checked)}
                    type="checkbox"
                  />
                  开启 Tavily 联网补充
                </label>

                <div className="grid gap-2">
                  <input
                    className="rounded-2xl border border-line bg-white px-4 py-3 text-sm"
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, tavilyApiKey: event.target.value || null }))
                    }
                    placeholder="Tavily API Key"
                    value={settings.tavilyApiKey ?? ""}
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {activeThread?.messages.length ? (
                  activeThread.messages.map((message) => (
                    <div
                      className={cn(
                        "rounded-[24px] border px-4 py-4",
                        message.role === "assistant"
                          ? "border-line bg-white"
                          : "border-accent/20 bg-accentSoft/60",
                      )}
                      key={message.id}
                    >
                      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                        {message.role === "assistant" ? (
                          <MessageSquare className="h-4 w-4" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        {message.role}
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {message.content}
                      </div>
                      {message.citations.length ? (
                        <div className="mt-4 grid gap-2">
                          {message.citations.map((citation, index) => (
                            <div className="rounded-2xl border border-line bg-fog/80 px-3 py-3 text-xs text-slate-600" key={`${message.id}-${index}`}>
                              <div className="mb-1 font-medium text-slate-700">
                                {citation.sourceTitle} · {citation.locator}
                              </div>
                              <div>{citation.quotedText}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-line bg-white/70 p-8 text-center text-sm text-slate-500">
                    先问一个问题，回答会只基于当前 notebook，并附带引用。
                  </div>
                )}
              </div>

              <div className="border-t border-line/70 px-4 py-4">
                <div className="mb-3 grid gap-3">
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-line bg-fog px-4 py-3 text-sm leading-7"
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="例如：总结这份资料的核心观点，并指出证据在哪"
                    value={question}
                  />
                </div>
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-accent disabled:opacity-50"
                  disabled={isPending || !question.trim()}
                  onClick={sendMessage}
                  type="button"
                >
                  <Send className="h-4 w-4" />
                  发送问题
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center gap-3 p-3">
              <button
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-white text-slate-500"
                onClick={() => setRightCollapsed(false)}
                type="button"
              >
                <MessageSquare className="h-5 w-5" />
              </button>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
