import OpenAI from "openai";

import { localAnswer, localSummary } from "@/lib/ai/local";
import { getNotebookSnapshot, getSettings, listNotebookSegments } from "@/lib/db/queries";
import { AppError, buildHttpAgent, ensureRemoteOk, fetchWithTimeout } from "@/lib/remote";
import { hybridSearch } from "@/lib/search";
import { formatTimestamp } from "@/lib/utils";
import type { AppSettingsRecord, Citation, ModelCatalog, ModelOption } from "@/lib/types";

type JsonAnswer = {
  answer: string;
  citations: Array<{
    sourceId: string;
    segmentId?: string;
    locator: string;
    quotedText: string;
  }>;
};

type ResolvedChatTarget =
  | {
      source: "heuristic";
      model: string;
    }
  | {
      source: "local" | "remote";
      model: string;
      baseURL: string;
      apiKey: string;
      provider: string;
    };

const REMOTE_MODELS_CACHE_TTL = 60_000;

let remoteModelsCache:
  | {
      cacheKey: string;
      fetchedAt: number;
      models: string[];
    }
  | null = null;

const heuristicModels: ModelOption[] = [
  {
    key: "heuristic-chat",
    label: "Heuristic Chat",
    provider: "heuristic",
    source: "heuristic",
    kind: "chat",
  },
  {
    key: "heuristic-embed",
    label: "Heuristic Embed",
    provider: "heuristic",
    source: "heuristic",
    kind: "embedding",
  },
];

function mergeModels(models: ModelOption[], currentModel: string | null, settings: AppSettingsRecord) {
  const merged = [...models];

  if (currentModel && !merged.some((model) => model.key === currentModel)) {
    merged.unshift({
      key: currentModel,
      label: `${currentModel} (当前)`,
      provider: settings.chatProvider || "default",
      source: "remote",
      kind: "chat",
    });
  }

  return Array.from(new Map(merged.map((model) => [model.key, model])).values());
}

