"use client";

import { useState, useTransition } from "react";

import type { AppSettingsRecord } from "@/lib/types";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-[24px] border border-line/70 bg-white/80 p-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

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
    <div className="grid gap-5">
      <Section
        description="保留当前远端 Gemini 作为默认聊天来源。"
        title="远端聊天模型"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Chat Provider
            <input
              className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
              onChange={(event) =>
                setSettings((current) => ({ ...current, chatProvider: event.target.value }))
              }
              placeholder="gemini / openai / ollama"
              value={settings.chatProvider}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            默认聊天模型
            <input
              className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
              onChange={(event) =>
                setSettings((current) => ({ ...current, chatModel: event.target.value }))
              }
              placeholder="models/gemini-3-flash-preview"
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
              placeholder="https://generativelanguage.googleapis.com/v1beta/openai/"
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
              placeholder="远端模型 API Key"
              type="password"
              value={settings.chatApiKey ?? ""}
            />
          </label>
        </div>
      </Section>

      <Section
        description="本地 Ollama 作为可选聊天项，不会替换当前默认 Gemini。"
        title="本地聊天模型"
      >
        <div className="grid gap-4">
          <label className="inline-flex items-center gap-3 rounded-2xl border border-line bg-fog px-4 py-3 text-sm font-medium text-slate-700">
            <input
              checked={settings.localChatEnabled}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  localChatEnabled: event.target.checked,
                }))
              }
              type="checkbox"
            />
            启用本地聊天模型
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              本地服务地址
              <input
                className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    localChatBaseUrl: event.target.value || null,
                  }))
                }
                placeholder="http://127.0.0.1:11434/v1"
                value={settings.localChatBaseUrl ?? ""}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              本地模型名
              <input
                className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    localChatModel: event.target.value || null,
                  }))
                }
                placeholder="qwen3.5:4b"
                value={settings.localChatModel ?? ""}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              本地模型显示名
              <input
                className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    localChatLabel: event.target.value || null,
                  }))
                }
                placeholder="Ollama / qwen3.5:4b"
                value={settings.localChatLabel ?? ""}
              />
            </label>
          </div>
        </div>
      </Section>

      <Section
        description="向量检索继续保持本地 Ollama embedding。"
        title="Embedding"
      >
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
              placeholder="nomic-embed-text"
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
              placeholder="http://127.0.0.1:11434/v1"
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
      </Section>

      <Section
        description="仅远端请求走代理；localhost / 127.0.0.1 会自动直连，不影响 Ollama。"
        title="网络 / 代理"
      >
        <div className="grid gap-4">
          <label className="inline-flex items-center gap-3 rounded-2xl border border-line bg-fog px-4 py-3 text-sm font-medium text-slate-700">
            <input
              checked={settings.proxyEnabled}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  proxyEnabled: event.target.checked,
                }))
              }
              type="checkbox"
            />
            启用 Clash Verge 代理
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              协议
              <select
                className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    proxyProtocol: event.target.value as "http" | "https",
                  }))
                }
                value={settings.proxyProtocol}
              >
                <option value="http">http</option>
                <option value="https">https</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Host
              <input
                className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    proxyHost: event.target.value || null,
                  }))
                }
                placeholder="127.0.0.1"
                value={settings.proxyHost ?? ""}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Port
              <input
                className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    proxyPort: event.target.value ? Number(event.target.value) : null,
                  }))
                }
                placeholder="7897"
                type="number"
                value={settings.proxyPort ?? ""}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 md:col-span-3">
              Bypass Hosts
              <input
                className="rounded-2xl border border-line bg-fog px-4 py-3 font-normal outline-none focus:border-accent"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    proxyBypassHosts: event.target.value || null,
                  }))
                }
                placeholder="localhost,127.0.0.1,::1"
                value={settings.proxyBypassHosts ?? ""}
              />
            </label>
          </div>
        </div>
      </Section>

      <Section title="搜索与导出">
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
      </Section>

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
    </div>
  );
}
