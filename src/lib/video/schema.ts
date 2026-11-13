import { z } from "zod";
import { RecipeValidationError } from "./errors";
import type { IngredientSourceType, RecipeDraft, RecipeIngredient, YouTubeMetadata } from "./types";

const sourceTypeSchema = z.enum(["explicit", "estimated", "unknown"]);

const ingredientSchema = z.object({
  name: z.string().min(1),
  normalized_name: z.string().min(1),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  preparation_notes: z.string().nullable(),
  source_type: sourceTypeSchema,
  evidence_timestamp: z.string().nullable(),
});

const stepSchema = z.object({
  step_number: z.number().int().positive(),
  instruction: z.string().min(1),
  estimated_duration: z.string().nullable(),
  heat_level: z.string().nullable(),
  associated_ingredients: z.array(z.string()),
  video_timestamp: z.string().nullable(),
  evidence_notes: z.string().nullable(),
});

export const recipeDraftSchema = z.object({
  title: z.string(),
  language: z.string().min(1),
  source_url: z.string(),
  video_id: z.string().nullable(),
  creator: z.string().nullable(),
  description: z.string(),
  cooking_time: z.string().nullable(),
  preparation_time: z.string().nullable(),
  servings: z.number().positive().nullable(),
  categories: z.array(z.string()),
  ingredients: z.array(ingredientSchema),
  seasonings: z.array(ingredientSchema),
  cooking_steps: z.array(stepSchema),
  cooking_tips: z.array(z.string()),
  missing_information: z.array(z.string()),
  uncertain_information: z.array(z.string()),
});

const TIMESTAMP = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/;
const VAGUE = /^(适量|少许|若干|一点|一些|未知|不详|不明|不清楚|不确定|null|none|unknown|n\/a|na|—|-|–)$/i;
const CN: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new RecipeValidationError(["模型返回了空文本"]);
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1] ?? trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new RecipeValidationError(["模型返回里没有完整的 JSON 对象"]);
  }
  try {
    return JSON.parse(body.slice(start, end + 1)) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RecipeValidationError([`JSON 无法解析：${message}`]);
  }
}

export function parseQuantity(value: unknown): { quantity: number | null; note: string | null } {
  if (value == null) return { quantity: null, note: null };
  if (typeof value === "number") {
    return Number.isFinite(value) ? { quantity: value, note: null } : { quantity: null, note: "模型给了无法使用的数字" };
  }
  if (typeof value !== "string") return { quantity: null, note: "用量不是数字" };
  const text = value.trim();
  if (!text || VAGUE.test(text)) {
    return { quantity: null, note: text && !/^null$/i.test(text) ? `模型用量原文“${text}”不是精确数字` : null };
  }
  const numeric = text.replace(/,/g, "");
  if (/^[+-]?\d+(\.\d+)?$/.test(numeric)) return { quantity: Number(numeric), note: null };
  const chinese = parseChineseNumber(numeric);
  if (chinese != null) return { quantity: chinese, note: null };
  return { quantity: null, note: `模型用量原文“${text}”无法当成精确数字，已保留为未知` };
}

export function normalizeTimestamp(value: unknown): { timestamp: string | null; note: string | null } {
  if (value == null || value === "") return { timestamp: null, note: null };
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 6 * 60 * 60) {
    return { timestamp: formatSeconds(value), note: null };
  }
  if (typeof value !== "string") return { timestamp: null, note: "时间戳格式无效，已清空" };
  const text = value.trim();
  if (!text || /^(null|unknown|未知|不详|n\/a)$/i.test(text)) return { timestamp: null, note: null };
  const match = text.match(TIMESTAMP);
  if (match) {
    return match[3]
      ? { timestamp: `${Number(match[1])}:${match[2]}:${match[3]}`, note: null }
      : { timestamp: `${Number(match[1])}:${match[2]}`, note: null };
  }
  const spoken = text.match(/^(\d+)\s*分(?:钟)?\s*(\d+)\s*秒?$/);
  if (spoken) return { timestamp: `${Number(spoken[1])}:${spoken[2].padStart(2, "0")}`, note: null };
  const minutes = text.match(/^(\d+)\s*分(?:钟)?$/);
  if (minutes) return { timestamp: `${Number(minutes[1])}:00`, note: null };
  const seconds = text.match(/^(\d+)\s*秒$/);
  if (seconds) return { timestamp: formatSeconds(Number(seconds[1])), note: null };
  return { timestamp: null, note: `时间戳原文“${text}”无法确认，已清空` };
}

