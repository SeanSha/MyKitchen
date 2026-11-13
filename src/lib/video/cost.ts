import type { CostEstimate, ExtractionMode, NormalizedUsage } from "./types";

export const GEMINI_38_FLASH_INPUT_USD_PER_MILLION = 0.75;
export const GEMINI_38_FLASH_OUTPUT_USD_PER_MILLION = 3.75;

export function normalizeUsage(usage: unknown): NormalizedUsage | null {
  if (!usage || typeof usage !== "object") return null;
  const record = usage as Record<string, unknown>;
  const num = (key: string) => (typeof record[key] === "number" ? (record[key] as number) : null);
  return {
    input_tokens: num("total_input_tokens"),
    output_tokens: num("total_output_tokens"),
    thought_tokens: num("total_thought_tokens"),
    cached_tokens: num("total_cached_tokens"),
    total_tokens: num("total_tokens"),
    input_tokens_by_modality: Array.isArray(record.input_tokens_by_modality)
      ? record.input_tokens_by_modality
      : null,
    raw: record,
  };
}

export function estimateCost(usage: NormalizedUsage | null, mode: ExtractionMode): CostEstimate {
  const notes = [
    "gemini-3.8-flash 标准付费层在 2026-12-31 前为输入 $0.75 / 100 万 tokens、输出（含思考 tokens）$3.75 / 100 万 tokens，2027-01-01 起翻倍。免费层标价为 0。来源：https://ai.google.dev/gemini-api/docs/pricing",
    "官方文档写明 YouTube URL 视频理解仍是预览功能，目前不另收费，价格和限额以后可能变化。来源：https://ai.google.dev/gemini-api/docs/video-understanding",
    "响应里看不出这次请求走的是免费层还是付费层。金额按付费标准层估算；YouTube URL 预览的实际账单可能是 0。",
    "估算把 total_output_tokens 与 total_thought_tokens 相加后套用输出单价。如果接口以后把思考 tokens 计入 total_output_tokens，这个估算会偏高。",
  ];

  if (mode === "metadata_only") {
    return {
      currency: "USD",
      assumed_tier: "paid_standard_through_2026_12_31",
      input_usd_per_million: GEMINI_38_FLASH_INPUT_USD_PER_MILLION,
      output_usd_per_million: GEMINI_38_FLASH_OUTPUT_USD_PER_MILLION,
      estimated_input_usd: 0,
      estimated_output_usd: 0,
      estimated_total_usd: 0,
      notes: ["这次没有调用 Gemini，费用按 0 计。", ...notes],
    };
  }

  if (!usage || (usage.input_tokens == null && usage.output_tokens == null && usage.thought_tokens == null)) {
    return {
      currency: "USD",
      assumed_tier: "paid_standard_through_2026_12_31",
      input_usd_per_million: GEMINI_38_FLASH_INPUT_USD_PER_MILLION,
      output_usd_per_million: GEMINI_38_FLASH_OUTPUT_USD_PER_MILLION,
      estimated_input_usd: null,
      estimated_output_usd: null,
      estimated_total_usd: null,
      notes: ["接口没有返回 token 用量，无法估算费用。", ...notes],
    };
  }

  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = (usage.output_tokens ?? 0) + (usage.thought_tokens ?? 0);
  const estimatedInput = (inputTokens / 1_000_000) * GEMINI_38_FLASH_INPUT_USD_PER_MILLION;
  const estimatedOutput = (outputTokens / 1_000_000) * GEMINI_38_FLASH_OUTPUT_USD_PER_MILLION;
  return {
    currency: "USD",
    assumed_tier: "paid_standard_through_2026_12_31",
    input_usd_per_million: GEMINI_38_FLASH_INPUT_USD_PER_MILLION,
    output_usd_per_million: GEMINI_38_FLASH_OUTPUT_USD_PER_MILLION,
    estimated_input_usd: roundUsd(estimatedInput),
    estimated_output_usd: roundUsd(estimatedOutput),
    estimated_total_usd: roundUsd(estimatedInput + estimatedOutput),
    notes,
  };
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
