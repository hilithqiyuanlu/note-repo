"use client";

import { useState, useTransition } from "react";

import type { AppSettingsRecord } from "@/lib/types";

export function SettingsForm({
  initialSettings,
}: {
  initialSettings: AppSettingsRecord;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const saveSettings = () => {
    startTransition(async () => {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await response.json();
      setSettings(payload.settings);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    });
  };

  return (
    <section className="grid gap-5 rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-panel">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Chat Provider
          <input
            className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
            onChange={(event) =>
              setSettings((current) => ({ ...current, chatProvider: event.target.value }))
            }
            placeholder="heuristic / ollama / openai"
            value={settings.chatProvider}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Chat Model
          <input
            className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
            onChange={(event) =>
              setSettings((current) => ({ ...current, chatModel: event.target.value }))
            }
            placeholder="heuristic-chat / llama3.1 / gpt-4.1-mini"
            value={settings.chatModel}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
          Chat Base URL
          <input
            className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
            onChange={(event) =>
              setSettings((current) => ({ ...current, chatBaseUrl: event.target.value || null }))
            }
            placeholder="http://localhost:11434/v1"
            value={settings.chatBaseUrl ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
          Chat API Key
          <input
            className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
            onChange={(event) =>
              setSettings((current) => ({ ...current, chatApiKey: event.target.value || null }))
            }
            placeholder="可留空"
            type="password"
            value={settings.chatApiKey ?? ""}
          />
        </label>
      </div>

      <div className="h-px bg-line/70" />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Embedding Provider
          <input
            className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
            onChange={(event) =>
              setSettings((current) => ({ ...current, embeddingProvider: event.target.value }))
            }
            placeholder="ollama / openai / gemini"
            value={settings.embeddingProvider}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Embedding Model
          <input
            className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
            onChange={(event) =>
              setSettings((current) => ({ ...current, embeddingModel: event.target.value }))
            }
            placeholder="nomic-embed-text / text-embedding-3-small"
            value={settings.embeddingModel}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
          Embedding Base URL
          <input
            className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                embeddingBaseUrl: event.target.value || null,
              }))
            }
            placeholder="http://localhost:11434/v1"
            value={settings.embeddingBaseUrl ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
          Embedding API Key
          <input
            className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                embeddingApiKey: event.target.value || null,
              }))
            }
            type="password"
            value={settings.embeddingApiKey ?? ""}
          />
        </label>
      </div>

      <div className="h-px bg-line/70" />

      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Tavily API Key
          <input
            className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
            onChange={(event) =>
              setSettings((current) => ({ ...current, tavilyApiKey: event.target.value || null }))
            }
            type="password"
            value={settings.tavilyApiKey ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Markdown 导出目录
          <input
            className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
            onChange={(event) =>
              setSettings((current) => ({ ...current, exportDir: event.target.value || null }))
            }
            placeholder="默认 storage/exports"
            value={settings.exportDir ?? ""}
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved ? <span className="text-sm text-accent">已保存</span> : null}
        <button
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-accent disabled:opacity-50"
          disabled={isPending}
          onClick={saveSettings}
          type="button"
        >
          {isPending ? "保存中..." : "保存设置"}
        </button>
      </div>
    </section>
  );
}
