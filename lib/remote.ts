import http from "node:http";
import https from "node:https";

import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";

import { getSettings } from "@/lib/db/queries";

type AppErrorCode =
  | "timeout"
  | "unreachable"
  | "upstream_error"
  | "invalid_response"
  | "parsing_failed"
  | "missing_content";

type AgentLike = http.Agent | https.Agent;

type FetchInitWithTimeout = RequestInit & {
  timeoutMs?: number;
  proxyScope?: "remote" | "local";
};

const fetchImpl = require("node-fetch") as typeof fetch;

export class AppError extends Error {
  code: AppErrorCode;
  retryable: boolean;
  status?: number;

  constructor(params: {
    message: string;
    code: AppErrorCode;
    retryable?: boolean;
    status?: number;
    cause?: unknown;
  }) {
    super(params.message, params.cause ? { cause: params.cause } : undefined);
    this.name = "AppError";
    this.code = params.code;
    this.retryable = params.retryable ?? false;
    this.status = params.status;
  }
}

function asMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function asCauseMessage(error: unknown) {
  if (error instanceof Error && error.cause) {
    return asMessage(error.cause);
  }

  return "";
}

function isTimeoutLike(error: unknown) {
  const text = `${asMessage(error)} ${asCauseMessage(error)}`.toLowerCase();
  return text.includes("timeout") || text.includes("aborted");
}

function isNetworkLike(error: unknown) {
  const text = `${asMessage(error)} ${asCauseMessage(error)}`.toLowerCase();
  return (
    text.includes("fetch failed") ||
    text.includes("econnrefused") ||
    text.includes("enotfound") ||
    text.includes("network") ||
    text.includes("socket") ||
    text.includes("connect")
  );
}

function normalizeHostname(value: string) {
  return value.trim().toLowerCase();
}

function isBypassedHost(hostname: string, bypassHosts: string[]) {
  const normalized = normalizeHostname(hostname);
  return bypassHosts.some((host) => {
    const candidate = normalizeHostname(host);
    return candidate === normalized || (candidate.startsWith(".") && normalized.endsWith(candidate));
  });
}

function resolveProxyUrl() {
  const settings = getSettings();
  if (!settings.proxyEnabled || !settings.proxyHost || !settings.proxyPort) {
    return null;
  }

  return `${settings.proxyProtocol}://${settings.proxyHost}:${settings.proxyPort}`;
}

function shouldUseProxy(url: string | URL, scope: "remote" | "local" = "remote") {
  if (scope === "local") {
    return false;
  }

  const proxyUrl = resolveProxyUrl();
  if (!proxyUrl) {
    return false;
  }

  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    const settings = getSettings();
    const bypassHosts = (settings.proxyBypassHosts || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return !isBypassedHost(parsed.hostname, bypassHosts);
  } catch {
    return false;
  }
}

function buildAgent(url: string | URL, scope: "remote" | "local" = "remote"): AgentLike | undefined {
  if (!shouldUseProxy(url, scope)) {
    return undefined;
  }

  const proxyUrl = resolveProxyUrl();
  if (!proxyUrl) {
    return undefined;
  }

  const target = typeof url === "string" ? new URL(url) : url;
  return target.protocol === "http:"
    ? new HttpProxyAgent(proxyUrl)
    : new HttpsProxyAgent(proxyUrl);
}

export function buildHttpAgent(url: string | URL, scope: "remote" | "local" = "remote") {
  return buildAgent(url, scope);
}

export async function fetchWithTimeout(input: string | URL, init?: FetchInitWithTimeout) {
  const controller = new AbortController();
  const timeoutMs = init?.timeoutMs ?? 10_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const agent = buildAgent(input, init?.proxyScope ?? "remote");

  try {
    return await (fetchImpl as any)(input, {
      ...init,
      signal: controller.signal,
      cache: init?.cache ?? "no-store",
      ...(agent ? { agent } : {}),
    });
  } catch (error) {
    if (isTimeoutLike(error)) {
      throw new AppError({
        code: "timeout",
        message: "请求超时，请稍后重试",
        retryable: true,
        cause: error,
      });
    }

    if (isNetworkLike(error)) {
      throw new AppError({
        code: "unreachable",
        message: "目标服务当前不可达",
        retryable: true,
        cause: error,
      });
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function ensureRemoteOk(response: Response, contextMessage: string) {
  if (response.ok) {
    return response;
  }

  const retryable = response.status >= 500 || response.status === 429;
  throw new AppError({
    code: "upstream_error",
    message: `${contextMessage}（${response.status}）`,
    retryable,
    status: response.status,
  });
}

export function serializeAppError(error: unknown, fallbackMessage = "操作失败") {
  if (error instanceof AppError) {
    return {
      code: error.code,
      error: error.message,
      retryable: error.retryable,
    };
  }

  if (error instanceof Error) {
    return {
      code: "invalid_response",
      error: error.message || fallbackMessage,
      retryable: false,
    };
  }

  return {
    code: "invalid_response",
    error: fallbackMessage,
    retryable: false,
  };
}
