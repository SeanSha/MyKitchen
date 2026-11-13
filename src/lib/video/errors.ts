import type { ProviderAttempt, VideoErrorCode } from "./types";

export function redactSecrets(value: string): string {
  return value.replace(/AIza[0-9A-Za-z_-]{10,}/g, "[REDACTED_API_KEY]");
}

export class VideoUnderstandingError extends Error {
  readonly code: VideoErrorCode;
  readonly status?: number;
  attempts: ProviderAttempt[];
  rawText: string | null;

  constructor(
    code: VideoErrorCode,
    message: string,
    options?: { status?: number; cause?: unknown; attempts?: ProviderAttempt[]; rawText?: string | null },
  ) {
    super(redactSecrets(message), options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "VideoUnderstandingError";
    this.code = code;
    this.status = options?.status;
    this.attempts = options?.attempts ?? [];
    this.rawText = options?.rawText ?? null;
  }
}

export class RecipeValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("\n") || "菜谱 JSON 没有通过校验");
    this.name = "RecipeValidationError";
    this.issues = issues;
  }
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

export function classifyProviderError(error: unknown): VideoUnderstandingError {
  if (error instanceof VideoUnderstandingError) return error;
  const message = redactSecrets(error instanceof Error ? error.message : String(error));
  const status = readStatus(error);
  const lower = message.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    /api key|permission denied|unauthenticated|invalid authentication|permission_denied/.test(lower)
  ) {
    return new VideoUnderstandingError("auth", `Gemini 认证失败：${message}`, { status, cause: error });
  }
  if (status === 429 || /quota|resource_exhausted|rate limit|too many requests/.test(lower)) {
    return new VideoUnderstandingError("quota", `Gemini 配额或速率限制：${message}`, { status, cause: error });
  }
  if (
    /timeout|deadline exceeded|timed out|aborted/.test(lower) ||
    (error instanceof Error && error.name === "TimeoutError")
  ) {
    return new VideoUnderstandingError("timeout", `请求超时：${message}`, { status, cause: error });
  }
  if (
    !/input\[/.test(lower) &&
    ((status === 404 && /\bmodel\b/.test(lower)) ||
      /unknown model|invalid model|model [`'][^`']+|models\/[a-z0-9]/.test(lower))
  ) {
    return new VideoUnderstandingError("model_unavailable", `模型不可用：${message}`, { status, cause: error });
  }
  if (
    /private video|unlisted|not public|video unavailable|video is unavailable|could not access|inaccessible|invalid youtube|only public videos|failed_precondition|copyright|blocked from/.test(
      lower,
    )
  ) {
    return new VideoUnderstandingError("inaccessible_video", `视频无法用于理解：${message}`, {
      status,
      cause: error,
    });
  }
  return new VideoUnderstandingError("provider", `Gemini 请求失败：${message}`, { status, cause: error });
}

export function httpStatusForCode(code: VideoErrorCode): number {
  switch (code) {
    case "invalid_url":
    case "parse":
    case "upload":
      return 400;
    case "missing_credentials":
    case "auth":
      return 401;
    case "inaccessible_video":
    case "model_unavailable":
      return 422;
    case "quota":
      return 429;
    case "timeout":
      return 504;
    default:
      return 502;
  }
}