function sanitizeJsonContent(content: string) {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeCitations(
  citations: JsonAnswer["citations"],
  results: Awaited<ReturnType<typeof hybridSearch>>,
) {
  return citations.map<Citation>((citation) => {
    const matched =
      results.find((item) => item.id === citation.segmentId) ??
      results.find((item) => item.sourceId === citation.sourceId);

    return {
      sourceId: citation.sourceId,
      segmentId: matched?.id ?? citation.segmentId ?? null,
      sourceTitle: matched?.sourceTitle ?? "未知来源",
      kind: matched?.sourceType ?? "web",
      locator: citation.locator,
      quotedText: citation.quotedText,
      segmentOrder: matched?.order ?? null,
      page: matched?.page ?? null,
      timestampStart: matched?.timestampStart ?? null,
      timestampEnd: matched?.timestampEnd ?? null,
    };
  });
}

function getLocalChatOption(settings: AppSettingsRecord): ModelOption[] {
  if (!settings.localChatEnabled || !settings.localChatModel) {
    return [];
  }

  return [
    {
      key: settings.localChatModel,
      label: settings.localChatLabel || settings.localChatModel,
      provider: "ollama",
      source: "local",
      kind: "chat",
    },
  ];
}

function getRemoteChatOption(settings: AppSettingsRecord): ModelOption[] {
  if (!settings.chatModel) {
    return [];
  }

  return [
    {
      key: settings.chatModel,
      label: settings.chatModel,
      provider: settings.chatProvider || "default",
      source: "remote",
      kind: "chat",
    },
  ];
}

export function buildInitialModelCatalog(settings = getSettings()): ModelCatalog {
  return {
    models: mergeModels(
      [...getRemoteChatOption(settings), ...getLocalChatOption(settings), ...heuristicModels],
      settings.chatModel,
      settings,
    ),
    degraded: false,
    reason: null,
  };
}

async function fetchRemoteModelIds(settings: AppSettingsRecord) {
  if (!settings.chatBaseUrl) {
    return [];
  }

  const cacheKey = [
    settings.chatProvider,
    settings.chatBaseUrl,
    settings.chatModel,
    settings.localChatModel,
  ].join("|");

  if (
    remoteModelsCache &&
    remoteModelsCache.cacheKey === cacheKey &&
    Date.now() - remoteModelsCache.fetchedAt < REMOTE_MODELS_CACHE_TTL
  ) {
    return remoteModelsCache.models;
  }

  const response = ensureRemoteOk(
    await fetchWithTimeout(`${settings.chatBaseUrl.replace(/\/$/, "")}/models`, {
      headers: settings.chatApiKey
        ? {
            Authorization: `Bearer ${settings.chatApiKey}`,
          }
        : undefined,
      proxyScope: "remote",
    }),
    "模型列表获取失败",
  );

  const payload = (await response.json()) as {
    data?: Array<{ id: string }>;
    models?: Array<{ name: string }>;
  };

  const modelIds =
    payload.data?.map((item) => item.id) ??
    payload.models?.map((item) => item.name) ??
    [];

  remoteModelsCache = {
    cacheKey,
    fetchedAt: Date.now(),
    models: modelIds,
  };

  return modelIds;
}

export async function listModelCatalog(options?: { includeRemote?: boolean }): Promise<ModelCatalog> {
  const settings = getSettings();
  const baseModels = buildInitialModelCatalog(settings).models;
  const includeRemote = options?.includeRemote ?? true;

  if (!includeRemote) {
    return {
      models: baseModels,
      degraded: false,
      reason: null,
    };
  }

  if (!settings.chatBaseUrl) {
    return {
      models: baseModels,
      degraded: true,
      reason: "未配置远端模型服务，已使用最小模型列表",
    };
  }

  try {
    const remoteModelIds = await fetchRemoteModelIds(settings);

    return {
      models: mergeModels(
        [
          ...baseModels,
          ...remoteModelIds.map((model) => ({
            key: model,
            label: model,
            provider: settings.chatProvider,
            source: "remote" as const,
            kind: "chat" as const,
          })),
        ],
        settings.chatModel || null,
        settings,
      ),
      degraded: false,
      reason: null,
    };
  } catch (error) {
    const reason =
      error instanceof AppError
        ? `${error.message}，已回退到最小模型列表`
        : "远端模型列表当前不可用，已回退到最小模型列表";

    return {
      models: baseModels,
      degraded: true,
      reason,
    };
  }
}

export async function listModels(): Promise<ModelOption[]> {
  return (await listModelCatalog()).models;
}

function resolveChatTarget(modelKey: string | undefined, settings: AppSettingsRecord): ResolvedChatTarget {
  const resolvedModel = modelKey || settings.chatModel;

  if (!resolvedModel || resolvedModel === "heuristic-chat") {
    return { source: "heuristic", model: "heuristic-chat" };
  }

  if (settings.localChatEnabled && settings.localChatModel && resolvedModel === settings.localChatModel) {
    return {
      source: "local",
      model: resolvedModel,
      baseURL: settings.localChatBaseUrl || "http://127.0.0.1:11434/v1",
      apiKey: "ollama",
      provider: "ollama",
    };
  }

  if (settings.chatProvider === "heuristic" || !settings.chatBaseUrl) {
    return { source: "heuristic", model: "heuristic-chat" };
  }

  return {
    source: "remote",
    model: resolvedModel,
    baseURL: settings.chatBaseUrl,
    apiKey: settings.chatApiKey || "ollama",
    provider: settings.chatProvider,
  };
}

function createChatClient(target: Extract<ResolvedChatTarget, { source: "local" | "remote" }>) {
  return new OpenAI({
    baseURL: target.baseURL,
    apiKey: target.apiKey,
    httpAgent: buildHttpAgent(target.baseURL, target.source === "remote" ? "remote" : "local"),
  });
}

export async function generateSummary(
  notebookId: string,
  modelKey?: string,
  sourceIds?: string[],
) {
  const segments = listNotebookSegments(notebookId, sourceIds);
  const notebook = getNotebookSnapshot(notebookId);
  const notebookTitle = notebook?.notebook.title ?? "豆脑";
  const settings = getSettings();
  const target = resolveChatTarget(modelKey, settings);

  if (target.source === "heuristic") {
    return localSummary(notebookTitle, segments);
  }

  const prompt = `
你是知识整理助手。请根据给出的资料片段生成结构化 Markdown 摘要。
要求：
1. 使用中文。
2. 结构固定包含：核心主题、关键观点、关键证据、待追问。
3. 优先归纳，不要逐段照抄。
4. 不要捏造资料中不存在的信息。
5. 输出纯 Markdown。

资料：
${segments.map((segment) => `- [${segment.sourceTitle}] ${segment.content}`).join("\n")}
  `.trim();

  const client = createChatClient(target);

  try {
    const response = await client.chat.completions.create({
      model: target.model,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0]?.message?.content?.trim() || localSummary(notebookTitle, segments);
  } catch {
    return localSummary(notebookTitle, segments);
  }
}

async function fetchWebEvidence(query: string) {
  const settings = getSettings();

  if (!settings.tavilyApiKey) {
    return [];
  }

  try {
    const response = ensureRemoteOk(
      await fetchWithTimeout("https://api.tavily.com/search", {
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
        proxyScope: "remote",
      }),
      "联网搜索失败",
    );

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
  sourceIds?: string[];
}) {
  const results = await hybridSearch(params.notebookId, params.message, 8, params.sourceIds);
  const settings = getSettings();
  const target = resolveChatTarget(params.modelKey, settings);

  if (target.source === "heuristic") {
    const local = localAnswer(params.message, results);
    return {
      ...local,
      usedWebSearch: false,
      externalResults: [],
    };
  }

  const externalResults = params.useWebSearch ? await fetchWebEvidence(params.message) : [];
  const client = createChatClient(target);

  const prompt = `
你是一个基于用户知识库回答问题的助手。
请严格输出 JSON，格式如下：
{
  "answer": "string",
  "citations": [
    { "sourceId": "string", "segmentId": "string", "locator": "string", "quotedText": "string" }
  ]
}

回答规则：
1. 先直接回答用户问题，再补一句“依据”。
2. 若证据不足，明确说明不确定点，不要空话，不要模板化前缀。
3. citations 必须只引用本地资料，不要引用外部网页。
4. 如有联网补充，只能在 answer 末尾单独补一句“联网补充：...”
5. 输出必须是合法 JSON。

本地资料：
${results
  .map((item) => {
    const locator =
      item.sourceType === "pdf"
        ? `第 ${item.page ?? 1} 页`
        : item.sourceType === "youtube"
          ? formatTimestamp(item.timestampStart)
          : `段落 ${item.order + 1}`;

    return `sourceId=${item.sourceId} | segmentId=${item.id} | title=${item.sourceTitle} | locator=${locator} | content=${item.content}`;
  })
  .join("\n")}

联网补充：
${externalResults.map((item) => `title=${item.title} | url=${item.url} | content=${item.content}`).join("\n") || "无"}

用户问题：${params.message}
  `.trim();

  try {
    const response = await client.chat.completions.create({
      model: target.model,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const content = sanitizeJsonContent(response.choices[0]?.message?.content?.trim() ?? "");
    const parsed = JSON.parse(content) as JsonAnswer;

    return {
      answer: parsed.answer,
      citations: normalizeCitations(parsed.citations ?? [], results),
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
