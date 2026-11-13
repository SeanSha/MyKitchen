import type { AnalysisResponse, RecipeDraft, RecipeIngredient } from "./types";
import type { RubricTerm, VideoRubric } from "./rubrics";

export interface Check {
  id: string;
  label: string;
  status: "pass" | "fail" | "partial" | "review";
  detail: string;
}

export interface Evaluation {
  checks: Check[];
  extractionPass: boolean;
  behaviorPass: boolean;
  reasons: string[];
  markdown: string;
}

export function evaluateAnalysis(response: AnalysisResponse, rubric: VideoRubric | null, label: string): Evaluation {
  if (!rubric) return evaluateControl(response, label);
  const checks = response.ok ? evaluateRecipe(response, rubric) : evaluateFailedCall(response, rubric);
  const reasons = checks.filter((check) => check.status === "fail").map((check) => `${check.label}：${check.detail}`);
  const extractionPass =
    response.ok &&
    response.live &&
    response.mode === "video" &&
    checks.filter((check) => ["dish", "source_url", "ingredients", "steps", "video_signal", "timestamps"].includes(check.id))
      .every((check) => check.status === "pass");
  return {
    checks,
    extractionPass,
    behaviorPass: response.live && response.mode === "video",
    reasons,
    markdown: renderMarkdown(label, response, rubric, checks, extractionPass),
  };
}

function evaluateControl(response: AnalysisResponse, label: string): Evaluation {
  const inaccessible = label.includes("无法访问");
  const checks: Check[] = inaccessible
    ? [
        response.ok
          ? check("no_recipe", "不返回编造菜谱", "fail", "无效或不可访问的视频仍返回了菜谱。")
          : check(
              "no_recipe",
              "不返回编造菜谱",
              "pass",
              `接口拒绝了这次请求：${response.error.code} ${response.error.message}`,
            ),
      ]
    : [
        check(
          "invalid_url",
          "本地拒绝无效链接",
          !response.ok && response.error.code === "invalid_url" && response.live === false ? "pass" : "fail",
          !response.ok ? response.error.message : "无效链接没有被拒绝。",
        ),
      ];
  const behaviorPass = checks.every((item) => item.status === "pass");
  return {
    checks,
    extractionPass: false,
    behaviorPass,
    reasons: checks.filter((item) => item.status === "fail").map((item) => item.detail),
    markdown: renderMarkdown(label, response, null, checks, false),
  };
}

function evaluateFailedCall(response: AnalysisFailure, rubric: VideoRubric): Check[] {
  return [
    check("api_attempt", "真实调用", response.live ? "pass" : "fail", response.live ? "已经向视频理解接口发起请求。" : "没有发起视频理解请求。"),
    check("dish", "菜名", "fail", `调用失败：${response.error.code} ${response.error.message}`),
    check("source_url", "来源链接", "fail", "没有菜谱结果，无法核对来源链接。"),
    check("ingredients", "食材完整性", "fail", "没有菜谱结果。"),
    check("steps", "步骤", "fail", "没有菜谱结果。"),
    check("video_signal", "视频理解证据", "fail", "没有可检查的提取结果。"),
    check("timestamps", "时间戳", "fail", "没有可检查的时间戳。"),
    check(
      "metadata",
      "元数据对照",
      response.metadata?.title ? "review" : "partial",
      response.metadata?.title
        ? `oEmbed 标题是“${response.metadata.title}”，作者是“${response.metadata.author_name ?? "未知"}”。这只是文本元数据。`
        : response.metadata?.note ?? "没有取到 oEmbed。",
    ),
    check("context", "评分背景", "review", rubric.notes),
  ];
}

