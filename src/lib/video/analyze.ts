import { estimateCost } from "./cost";
import { RecipeValidationError, VideoUnderstandingError, classifyProviderError } from "./errors";
import { createGeminiProvider } from "./gemini-provider";
import { fetchYouTubeMetadata } from "./metadata";
import { buildMetadataOnlyRecipe, compareWithMetadata, extractJsonObject, sanitizeRecipe } from "./schema";
import type {
  AnalysisFailure,
  AnalysisResponse,
  ExtractionMode,
  ProviderAttempt,
  VideoUnderstandingProvider,
  YouTubeMetadata,
} from "./types";
import { parseYouTubeUrl } from "./youtube";

interface AnalyzeOptions {
  mode?: "video" | "metadata_only";
  provider?: VideoUnderstandingProvider;
  fetchMetadata?: (canonicalUrl: string) => Promise<YouTubeMetadata>;
}

export async function analyzeYouTubeUrl(rawUrl: string, options: AnalyzeOptions = {}): Promise<AnalysisResponse> {
  const parsed = parseYouTubeUrl(rawUrl);
  if (!parsed) {
    return failure({
      code: "invalid_url",
      message: "这不是可用的公开 YouTube 视频链接。",
      mode: options.mode ?? "video",
      live: false,
      durationMs: 0,
    });
  }

  const fetchMetadata = options.fetchMetadata ?? fetchYouTubeMetadata;
  if (options.mode === "metadata_only") {
    const started = Date.now();
    const metadata = await fetchMetadata(parsed.canonicalUrl);
    if (!metadata.title && (metadata.fetch_status == null || metadata.fetch_status >= 400)) {
      return failure({
        code: "inaccessible_video",
        message: metadata.note,
        mode: "metadata_only",
        live: false,
        durationMs: Date.now() - started,
        metadata,
        statusCode: metadata.fetch_status ?? undefined,
      });
    }
    const draft = buildMetadataOnlyRecipe({
      sourceUrl: parsed.canonicalUrl,
      videoId: parsed.videoId,
      metadata,
    });
    return {
      ok: true,
      live: false,
      provider: "youtube-oembed",
      mode: "metadata_only",
      model: null,
      interaction_id: null,
      status: "metadata_only",
      duration_ms: Date.now() - started,
      usage: null,
      estimated_cost: estimateCost(null, "metadata_only"),
      warnings: draft.warnings,
      attempts: [],
      metadata,
      metadata_comparison: compareWithMetadata(draft.recipe, metadata),
      recipe: draft.recipe,
      raw_text: null,
      repair_attempted: false,
    };
  }

  const provider = options.provider ?? createGeminiProvider();
  const started = Date.now();
  const metadataPromise = fetchMetadata(parsed.canonicalUrl);
  try {
    const raw = await provider.analyze({
      sourceUrl: parsed.canonicalUrl,
      videoId: parsed.videoId,
      video: { kind: "youtube", uri: parsed.canonicalUrl },
    });
    const metadata = await metadataPromise;
    const drafted = await draftFromModel({
      provider,
      rawText: raw.outputText,
      model: raw.model,
      sourceUrl: parsed.canonicalUrl,
      videoId: parsed.videoId,
      attempts: raw.attempts,
    });
    return {
      ok: true,
      live: true,
      provider: provider.id,
      mode: "video",
      model: drafted.model,
      interaction_id: raw.interactionId,
      status: raw.status,
      duration_ms: Date.now() - started,
      usage: raw.usage,
      estimated_cost: estimateCost(raw.usage, "video"),
      warnings: drafted.warnings,
      attempts: drafted.attempts,
      metadata,
      metadata_comparison: compareWithMetadata(drafted.recipe, metadata),
      recipe: drafted.recipe,
      raw_text: raw.outputText,
      repair_attempted: drafted.repairAttempted,
    };
  } catch (error) {
    const metadata = await metadataPromise.catch(() => null);
    const classified = classifyProviderError(error);
    return failure({
      code: classified.code,
      message: classified.message,
      mode: "video",
      live: classified.code !== "missing_credentials",
      durationMs: Date.now() - started,
      metadata,
      statusCode: classified.status,
      provider: provider.id,
      attempts: classified.attempts,
      rawText: classified.rawText,
      repairAttempted: classified.code === "parse",
    });
  }
}