export function sanitizeRecipe(
  input: unknown,
  context: { sourceUrl: string; videoId: string | null },
): { recipe: RecipeDraft; warnings: string[] } {
  const record = unwrapRecipe(input);
  if (!record) throw new RecipeValidationError(["模型返回的不是 JSON 对象"]);

  const warnings: string[] = [];
  const uncertain: string[] = [];
  const missing = stringList(record.missing_information);
  const ingredients = readIngredients(record.ingredients, "主料", warnings, uncertain);
  const seasonings = readIngredients(record.seasonings, "调料", warnings, uncertain);
  const steps = readSteps(record.cooking_steps, warnings, uncertain);
  const servings = readServings(record.servings, uncertain);
  const title = asString(record.title) ?? "";
  const description = asString(record.description) ?? "";
  const language = asString(record.language) ?? detectLanguage(`${title} ${description}`);
  if (!asString(record.language)) warnings.push("模型没有给出 language，已按文本推断。");

  const modelUrl = asString(record.source_url);
  if (modelUrl && modelUrl !== context.sourceUrl) {
    warnings.push("模型改写了 source_url，已恢复为原始链接。");
  }

  const recipeCandidate = {
    title,
    language,
    source_url: context.sourceUrl,
    video_id: context.videoId,
    creator: asString(record.creator),
    description,
    cooking_time: readDuration(record.cooking_time, "烹饪时间", uncertain),
    preparation_time: readDuration(record.preparation_time, "准备时间", uncertain),
    servings,
    categories: stringList(record.categories).slice(0, 12),
    ingredients,
    seasonings,
    cooking_steps: steps,
    cooking_tips: stringList(record.cooking_tips).slice(0, 20),
    missing_information: uniqueStrings([...missing, ...(!title ? ["模型没有给出标题"] : [])]).slice(0, 40),
    uncertain_information: uniqueStrings([...stringList(record.uncertain_information), ...uncertain]).slice(0, 60),
  };

  const parsed = recipeDraftSchema.safeParse(recipeCandidate);
  if (!parsed.success) {
    throw new RecipeValidationError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }
  if (!parsed.data.title) warnings.push("标题为空。");
  if (parsed.data.ingredients.length === 0 && parsed.data.seasonings.length === 0) {
    warnings.push("没有提取到食材或调料。");
  }
  if (parsed.data.cooking_steps.length === 0) warnings.push("没有提取到烹饪步骤。");
  return { recipe: parsed.data, warnings };
}

export function buildMetadataOnlyRecipe(args: {
  sourceUrl: string;
  videoId: string;
  metadata: YouTubeMetadata;
}): { recipe: RecipeDraft; warnings: string[] } {
  const title = args.metadata.title ?? "";
  const recipe: RecipeDraft = {
    title,
    language: detectLanguage(title),
    source_url: args.sourceUrl,
    video_id: args.videoId,
    creator: args.metadata.author_name,
    description:
      "这是低置信度的公开元数据结果，不是视频理解。YouTube oEmbed 只提供标题、作者和缩略图，没有简介、配料或步骤。",
    cooking_time: null,
    preparation_time: null,
    servings: null,
    categories: [],
    ingredients: [],
    seasonings: [],
    cooking_steps: [],
    cooking_tips: [],
    missing_information: [
      "未分析视频画面和声音",
      "没有配料",
      "没有步骤",
      "没有用量",
      "oEmbed 不提供视频简介",
      ...(!title ? ["公开元数据里也没有标题"] : []),
    ],
    uncertain_information: ["标题和作者来自 YouTube oEmbed，没有经过视频核对"],
  };
  return {
    recipe,
    warnings: ["当前结果不是视频理解，不能当成菜谱使用。"],
  };
}

export function compareWithMetadata(recipe: RecipeDraft, metadata: YouTubeMetadata | null) {
  const metadataText = `${metadata?.title ?? ""}\n${metadata?.author_name ?? ""}`.toLowerCase();
  const beyond = [...recipe.ingredients, ...recipe.seasonings]
    .map((item) => item.name.trim())
    .filter((name) => name && !metadataText.includes(name.toLowerCase()));
  const title = recipe.title.trim();
  const creator = recipe.creator?.trim() || null;
  return {
    metadata_title: metadata?.title ?? null,
    metadata_author: metadata?.author_name ?? null,
    extracted_title: recipe.title,
    extracted_creator: recipe.creator,
    title_matches_metadata: title && metadata?.title ? includesEither(title, metadata.title) : null,
    creator_matches_metadata: creator && metadata?.author_name ? includesEither(creator, metadata.author_name) : null,
    ingredients_beyond_metadata_text: uniqueStrings(beyond),
    note: metadata?.title
      ? "对照文本只有 oEmbed 标题和作者。标题里没有出现的食材，不能由这份公开元数据解释。"
      : "没有取到 oEmbed 标题，无法做文本对照。",
  };
}

function unwrapRecipe(input: unknown): Record<string, unknown> | null {
  const record = asRecord(input);
  if (!record) return null;
  if (!("ingredients" in record) && record.recipe) {
    const nested = asRecord(record.recipe);
    if (nested) return nested;
  }
  return record;
}