function evaluateRecipe(response: AnalysisSuccess, rubric: VideoRubric): Check[] {
  const recipe = response.recipe;
  const items = [...recipe.ingredients, ...recipe.seasonings];
  const corpus = evidenceCorpus(recipe);
  const ingredientHits = rubric.ingredients.filter((term) => matchesTerm(items, corpus, term));
  const techniqueHits = rubric.techniques.filter((term) => term.aliases.some((alias) => corpus.includes(alias)));
  const beyond = response.metadata_comparison?.ingredients_beyond_metadata_text ?? [];
  const timestamps = collectTimestamps(recipe);
  const outOfRange = timestamps.filter((value) => timestampToSeconds(value) > rubric.durationSeconds + 20);
  const explicitQuantities = items.filter((item) => item.source_type === "explicit" && item.quantity != null);
  const unknownWithQuantity = items.filter((item) => item.source_type === "unknown" && (item.quantity != null || item.unit));

  const checks: Check[] = [
    check(
      "api_attempt",
      "真实调用",
      response.live && response.interaction_id ? "pass" : "fail",
      response.interaction_id ? `interaction ${response.interaction_id}` : "成功响应里没有 interaction id。",
    ),
    check(
      "dish",
      "菜名",
      includesAny(recipe.title, [rubric.title]) ? "pass" : "fail",
      `模型标题：${recipe.title || "（空）"}`,
    ),
    check(
      "source_url",
      "来源链接",
      recipe.source_url === rubric.url ? "pass" : "fail",
      recipe.source_url || "（空）",
    ),
    check(
      "creator",
      "作者",
      includesAny(recipe.creator ?? "", rubric.creatorHints)
        ? "pass"
        : includesAny(response.metadata?.author_name ?? "", rubric.creatorHints)
          ? "partial"
          : "fail",
      `模型作者：${recipe.creator ?? "空"}；oEmbed 作者：${response.metadata?.author_name ?? "空"}`,
    ),
    ingredientCheck(rubric, ingredientHits),
    check(
      "techniques",
      "烹饪技法",
      techniqueHits.length === rubric.techniques.length ? "pass" : techniqueHits.length > 0 ? "partial" : "fail",
      `命中 ${list(techniqueHits)}。未命中 ${list(rubric.techniques.filter((term) => !techniqueHits.includes(term)))}。`,
    ),
    check(
      "steps",
      "步骤",
      recipe.cooking_steps.length >= 3 ? "pass" : recipe.cooking_steps.length > 0 ? "partial" : "fail",
      `${recipe.cooking_steps.length} 步。`,
    ),
    check(
      "video_signal",
      "视频理解证据",
      videoSignal(response, beyond, timestamps, recipe) ? "pass" : "fail",
      beyond.length
        ? `有 ${beyond.length} 项食材没有出现在 oEmbed 标题或作者里：${beyond.join("、")}`
        : "提取出的食材都能在已获得的标题文本里找到，或缺少步骤依据。",
    ),
    check(
      "timestamps",
      "时间戳",
      outOfRange.length > 0 ? "fail" : timestamps.length >= 2 ? "pass" : timestamps.length === 1 ? "partial" : "review",
      timestamps.length
        ? `得到 ${timestamps.join("、")}。${outOfRange.length ? `超出约 ${rubric.durationLabel} 的有 ${outOfRange.join("、")}。` : "没有明显超出视频时长。"}`
        : "模型没有给出可用时间戳。",
    ),
    check(
      "uncertainty",
      "不确定性",
      unknownWithQuantity.length > 0 ? "fail" : "pass",
      unknownWithQuantity.length
        ? `未知用量仍带有数字：${unknownWithQuantity.map((item) => item.name).join("、")}`
        : `未知 ${items.filter((item) => item.source_type === "unknown").length} 项，估算 ${items.filter((item) => item.source_type === "estimated").length} 项，明确 ${explicitQuantities.length} 项。缺失说明 ${recipe.missing_information.length} 条，不确定说明 ${recipe.uncertain_information.length} 条。`,
    ),
  ];

  if (rubric.quantityRiskExplicitCount != null && explicitQuantities.length >= rubric.quantityRiskExplicitCount) {
    checks.push(
      check(
        "quantities",
        "用量准确性",
        "review",
        `有 ${explicitQuantities.length} 个明确数字。评分标准没有这些精确用量，需要人工对照视频，确认不是模型补出来的。`,
      ),
    );
  } else {
    checks.push(check("quantities", "用量准确性", "review", quantityDetail(recipe, rubric)));
  }

  for (const timing of rubric.timings) {
    checks.push(
      check(
        timing.id,
        timing.label,
        timing.pattern.test(corpus) ? "pass" : "fail",
        timing.pattern.test(corpus) ? "步骤或时间字段里找到了对应说法。" : "没有找到对应的时间说法。",
      ),
    );
  }

  for (const quantity of rubric.exactQuantities) {
    const matches = items.filter((item) => quantity.aliases.some((alias) => item.name.includes(alias)));
    const exact = matches.find((item) => item.quantity === quantity.quantity);
    checks.push(
      check(
        quantity.id,
        quantity.label,
        exact ? "pass" : matches.length ? "partial" : "fail",
        exact
          ? `${exact.name} ${exact.quantity ?? ""}${exact.unit ?? ""}（${exact.source_type}）`
          : matches.length
            ? matches.map((item) => `${item.name} ${item.quantity ?? "未知"}${item.unit ?? ""} / ${item.source_type}`).join("；")
            : "没有找到对应食材。",
      ),
    );
  }

  for (const term of rubric.mentionedQuantities) {
    const found = matchesTerm(items, corpus, term);
    checks.push(check(term.id, term.label, found ? "pass" : "fail", found ? "视频相关内容里提到了这项。" : "没有提到。"));
  }

  for (const order of rubric.order) {
    const before = firstIndex(recipe, order.before);
    const after = firstIndex(recipe, order.after);
    checks.push(
      check(
        order.id,
        order.label,
        before >= 0 && after >= 0 ? (before <= after ? "pass" : "fail") : "review",
        before < 0 || after < 0 ? "两类动作没有都出现，无法判断顺序。" : `前一动作在步骤 ${before + 1}，后一动作在步骤 ${after + 1}。`,
      ),
    );
  }

  const unexpected = items
    .map((item) => item.name)
    .filter((name) => !rubric.ingredients.concat(rubric.techniques, rubric.mentionedQuantities).some((term) => term.aliases.some((alias) => name.includes(alias))));
  checks.push(
    check(
      "hallucination_review",
      "可能的额外食材",
      unexpected.length ? "review" : "pass",
      unexpected.length
        ? `这些名称不在人工评分清单里，不能自动判成幻觉：${unexpected.join("、")}`
        : "提取出的食材名称都能对应到评分清单。",
    ),
  );
  checks.push(check("context", "评分背景", "review", rubric.notes));
  return checks;
}

