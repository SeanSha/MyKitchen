import { GoogleGenAI } from "@google/genai";
import { fallbackModel, configuredModel, credentialsConfigured } from "./config";
import { classifyProviderError, VideoUnderstandingError } from "./errors";
import { normalizeUsage } from "./cost";
import { REPAIR_INSTRUCTION, SYSTEM_INSTRUCTION, buildRepairPrompt, buildUserPrompt } from "./prompt";
import type { ProviderAnalyzeRequest, ProviderAttempt, ProviderRawResult, VideoUnderstandingProvider } from "./types";

const REQUEST_TIMEOUT_MS = 240_000;
const VIDEO_API_VERSION = "v1beta";

export class GeminiVideoProvider implements VideoUnderstandingProvider {
  readonly id = "gemini-interactions";

  async analyze(request: ProviderAnalyzeRequest): Promise<ProviderRawResult> {
    const ai = createClient();
    const primary = configuredModel();
    const prepared = await this.buildInput(ai, request);
    const attempts: ProviderAttempt[] = [];
    try {
      try {
        const result = await this.generate(ai, primary, prepared.input, SYSTEM_INSTRUCTION, attempts);
        return { ...result, attempts };
      } catch (error) {
        const classified = classifyProviderError(error);
        attempts.push({ model: primary, ok: false, error: classified.message });
        if (classified.code !== "model_unavailable" || fallbackModel() === primary) {
          classified.attempts = attempts;
          throw classified;
        }
        try {
          const result = await this.generate(ai, fallbackModel(), prepared.input, SYSTEM_INSTRUCTION, attempts);
          return { ...result, attempts };
        } catch (fallbackError) {
          const fallbackClassified = classifyProviderError(fallbackError);
          attempts.push({ model: fallbackModel(), ok: false, error: fallbackClassified.message });
          fallbackClassified.attempts = attempts;
          throw fallbackClassified;
        }
      }
    } finally {
      await prepared.cleanup();
    }
  }

  async repairJson(request: { model: string; invalidText: string; issues: string[] }): Promise<ProviderRawResult> {
    const ai = createClient();
    const attempts: ProviderAttempt[] = [];
    return this.generate(
      ai,
      request.model,
      [{ type: "text", text: buildRepairPrompt(request.invalidText, request.issues) }],
      REPAIR_INSTRUCTION,
      attempts,
    ).then((result) => ({ ...result, attempts }));
  }

  private async buildInput(ai: GoogleGenAI, request: ProviderAnalyzeRequest): Promise<{
    input: Array<Record<string, unknown>>;
    cleanup: () => Promise<void>;
  }> {
    const text = {
      type: "text" as const,
      text: buildUserPrompt({ sourceUrl: request.sourceUrl, videoId: request.videoId }),
    };
    if (request.video.kind === "youtube") {
      return {
        input: [text, { type: "video" as const, uri: request.video.uri, processing: "static" as const }],
        cleanup: async () => undefined,
      };
    }

    const uploaded = await ai.files.upload({
      file: request.video.path,
      config: { mimeType: request.video.mimeType, displayName: request.video.filename },
    });
    let file = uploaded;
    const started = Date.now();
    while (file.state && file.state !== "ACTIVE") {
      if (file.state === "FAILED") {
        if (file.name) await ai.files.delete({ name: file.name }).catch(() => undefined);
        throw new VideoUnderstandingError("upload", file.error?.message || "上传的视频处理失败。");
      }
      if (Date.now() - started > 120_000) {
        if (file.name) await ai.files.delete({ name: file.name }).catch(() => undefined);
        throw new VideoUnderstandingError("timeout", "上传的视频在两分钟内没有处理完成。");
      }
      await sleep(2_000);
      if (!file.name) break;
      file = await ai.files.get({ name: file.name });
    }
    if (!file.uri) {
      if (file.name) await ai.files.delete({ name: file.name }).catch(() => undefined);
      throw new VideoUnderstandingError("upload", "文件上传后没有返回可用地址。");
    }
    const fileName = file.name;
    return {
      input: [
        text,
        {
          type: "video" as const,
          uri: file.uri,
          mime_type: request.video.mimeType,
          processing: "static" as const,
        },
      ],
      cleanup: async () => {
        if (fileName) await ai.files.delete({ name: fileName }).catch(() => undefined);
      },
    };
  }

  private async generate(
    ai: GoogleGenAI,
    model: string,
    input: Array<Record<string, unknown>>,
    systemInstruction: string,
    attempts: ProviderAttempt[],
  ): Promise<ProviderRawResult> {
    try {
      return await this.request(ai, model, input, systemInstruction, true, attempts);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (!/response_format|response format|mime/.test(message)) throw error;
      attempts.push({ model, ok: false, error: "JSON 响应格式被拒绝，改为只要求文本 JSON。" });
      return this.request(ai, model, input, systemInstruction, false, attempts);
    }
  }

  private async request(
    ai: GoogleGenAI,
    model: string,
    input: Array<Record<string, unknown>>,
    systemInstruction: string,
    jsonResponse: boolean,
    attempts: ProviderAttempt[],
  ): Promise<ProviderRawResult> {
    const interaction = await ai.interactions.create({
      api_version: VIDEO_API_VERSION,
      model,
      store: false,
      system_instruction: systemInstruction,
      generation_config: {
        temperature: 0.2,
        max_output_tokens: 16384,
      },
      ...(jsonResponse ? { response_format: { type: "text" as const, mime_type: "application/json" as const } } : {}),
      input: input as never,
    });
    const outputText = interaction.output_text?.slice(0, 100_000) ?? "";
    const status = interaction.status ?? "unknown";
    if (status === "failed" || status === "cancelled" || !outputText.trim()) {
      const detail = interaction.errors ? JSON.stringify(interaction.errors).slice(0, 1_000) : status;
      throw new VideoUnderstandingError("provider", `模型没有返回可用文本。状态：${detail}`);
    }
    const result: ProviderRawResult = {
      model: interaction.model || model,
      status,
      outputText,
      interactionId: interaction.id ?? null,
      usage: normalizeUsage(interaction.usage),
      attempts,
    };
    attempts.push({ model: result.model, ok: true, status });
    return result;
  }
}

export function createGeminiProvider(): GeminiVideoProvider {
  return new GeminiVideoProvider();
}

function createClient(): GoogleGenAI {
  if (!credentialsConfigured()) {
    throw new VideoUnderstandingError(
      "missing_credentials",
      "服务器没有配置 GEMINI_API_KEY。把它写在 .env.local，然后重启开发服务器。",
    );
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    apiVersion: VIDEO_API_VERSION,
    httpOptions: { apiVersion: VIDEO_API_VERSION, timeout: REQUEST_TIMEOUT_MS },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
