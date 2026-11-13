import assert from "node:assert/strict";
import test from "node:test";
import { analyzeYouTubeUrl } from "../src/lib/video/analyze";
import { classifyProviderError } from "../src/lib/video/errors";
import { estimateCost } from "../src/lib/video/cost";
import { evaluateAnalysis } from "../src/lib/video/evaluate";
import { SYSTEM_INSTRUCTION, buildUserPrompt } from "../src/lib/video/prompt";
import { VIDEO_RUBRICS } from "../src/lib/video/rubrics";
import { buildMetadataOnlyRecipe, extractJsonObject, parseQuantity, sanitizeRecipe } from "../src/lib/video/schema";
import type { VideoUnderstandingProvider, YouTubeMetadata } from "../src/lib/video/types";
import { parseYouTubeUrl } from "../src/lib/video/youtube";

const shrimp = "https://www.youtube.com/watch?v=1BZyz-fw_YE";

test("does not treat a v1 video-input rejection as a missing model", () => {
  const error = new Error(
    "400 The value 'video' is not supported for 'input[1].type' in v1, it is available in v1beta. Supported values: 'model_output', 'user_input'.",
  );
  assert.equal(classifyProviderError(error).code, "provider");
});

test("parses public YouTube URLs and rejects everything else", () => {
  assert.equal(parseYouTubeUrl(shrimp)?.videoId, "1BZyz-fw_YE");
  assert.equal(parseYouTubeUrl("https://youtu.be/FjfN732wQlU")?.canonicalUrl, "https://www.youtube.com/watch?v=FjfN732wQlU");
  assert.equal(parseYouTubeUrl("https://m.youtube.com/shorts/1BZyz-fw_YE")?.videoId, "1BZyz-fw_YE");
  assert.equal(parseYouTubeUrl("https://example.com/watch?v=1BZyz-fw_YE"), null);
  assert.equal(parseYouTubeUrl("https://www.youtube.com/watch?v=short"), null);
  assert.equal(parseYouTubeUrl("not a url"), null);
});

test("does not turn vague amounts into numbers", () => {
  assert.deepEqual(parseQuantity("适量"), { quantity: null, note: "模型用量原文“适量”不是精确数字" });
  assert.deepEqual(parseQuantity("三"), { quantity: 3, note: null });
  const sanitized = sanitizeRecipe(
    {
      title: "测试菜",
      ingredients: [
        { name: "盐", quantity: 5, unit: "克", source_type: "unknown" },
        { name: "蒜", quantity: "三", unit: "瓣", source_type: "explicit" },
        { name: "油", quantity: null, unit: "少许", source_type: "explicit" },
      ],
      cooking_steps: [{ instruction: "热锅", video_timestamp: "片头" }],
    },
    { sourceUrl: shrimp, videoId: "1BZyz-fw_YE" },
  );
  const salt = sanitized.recipe.ingredients.find((item) => item.name === "盐");
  const garlic = sanitized.recipe.ingredients.find((item) => item.name === "蒜");
  const oil = sanitized.recipe.ingredients.find((item) => item.name === "油");
  assert.equal(salt?.quantity, null);
  assert.equal(salt?.unit, null);
  assert.equal(garlic?.quantity, 3);
  assert.equal(oil?.quantity, null);
  assert.equal(oil?.source_type, "estimated");
  assert.equal(sanitized.recipe.cooking_steps[0]?.video_timestamp, null);
  assert.equal(sanitized.recipe.source_url, shrimp);
});

test("metadata mode does not invent ingredients or call the video model", async () => {
  const metadata: YouTubeMetadata = {
    source: "youtube_oembed",
    title: "公开标题",
    author_name: "作者",
    author_url: null,
    thumbnail_url: null,
    provider_name: "YouTube",
    fetch_status: 200,
    note: "only metadata",
  };
  const provider: VideoUnderstandingProvider = {
    id: "should-not-run",
    analyze: async () => {
      throw new Error("metadata mode called the video model");
    },
  };
  const response = await analyzeYouTubeUrl(shrimp, {
    mode: "metadata_only",
    provider,
    fetchMetadata: async () => metadata,
  });
  assert.equal(response.ok, true);
  if (!response.ok) return;
  assert.equal(response.live, false);
  assert.equal(response.recipe.ingredients.length, 0);
  assert.equal(response.recipe.cooking_steps.length, 0);
  assert.match(response.recipe.description, /不是视频理解/);
});