function ingredientCheck(rubric: VideoRubric, hits: RubricTerm[]): Check {
  const missed = rubric.ingredients.filter((term) => !hits.includes(term));
  const status = hits.length >= 3 && hits.length / rubric.ingredients.length >= 0.5 ? "pass" : hits.length >= 2 ? "partial" : "fail";
  return check("ingredients", "食材完整性", status, `命中 ${list(hits)}。未命中 ${list(missed)}。`);
}

function videoSignal(
  response: AnalysisSuccess,
  beyond: string[],
  timestamps: string[],
  recipe: RecipeDraft,
): boolean {
  const evidenceNotes = recipe.cooking_steps.filter((step) => step.evidence_notes).length;
  if (response.metadata?.title) return beyond.length >= 2 || timestamps.length >= 2 || evidenceNotes >= 2;
  return (timestamps.length >= 1 || evidenceNotes >= 1) && recipe.ingredients.length >= 2;
}

function quantityDetail(recipe: RecipeDraft, rubric: VideoRubric): string {
  const items = [...recipe.ingredients, ...recipe.seasonings];
  const explicit = items.filter((item) => item.source_type === "explicit" && item.quantity != null);
  return `明确数字 ${explicit.length} 个${explicit.length ? `：${explicit.map((item) => `${item.name} ${item.quantity}${item.unit ?? ""}`).join("、")}` : ""}。${rubric.notes}`;
}

function renderMarkdown(
  label: string,
  response: AnalysisResponse,
  rubric: VideoRubric | null,
  checks: Check[],
  extractionPass: boolean,
): string {
  const lines = [
    `# ${label}`,
    "",
    extractionPass ? "提取质量门槛：通过。结果仍然是草稿，需要人工核对。" : "提取质量门槛：未通过。",
    "",
    "## 调用",
    "",
    `- 模型：${response.model ?? "无"}`,
    `- 状态：${response.ok ? response.status : response.error.code}`,
    `- 耗时：${(response.duration_ms / 1000).toFixed(1)} 秒`,
    `- 是否真实视频请求：${response.live ? "是" : "否"}`,
    `- 模式：${response.mode ?? "无"}`,
    `- interaction：${response.interaction_id ?? "无"}`,
    `- 输入 tokens：${response.usage?.input_tokens ?? "未返回"}`,
    `- 输出 tokens：${response.usage?.output_tokens ?? "未返回"}`,
    `- 思考 tokens：${response.usage?.thought_tokens ?? "未返回"}`,
    `- 估算费用：${response.estimated_cost?.estimated_total_usd ?? "无法估算"} USD`,
    "",
    ...(response.ok ? [] : ["## 错误", "", `- ${response.error.code}: ${response.error.message}`, ""]),
    "## 元数据对照",
    "",
    response.metadata
      ? `- oEmbed 标题：${response.metadata.title ?? "无"}`
      : "- 没有 oEmbed 结果。",
    response.metadata ? `- oEmbed 作者：${response.metadata.author_name ?? "无"}` : "",
    response.metadata ? `- 说明：${response.metadata.note}` : "",
    response.ok && response.metadata_comparison
      ? `- 标题未覆盖的食材：${response.ok ? response.metadata_comparison.ingredients_beyond_metadata_text.join("、") || "无" : "无"}`
      : "",
    "",
    "## 检查",
    "",
    ...checks.map((item) => `- ${statusLabel(item.status)} ${item.label}：${item.detail}`),
    "",
    rubric ? `## 评分说明\n\n${rubric.notes}\n` : "",
    "## 改进",
    "",
    ...improvements(checks, response),
    "",
  ];
  return lines.filter((line) => line !== "").join("\n");
}

