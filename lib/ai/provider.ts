import OpenAI from "openai";

import { getSettings, listNotebookSegments } from "@/lib/db/queries";
import { localAnswer, localSummary } from "@/lib/ai/local";
import { hybridSearch } from "@/lib/search";
import type { Citation, ModelOption } from "@/lib/types";

type JsonAnswer = {
  answer: string;
  citations: Array<{ sourceId: string; locator: string; quotedText: string }>;
};

export async function listModels(): Promise<ModelOption[]> {
  const settings = getSettings();
  const fallback: ModelOption[] = [
    {
      key: "gemini-2.5-pro",
      label: "gemini-2.5-pro",
      provider: "default",
      kind: "chat",
    },
    {
      key: "heuristic-chat",
      label: "Heuristic Chat",
      provider: "heuristic",
      kind: "chat",
    },
    {
      key: "heuristic-embed",
      label: "Heuristic Embed",
      provider: "heuristic",
      kind: "embedding",
    },
  ];

  if (!settings.chatBaseUrl) {
    return fallback;
  }

  try {
    const response = await fetch(`${settings.chatBaseUrl.replace(/\/$/, "")}/models`, {
      headers: settings.chatApiKey
        ? {
            Authorization: `Bearer ${settings.chatApiKey}`,
          }
        : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as {
      data?: Array<{ id: string }>;
      models?: Array<{ name: string }>;
    };

    const remoteModels =
      payload.data?.map((item) => item.id) ??
      payload.models?.map((item) => item.name) ??
      [];

    return Array.from(
      new Map(
        [
          ...fallback,
          ...remoteModels.map((model) => ({
            key: model,
            label: model,
            provider: settings.chatProvider,
            kind: "chat" as const,
          })),
        ].map((model) => [model.key, model]),
      ).values(),
    );
  } catch {
    return fallback;
  }
}

export async function generateSummary(notebookId: string, modelKey?: string) {
  const snapshot = listNotebookSegments(notebookId);
  const notebookTitle = notebookId;
  const settings = getSettings();

  if (
    settings.chatProvider === "heuristic" ||
    !settings.chatBaseUrl ||
    !modelKey ||
    modelKey === "heuristic-chat"
  ) {
    return localSummary(notebookTitle, snapshot);
  }

  const prompt = `
你是知识整理助手。根据给出的资料片段生成结构化 Markdown 摘要。
要求：
1. 使用中文。
2. 结构固定包含：核心主题、关键观点、关键证据、待追问。
3. 不要捏造资料中不存在的信息。
4. 输出纯 Markdown。

资料：
${snapshot.map((segment) => `- [${segment.sourceTitle}] ${segment.content}`).join("\n")}
  `.trim();

  const client = new OpenAI({
    baseURL: settings.chatBaseUrl,
    apiKey: settings.chatApiKey || "ollama",
  });

  try {
    const response = await client.chat.completions.create({
      model: modelKey,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0]?.message?.content?.trim() || localSummary(notebookTitle, snapshot);
  } catch {
    return localSummary(notebookTitle, snapshot);
  }
}

async function fetchWebEvidence(query: string) {
  const settings = getSettings();

  if (!settings.tavilyApiKey) {
    return [];
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: settings.tavilyApiKey,
        query,
        max_results: 4,
        search_depth: "advanced",
      }),
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      results?: Array<{ title: string; content: string; url: string }>;
    };

    return payload.results ?? [];
  } catch {
    return [];
  }
}

export async function chatWithNotebook(params: {
  notebookId: string;
  message: string;
  useWebSearch: boolean;
  modelKey?: string;
}) {
  const results = await hybridSearch(params.notebookId, params.message, 8);
  const settings = getSettings();

  if (
    settings.chatProvider === "heuristic" ||
    !settings.chatBaseUrl ||
    !params.modelKey ||
    params.modelKey === "heuristic-chat"
  ) {
    const local = localAnswer(params.message, results);
    return {
      ...local,
      usedWebSearch: false,
      externalResults: [],
    };
  }

  const externalResults = params.useWebSearch ? await fetchWebEvidence(params.message) : [];
  const client = new OpenAI({
    baseURL: settings.chatBaseUrl,
    apiKey: settings.chatApiKey || "ollama",
  });

  const prompt = `
你是一个基于用户知识库回答问题的助手。
请严格输出 JSON，格式如下：
{
  "answer": "string",
  "citations": [
    { "sourceId": "string", "locator": "string", "quotedText": "string" }
  ]
}

回答规则：
1. 先基于本地资料回答。
2. 如有联网补充，只能在答案末尾单独说明“联网补充”。
3. citations 必须只引用本地资料，不要引用外部网页。
4. 输出必须是合法 JSON。

本地资料：
${results
  .map((item) => {
    const locator =
      item.sourceType === "pdf"
        ? `第 ${item.page ?? 1} 页`
        : item.sourceType === "youtube"
          ? `时间 ${item.timestampStart ?? 0}s`
          : `段落 ${item.order + 1}`;

    return `sourceId=${item.sourceId} | title=${item.sourceTitle} | locator=${locator} | content=${item.content}`;
  })
  .join("\n")}

联网补充：
${externalResults.map((item) => `title=${item.title} | url=${item.url} | content=${item.content}`).join("\n") || "无"}

用户问题：${params.message}
  `.trim();

  try {
    const response = await client.chat.completions.create({
      model: params.modelKey,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content?.trim() ?? "";
    const parsed = JSON.parse(content) as JsonAnswer;

    const citations: Citation[] = parsed.citations.map((citation) => {
      const matched = results.find((item) => item.sourceId === citation.sourceId);
      return {
        sourceId: citation.sourceId,
        sourceTitle: matched?.sourceTitle ?? "未知来源",
        kind: matched?.sourceType ?? "web",
        locator: citation.locator,
        quotedText: citation.quotedText,
      };
    });

    return {
      answer: parsed.answer,
      citations,
      usedWebSearch: externalResults.length > 0,
      externalResults,
    };
  } catch {
    const local = localAnswer(params.message, results);
    return {
      ...local,
      usedWebSearch: externalResults.length > 0,
      externalResults,
    };
  }
}