export async function analyzeUploadedVideo(args: {
  path: string;
  mimeType: string;
  filename: string;
  sourceUrl?: string | null;
  provider?: VideoUnderstandingProvider;
}): Promise<AnalysisResponse> {
  const provider = args.provider ?? createGeminiProvider();
  const parsed = args.sourceUrl ? parseYouTubeUrl(args.sourceUrl) : null;
  if (args.sourceUrl?.trim() && !parsed) {
    return failure({
      code: "invalid_url",
      message: "填写了来源链接，但它不是有效的 YouTube 视频地址。",
      mode: "uploaded_file",
      live: false,
      durationMs: 0,
    });
  }
  const sourceUrl = parsed?.canonicalUrl ?? "";
  const started = Date.now();
  try {
    const raw = await provider.analyze({
      sourceUrl: sourceUrl || null,
      videoId: parsed?.videoId ?? null,
      video: { kind: "file", path: args.path, mimeType: args.mimeType, filename: args.filename },
    });
    const drafted = await draftFromModel({
      provider,
      rawText: raw.outputText,
      model: raw.model,
      sourceUrl,
      videoId: parsed?.videoId ?? null,
      attempts: raw.attempts,
    });
    if (!sourceUrl) {
      drafted.recipe.missing_information = unique(
        drafted.recipe.missing_information.concat("这次分析的是本地视频文件，没有 YouTube 来源链接。"),
      );
      drafted.warnings.push("没有原始来源链接。观看原视频需要你自己保留文件。");
    }
    return {
      ok: true,
      live: true,
      provider: provider.id,
      mode: "uploaded_file",
      model: drafted.model,
      interaction_id: raw.interactionId,
      status: raw.status,
      duration_ms: Date.now() - started,
      usage: raw.usage,
      estimated_cost: estimateCost(raw.usage, "uploaded_file"),
      warnings: drafted.warnings,
      attempts: drafted.attempts,
      metadata: null,
      metadata_comparison: null,
      recipe: drafted.recipe,
      raw_text: raw.outputText,
      repair_attempted: drafted.repairAttempted,
    };
  } catch (error) {
    const classified = classifyProviderError(error);
    return failure({
      code: classified.code,
      message: classified.message,
      mode: "uploaded_file",
      live: classified.code !== "missing_credentials",
      durationMs: Date.now() - started,
      provider: provider.id,
      statusCode: classified.status,
      attempts: classified.attempts,
      rawText: classified.rawText,
      repairAttempted: classified.code === "parse",
    });
  }
}

async function draftFromModel(args: {
  provider: VideoUnderstandingProvider;
  rawText: string;
  model: string;
  sourceUrl: string;
  videoId: string | null;
  attempts: ProviderAttempt[];
}): Promise<{
  recipe: import("./types").RecipeDraft;
  warnings: string[];
  repairAttempted: boolean;
  model: string;
  attempts: ProviderAttempt[];
}> {
  try {
    const sanitized = sanitizeRecipe(extractJsonObject(args.rawText), {
      sourceUrl: args.sourceUrl,
      videoId: args.videoId,
    });
    return { ...sanitized, repairAttempted: false, model: args.model, attempts: args.attempts };
  } catch (error) {
    if (!(error instanceof RecipeValidationError) || !args.provider.repairJson) {
      throw validationFailure(error, args.rawText, args.attempts);
    }
    let repaired;
    try {
      repaired = await args.provider.repairJson({
        model: args.model,
        invalidText: args.rawText,
        issues: error.issues,
      });
    } catch (repairError) {
      const classified = classifyProviderError(repairError);
      throw new VideoUnderstandingError("parse", `模型输出无法解析，JSON 修复请求也失败了：${classified.message}`, {
        attempts: args.attempts,
        rawText: args.rawText,
        cause: repairError,
      });
    }
    try {
      const sanitized = sanitizeRecipe(extractJsonObject(repaired.outputText), {
        sourceUrl: args.sourceUrl,
        videoId: args.videoId,
      });
      return {
        recipe: sanitized.recipe,
        warnings: sanitized.warnings.concat("模型输出未通过校验，已做一次不重新观看视频的 JSON 修复。请对照原始输出。"),
        repairAttempted: true,
        model: repaired.model || args.model,
        attempts: args.attempts.concat(repaired.attempts),
      };
    } catch (repairError) {
      throw validationFailure(repairError, `${args.rawText}\n\n--- repaired ---\n${repaired.outputText}`, args.attempts);
    }
  }
}

function validationFailure(error: unknown, rawText: string, attempts: ProviderAttempt[]): VideoUnderstandingError {
  if (error instanceof VideoUnderstandingError) {
    error.rawText = rawText;
    error.attempts = attempts;
    return error;
  }
  const issues = error instanceof RecipeValidationError ? error.issues.join("；") : "无法解析";
  return new VideoUnderstandingError("parse", `模型输出没有通过菜谱校验：${issues}`, {
    cause: error,
    attempts,
    rawText,
  });
}

function failure(args: {
  code: AnalysisFailure["error"]["code"];
  message: string;
  mode: ExtractionMode | null;
  live: boolean;
  durationMs: number;
  metadata?: YouTubeMetadata | null;
  statusCode?: number;
  provider?: string | null;
  attempts?: ProviderAttempt[];
  rawText?: string | null;
  model?: string | null;
  interactionId?: string | null;
  repairAttempted?: boolean;
}): AnalysisFailure {
  return {
    ok: false,
    live: args.live,
    provider: args.provider ?? null,
    mode: args.mode,
    model: args.model ?? null,
    interaction_id: args.interactionId ?? null,
    status: null,
    duration_ms: args.durationMs,
    usage: null,
    estimated_cost: null,
    attempts: args.attempts ?? [],
    metadata: args.metadata ?? null,
    error: {
      code: args.code,
      message: args.message,
      ...(args.statusCode ? { status: args.statusCode } : {}),
    },
    raw_text: args.rawText ?? null,
    repair_attempted: args.repairAttempted ?? false,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
