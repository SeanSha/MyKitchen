import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadLocalEnv } from "./load-env";
import { analyzeYouTubeUrl } from "../src/lib/video/analyze";
import { fetchYouTubeMetadata } from "../src/lib/video/metadata";
import { credentialsConfigured } from "../src/lib/video/config";
import { evaluateAnalysis } from "../src/lib/video/evaluate";
import { SYSTEM_INSTRUCTION, buildUserPrompt } from "../src/lib/video/prompt";
import { INACCESSIBLE_VIDEO_URL, INVALID_VIDEO_URL, VIDEO_RUBRICS } from "../src/lib/video/rubrics";
import type { AnalysisResponse } from "../src/lib/video/types";

loadLocalEnv();

const cases = [
  ...VIDEO_RUBRICS.map((rubric) => ({
    id: rubric.id,
    label: rubric.title,
    url: rubric.url,
    rubric,
  })),
  { id: "invalid-url", label: "无效链接", url: INVALID_VIDEO_URL, rubric: null },
  { id: "inaccessible-video", label: "无法访问的视频", url: INACCESSIBLE_VIDEO_URL, rubric: null },
];

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const directory = path.join(process.cwd(), "evals", "runs", stamp);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "prompt.txt"), `${SYSTEM_INSTRUCTION}\n\n${buildUserPrompt({ sourceUrl: "https://www.youtube.com/watch?v=VIDEO", videoId: "VIDEO" })}\n`, "utf8");

  if (!credentialsConfigured()) {
    const metadataCases = [
      ...VIDEO_RUBRICS.map((rubric) => ({ label: rubric.title, url: rubric.url })),
      { label: "无法访问的视频", url: INACCESSIBLE_VIDEO_URL },
    ];
    const metadata = [];
    for (const item of metadataCases) {
      metadata.push({ label: item.label, url: item.url, metadata: await fetchYouTubeMetadata(item.url) });
    }
    await writeFile(path.join(directory, "oembed.json"), JSON.stringify(metadata, null, 2), "utf8");
    const message = [
      "# Phase 0 视频理解测试",
      "",
      "两支视频都没有发送到 Gemini。",
      "",
      "原因：当前环境没有 GEMINI_API_KEY。脚本在调用模型前停止，没有写入假菜谱，也没有把元数据当成视频理解结果。",
      "",
      "下面只是 YouTube oEmbed 的公开标题和作者，供以后和模型结果对照。oEmbed 没有配料、步骤或用量。",
      "",
      ...metadata.map((item) => `- ${item.label}: HTTP ${item.metadata.fetch_status ?? "失败"}；标题「${item.metadata.title ?? "无"}」；作者「${item.metadata.author_name ?? "无"}」`),
      "",
      "把密钥写进 .env.local 后重新运行 npm run test:video。",
      "",
    ].join("\n");
    await writeFile(path.join(directory, "FAILURE.txt"), message, "utf8");
    await writeSummary(directory, message, []);
    console.error(message);
    process.exitCode = 2;
    return;
  }

  const records: Array<{ id: string; label: string; response: AnalysisResponse; extractionPass: boolean; behaviorPass: boolean }> = [];
  for (const item of cases) {
    console.log(`\n开始：${item.label}`);
    const response = await analyzeYouTubeUrl(item.url, { mode: "video" });
    const evaluation = evaluateAnalysis(response, item.rubric, item.label);
    await writeFile(path.join(directory, `${item.id}.json`), JSON.stringify(response, null, 2), "utf8");
    await writeFile(path.join(directory, `${item.id}.report.md`), evaluation.markdown, "utf8");
    records.push({
      id: item.id,
      label: item.label,
      response,
      extractionPass: evaluation.extractionPass,
      behaviorPass: evaluation.behaviorPass,
    });
    console.log(`${item.label}: ${response.ok ? response.status : response.error.code} / 提取${evaluation.extractionPass ? "通过" : "未通过"}`);
  }

  const videoRecords = records.filter((record) => record.id === "shrimp-tofu" || record.id === "beef-mushroom");
  const attempted = videoRecords.every((record) => record.response.live);
  const extracted = videoRecords.every((record) => record.extractionPass);
  const summary = [
    `# Phase 0 视频理解测试`,
    "",
    `时间：${stamp}`,
    `结果目录：evals/runs/${stamp}`,
    "",
    attempted ? "两支真实视频都发起了视频理解请求。" : "至少有一支视频没有发起真实请求。",
    extracted ? "两支视频都达到了当前自动提取门槛。" : "自动提取门槛没有全部通过。请阅读每份报告，不要把 HTTP 成功当成菜谱正确。",
    "",
    ...records.map((record) => {
      const status = record.response.ok ? record.response.status : record.response.error.code;
      return `- ${record.label}: ${status}，模型 ${record.response.model ?? "无"}，耗时 ${(record.response.duration_ms / 1000).toFixed(1)} 秒，提取${record.extractionPass ? "通过" : "未通过"}`;
    }),
    "",
  ].join("\n");
  await writeSummary(directory, summary, records);
  console.log(`\n报告已写入 ${directory}`);
  process.exitCode = extracted ? 0 : 1;
}

async function writeSummary(
  directory: string,
  summary: string,
  records: Array<{ response: AnalysisResponse }>,
) {
  await writeFile(path.join(directory, "SUMMARY.md"), summary, "utf8");
  await writeFile(path.join(process.cwd(), "evals", "PHASE0_EVALUATION.md"), summary, "utf8");
  if (records.length) {
    await writeFile(
      path.join(process.cwd(), "evals", "PHASE0_EVALUATION.md"),
      `${summary}\n费用说明以各 JSON 里的 estimated_cost.notes 为准。\n`,
      "utf8",
    );
  }
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
