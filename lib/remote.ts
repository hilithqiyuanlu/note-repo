type AppErrorCode =
  | "timeout"
  | "unreachable"
  | "upstream_error"
  | "invalid_response"
  | "parsing_failed"
  | "missing_content";

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

export function buildHttpAgent(_url: string | URL, _scope: "remote" | "local" = "remote") {
  return undefined;
}

export async function fetchWithTimeout(input: string | URL, init?: FetchInitWithTimeout) {
  const controller = new AbortController();
  const timeoutMs = init?.timeoutMs ?? 10_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await (fetchImpl as any)(input, {
      ...init,
      signal: controller.signal,
      cache: init?.cache ?? "no-store",
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