function improvements(checks: Check[], response: AnalysisResponse): string[] {
  const notes = new Set<string>();
  if (!response.ok) notes.add("先看错误码。认证、配额、模型不存在和视频不可访问要分开处理，不能改成示例菜谱。");
  if (checks.some((item) => item.id === "timestamps" && item.status !== "pass")) {
    notes.add("时间戳偏少或不可用时，保留空值。不要为了界面完整而补秒数。");
  }
  if (checks.some((item) => item.id === "quantities" && item.status === "review")) {
    notes.add("精确用量先给人核对。估算值必须继续带估算标记。");
  }
  if (checks.some((item) => item.id === "video_signal" && item.status === "fail")) {
    notes.add("如果结果只是标题复述，应降为低置信度，并允许改走元数据模式或上传用户有权处理的视频。");
  }
  notes.add("YouTube URL 仍是预览能力。提供者保持在 GeminiVideoProvider 后面，方便以后更换。");
  return [...notes].map((note) => `- ${note}`);
}

function evidenceCorpus(recipe: RecipeDraft): string {
  return [
    recipe.description,
    recipe.cooking_time,
    recipe.preparation_time,
    ...recipe.cooking_steps.flatMap((step) => [step.instruction, step.estimated_duration, step.heat_level, step.evidence_notes]),
    ...recipe.ingredients.flatMap(itemText),
    ...recipe.seasonings.flatMap(itemText),
    ...recipe.cooking_tips,
  ]
    .filter(Boolean)
    .join("\n");
}

function itemText(item: RecipeIngredient): Array<string | null> {
  return [item.name, item.preparation_notes, item.unit, item.evidence_timestamp];
}

function matchesTerm(items: RecipeIngredient[], corpus: string, term: RubricTerm): boolean {
  return items.some((item) => term.aliases.some((alias) => item.name.includes(alias) || item.normalized_name.includes(alias)))
    || term.aliases.some((alias) => corpus.includes(alias));
}

function firstIndex(recipe: RecipeDraft, aliases: string[]): number {
  return recipe.cooking_steps.findIndex((step) =>
    aliases.some((alias) => step.instruction.includes(alias) || (step.evidence_notes ?? "").includes(alias)),
  );
}

function collectTimestamps(recipe: RecipeDraft): string[] {
  return [
    ...recipe.cooking_steps.map((step) => step.video_timestamp),
    ...recipe.ingredients.map((item) => item.evidence_timestamp),
    ...recipe.seasonings.map((item) => item.evidence_timestamp),
  ].filter((value): value is string => Boolean(value));
}

function timestampToSeconds(value: string): number {
  const match = value.match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) return Number.POSITIVE_INFINITY;
  if (match[3]) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return Number(match[1]) * 60 + Number(match[2]);
}

function includesAny(text: string, aliases: string[]): boolean {
  const value = text.toLowerCase();
  return aliases.some((alias) => value.includes(alias.toLowerCase()));
}

function list(terms: RubricTerm[]): string {
  return terms.length ? terms.map((term) => term.label).join("、") : "无";
}

function statusLabel(status: Check["status"]): string {
  if (status === "pass") return "通过";
  if (status === "fail") return "失败";
  if (status === "partial") return "部分";
  return "待核对";
}

function check(id: string, label: string, status: Check["status"], detail: string): Check {
  return { id, label, status, detail };
}

type AnalysisFailure = Extract<AnalysisResponse, { ok: false }>;
type AnalysisSuccess = Extract<AnalysisResponse, { ok: true }>;
