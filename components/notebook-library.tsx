"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { BookOpen, Plus, Settings2, Trash2 } from "lucide-react";

type NotebookRow = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export function NotebookLibrary({
  initialNotebooks,
}: {
  initialNotebooks: NotebookRow[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { title: string; description: string }>>({});
  const [notebooks, setNotebooks] = useState(initialNotebooks);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
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

  const startEdit = (notebook: NotebookRow) => {
    setEditingId(notebook.id);
    setDrafts((current) => ({
      ...current,
      [notebook.id]: {
        title: notebook.title,
        description: notebook.description ?? "",
      },
    }));
  };

  const saveEdit = (id: string) => {
    const draft = drafts[id];

    if (!draft?.title.trim()) {
      setEditingId(null);
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/notebooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description || null,
        }),
      });
      const payload = await response.json();
      setNotebooks((current) =>
        current.map((item) => (item.id === id ? payload.notebook : item)),
      );
      setEditingId(null);
    });
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-10">
      <div className="mb-10 flex items-start justify-between gap-6">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-line/70 bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm">
            <BookOpen className="h-4 w-4 text-accent" />
            NoteRepo
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            笔记库
          </h1>
        </div>

        <Link
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-accent hover:text-accent"
          href="/settings"
        >
          <Settings2 className="h-4 w-4" />
          设置
        </Link>
      </div>

      <section className="mb-8 rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-panel backdrop-blur">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500">
          <Plus className="h-4 w-4" />
          新建
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_1.2fr_auto]">
          <input
            className="rounded-2xl border border-line bg-fog px-4 py-3 outline-none ring-0 transition focus:border-accent"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="笔记标题"
            value={title}
          />
          <input
            className="rounded-2xl border border-line bg-fog px-4 py-3 outline-none transition focus:border-accent"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="目标"
            value={description}
          />
          <button
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-accent disabled:opacity-50"
            disabled={isPending || !title.trim()}
            onClick={createNotebook}
            type="button"
          >
            创建
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-line bg-white/60 p-10 text-center text-slate-500">
            还没有笔记。
          </div>
        ) : null}

        {sorted.map((notebook) => {
          const draft = drafts[notebook.id] ?? {
            title: notebook.title,
            description: notebook.description ?? "",
          };

          return (
            <article
              className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-panel backdrop-blur transition hover:-translate-y-0.5 hover:border-accent/30"
              key={notebook.id}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {editingId === notebook.id ? (
                    <div className="grid gap-2">
                      <input
                        autoFocus
                        className="rounded-xl border border-line bg-fog px-3 py-2 text-xl font-semibold text-slate-900 outline-none focus:border-accent"
                        onBlur={() => saveEdit(notebook.id)}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [notebook.id]: { ...draft, title: event.target.value },
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                        }}
                        value={draft.title}
                      />
                      <input
                        className="rounded-xl border border-line bg-fog px-3 py-2 text-sm text-slate-600 outline-none focus:border-accent"
                        onBlur={() => saveEdit(notebook.id)}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [notebook.id]: { ...draft, description: event.target.value },
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                        }}
                        value={draft.description}
                      />
                    </div>
                  ) : (
                    <>
                      <h2
                        className="cursor-text truncate text-xl font-semibold text-slate-900"
                        onDoubleClick={() => startEdit(notebook)}
                        title="双击编辑"
                      >
                        {notebook.title}
                      </h2>
                      <p
                        className="mt-2 cursor-text text-sm leading-6 text-slate-600"
                        onDoubleClick={() => startEdit(notebook)}
                        title="双击编辑"
                      >
                        {notebook.description || "暂无目标"}
                      </p>
                    </>
                  )}
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
                {new Date(notebook.updatedAt).toLocaleString("zh-CN")}
              </div>

              <Link
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-accent"
                href={`/notebooks/${notebook.id}`}
              >
                打开
              </Link>
            </article>
          );
        })}
      </section>
    </main>
  );
}