function readIngredients(
  value: unknown,
  label: string,
  warnings: string[],
  uncertain: string[],
): RecipeIngredient[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    warnings.push(`${label}不是数组，已忽略。`);
    return [];
  }
  const items: RecipeIngredient[] = [];
  for (const entry of value.slice(0, 80)) {
    const record = asRecord(entry);
    if (!record) continue;
    const name = asString(record.name) ?? asString(record.ingredient) ?? "";
    if (!name) continue;
    const parsedQuantity = parseQuantity(record.quantity ?? record.amount);
    const timestamp = normalizeTimestamp(record.evidence_timestamp ?? record.timestamp);
    let unit = asString(record.unit);
    let quantity = parsedQuantity.quantity;
    let notes = asString(record.preparation_notes) ?? asString(record.notes);
    let sourceType = normalizeSourceType(record.source_type ?? record.sourceType);
    if (parsedQuantity.note) uncertain.push(`${name}: ${parsedQuantity.note}`);
    if (timestamp.note) uncertain.push(`${name}: ${timestamp.note}`);
    if (unit && VAGUE.test(unit)) {
      notes = joinNotes(notes, unit);
      unit = null;
      quantity = null;
      if (sourceType === "explicit") sourceType = "estimated";
      warnings.push(`${name}: 含糊用量没有换算成数字。`);
    }
    if (sourceType === "unknown" && (quantity != null || unit)) {
      uncertain.push(`${name}: 模型在未知用量上给出“${quantity ?? ""} ${unit ?? ""}”，已清空。`);
      quantity = null;
      unit = null;
    }
    if (sourceType === "explicit" && quantity == null && !unit) {
      sourceType = "unknown";
      warnings.push(`${name}: 标成明确用量但没有数字，已改为未知。`);
    }
    if (sourceType === "estimated" && quantity != null) {
      warnings.push(`${name}: 用量 ${quantity}${unit ?? ""} 被标为估算，请核对视频是否说过这个数字。`);
    }
    items.push({
      name,
      normalized_name: asString(record.normalized_name) ?? normalizeIngredientName(name),
      quantity,
      unit,
      preparation_notes: notes,
      source_type: sourceType,
      evidence_timestamp: timestamp.timestamp,
    });
  }
  return items;
}

function readSteps(value: unknown, warnings: string[], uncertain: string[]): RecipeDraft["cooking_steps"] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    warnings.push("步骤不是数组，已忽略。");
    return [];
  }
  const steps = [];
  for (const [index, entry] of value.slice(0, 40).entries()) {
    const record = asRecord(entry);
    if (!record) continue;
    const instruction = asString(record.instruction) ?? asString(record.text) ?? "";
    if (!instruction) continue;
    const timestamp = normalizeTimestamp(record.video_timestamp ?? record.timestamp);
    if (timestamp.note) uncertain.push(`步骤 ${index + 1}: ${timestamp.note}`);
    const stepNumber = positiveInt(record.step_number) ?? index + 1;
    steps.push({
      step_number: stepNumber,
      instruction,
      estimated_duration: asString(record.estimated_duration),
      heat_level: asString(record.heat_level),
      associated_ingredients: stringList(record.associated_ingredients).slice(0, 20),
      video_timestamp: timestamp.timestamp,
      evidence_notes: asString(record.evidence_notes),
    });
  }
  return steps.sort((a, b) => a.step_number - b.step_number);
}

function readServings(value: unknown, uncertain: string[]): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== "string") {
    uncertain.push("份量无法解析，已保留为未知。");
    return null;
  }
  const text = value.trim();
  if (!text || /未知|不详|unknown/i.test(text)) {
    if (text) uncertain.push(`份量原文“${text}”`);
    return null;
  }
  if (/^\d+(\.\d+)?\s*(人份|份|人|servings?)?$/i.test(text)) {
    return Number(text.match(/\d+(?:\.\d+)?/)?.[0]);
  }
  uncertain.push(`份量原文“${text}”不是明确数字，已保留为未知。`);
  return null;
}

function readDuration(value: unknown, label: string, uncertain: string[]): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    uncertain.push(`${label}只有数字 ${value}，没有单位，未自行换算成分钟。`);
    return null;
  }
  return asString(value);
}

function normalizeSourceType(value: unknown): IngredientSourceType {
  const text = asString(value)?.toLowerCase();
  if (!text) return "unknown";
  if (["explicit", "stated", "spoken", "明确", "视频明确"].includes(text)) return "explicit";
  if (["estimated", "estimate", "approx", "approximate", "估算", "大约"].includes(text)) return "estimated";
  return "unknown";
}

function parseChineseNumber(value: string): number | null {
  if (value === "十") return 10;
  if (value in CN) return CN[value];
  const teens = value.match(/^十([一二三四五六七八九])$/);
  if (teens) return 10 + CN[teens[1]];
  const tens = value.match(/^([一二三四五六七八九])十([一二三四五六七八九])?$/);
  if (tens) return CN[tens[1]] * 10 + (tens[2] ? CN[tens[2]] : 0);
  return null;
}

function formatSeconds(total: number): string {
  const seconds = Math.round(total);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "").replace(/[，,。．.、]/g, "");
}

function detectLanguage(text: string): string {
  if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
  if (/[A-Za-z]/.test(text)) return "en";
  return "unknown";
}

function includesEither(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  return a.includes(b) || b.includes(a);
}

function joinNotes(left: string | null, right: string | null): string | null {
  return [left, right].filter(Boolean).join("；") || null;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter((item): item is string => Boolean(item));
}

function positiveInt(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(number) && number > 0 ? number : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? text : null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
