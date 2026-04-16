"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { BookOpen, Plus, Settings2, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AppSettingsRecord } from "@/lib/types";

type NotebookRow = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export function NotebookLibrary({
  initialNotebooks,
  initialSettings,
}: {
  initialNotebooks: NotebookRow[];
  initialSettings: AppSettingsRecord;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notebooks, setNotebooks] = useState(initialNotebooks);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const [isPending, startTransition] = useTransition();

  const sorted = useMemo(
    () => [...notebooks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [notebooks],
  );

  const createNotebook = () => {
    if (!title.trim()) {
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/notebooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
        }),
      });
      const payload = await response.json();
      setNotebooks((current) => [payload.notebook.notebook, ...current]);
      setTitle("");
      setDescription("");
    });
  };

  const deleteNotebook = (id: string) => {
    startTransition(async () => {
      await fetch(`/api/notebooks/${id}`, { method: "DELETE" });
      setNotebooks((current) => current.filter((item) => item.id !== id));
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
      setSettingsOpen(false);
    });
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-10">
      <div className="mb-10 flex items-start justify-between gap-6">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-line/70 bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm">
            <BookOpen className="h-4 w-4 text-accent" />
            cuflow MVP
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            本地优先的知识工作台
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            左侧读原文，中间沉淀 Markdown 摘要，右侧对当前 notebook 做引用式问答。
          </p>
        </div>

        <button
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-accent hover:text-accent"
          onClick={() => setSettingsOpen((value) => !value)}
          type="button"
        >
          <Settings2 className="h-4 w-4" />
          设置
        </button>
      </div>

      <section className="mb-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-panel backdrop-blur">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500">
            <Plus className="h-4 w-4" />
            创建 notebook
          </div>
          <div className="grid gap-4">
            <input
              className="rounded-2xl border border-line bg-fog px-4 py-3 outline-none ring-0 transition focus:border-accent"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：Transformer 学习笔记"
              value={title}
            />
            <textarea
              className="min-h-24 rounded-2xl border border-line bg-fog px-4 py-3 outline-none transition focus:border-accent"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="一句话说明这个 notebook 的目标"
              value={description}
            />
            <button
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-accent disabled:opacity-50"
              disabled={isPending || !title.trim()}
              onClick={createNotebook}
              type="button"
            >
              新建 notebook
            </button>
          </div>
        </div>

        <div
          className={cn(
            "rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-panel backdrop-blur transition",
            settingsOpen ? "opacity-100" : "opacity-70",
          )}
        >
          <div className="mb-4 text-sm font-medium text-slate-500">默认设置</div>
          <div className="grid gap-3">
            <input
              className="rounded-2xl border border-line bg-fog px-4 py-3 outline-none transition focus:border-accent"
              onChange={(event) =>
                setSettings((current) => ({ ...current, chatBaseUrl: event.target.value || null }))
              }
              placeholder="Chat Base URL，例如 http://localhost:11434/v1"
              value={settings.chatBaseUrl ?? ""}
            />
            <input
              className="rounded-2xl border border-line bg-fog px-4 py-3 outline-none transition focus:border-accent"
              onChange={(event) =>
                setSettings((current) => ({ ...current, chatApiKey: event.target.value || null }))
              }
              placeholder="Chat API Key，可留空"
              value={settings.chatApiKey ?? ""}
            />
            <input
              className="rounded-2xl border border-line bg-fog px-4 py-3 outline-none transition focus:border-accent"
              onChange={(event) =>
                setSettings((current) => ({ ...current, chatModel: event.target.value }))
              }
              placeholder="Chat Model"
              value={settings.chatModel}
            />
            <button
              className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-accent hover:text-accent"
              disabled={isPending}
              onClick={saveSettings}
              type="button"
            >
              保存默认设置
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-line bg-white/60 p-10 text-center text-slate-500">
            还没有 notebook，先创建一个开始导入资料。
          </div>
        ) : null}

        {sorted.map((notebook) => (
          <article
            className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-panel backdrop-blur"
            key={notebook.id}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{notebook.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {notebook.description || "暂无描述"}
                </p>
              </div>
              <button
                className="rounded-full border border-line p-2 text-slate-500 transition hover:border-red-300 hover:text-red-500"
                onClick={() => deleteNotebook(notebook.id)}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-5 text-xs text-slate-400">
              最近更新：{new Date(notebook.updatedAt).toLocaleString("zh-CN")}
            </div>

            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-accent"
              href={`/notebooks/${notebook.id}`}
            >
              进入工作台
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