test("invalid URL fails before a provider call", async () => {
  let called = false;
  const response = await analyzeYouTubeUrl("https://example.com/video", {
    provider: {
      id: "unused",
      analyze: async () => {
        called = true;
        throw new Error("nope");
      },
    },
  });
  assert.equal(called, false);
  assert.equal(response.ok, false);
  if (response.ok) return;
  assert.equal(response.error.code, "invalid_url");
});

test("prompt does not contain the answer key for either video", () => {
  const prompt = `${SYSTEM_INSTRUCTION}\n${buildUserPrompt({ sourceUrl: shrimp, videoId: "1BZyz-fw_YE" })}`;
  for (const word of ["鸭蛋黄", "欧芹", "老饭骨", "Chaye", "虾头", "白蘑菇", "黄油"]) {
    assert.equal(prompt.includes(word), false, word);
  }
});

test("metadata draft and cost estimate stay explicit", () => {
  const draft = buildMetadataOnlyRecipe({
    sourceUrl: shrimp,
    videoId: "1BZyz-fw_YE",
    metadata: {
      source: "youtube_oembed",
      title: "虾头烧豆腐",
      author_name: "老饭骨",
      author_url: null,
      thumbnail_url: null,
      provider_name: "YouTube",
      fetch_status: 200,
      note: "metadata",
    },
  });
  assert.equal(draft.recipe.ingredients.length, 0);
  const cost = estimateCost(
    { input_tokens: 1_000_000, output_tokens: 1_000_000, thought_tokens: 0, cached_tokens: null, total_tokens: null, input_tokens_by_modality: null, raw: null },
    "video",
  );
  assert.equal(cost.estimated_total_usd, 4.5);
  const json = extractJsonObject("```json\n{\"title\":\"示例\"}\n```");
  assert.equal((json as { title: string }).title, "示例");
});

test("evaluation does not treat a title repeat as video understanding", () => {
  const rubric = VIDEO_RUBRICS[0];
  const evaluation = evaluateAnalysis(
    {
      ok: true,
      live: true,
      provider: "fixture",
      mode: "video",
      model: "fixture-not-a-model",
      interaction_id: "fixture",
      status: "completed",
      duration_ms: 1,
      usage: null,
      estimated_cost: null,
      warnings: [],
      attempts: [],
      metadata: {
        source: "youtube_oembed",
        title: "虾头烧豆腐",
        author_name: "老饭骨",
        author_url: null,
        thumbnail_url: null,
        provider_name: "YouTube",
        fetch_status: 200,
        note: "metadata",
      },
      metadata_comparison: {
        metadata_title: "虾头烧豆腐",
        metadata_author: "老饭骨",
        extracted_title: "虾头烧豆腐",
        extracted_creator: null,
        title_matches_metadata: true,
        creator_matches_metadata: null,
        ingredients_beyond_metadata_text: [],
        note: "fixture",
      },
      recipe: {
        title: "虾头烧豆腐",
        language: "zh-CN",
        source_url: rubric.url,
        video_id: "1BZyz-fw_YE",
        creator: null,
        description: "",
        cooking_time: null,
        preparation_time: null,
        servings: null,
        categories: [],
        ingredients: [
          ingredient("虾头"),
          ingredient("豆腐"),
        ],
        seasonings: [],
        cooking_steps: [],
        cooking_tips: [],
        missing_information: [],
        uncertain_information: [],
      },
      raw_text: "{}",
      repair_attempted: false,
    },
    rubric,
    rubric.title,
  );
  assert.equal(evaluation.extractionPass, false);
  assert.equal(evaluation.checks.find((item) => item.id === "video_signal")?.status, "fail");
});

function ingredient(name: string) {
  return {
    name,
    normalized_name: name,
    quantity: null,
    unit: null,
    preparation_notes: null,
    source_type: "unknown" as const,
    evidence_timestamp: null,
  };
}
