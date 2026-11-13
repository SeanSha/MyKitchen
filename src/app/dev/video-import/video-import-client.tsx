"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { saveAnalyzedRecipe, saveRecipe } from "@/lib/kitchen/storage";
import type { AnalysisResponse, CookingStep, RecipeDraft, RecipeIngredient } from "@/lib/video/types";
import { parseYouTubeUrl } from "@/lib/video/youtube";

const samples = [
  ["虾头烧豆腐", "https://www.youtube.com/watch?v=1BZyz-fw_YE"],
  ["蒜香白蘑菇炒牛肉片", "https://www.youtube.com/watch?v=FjfN732wQlU"],
];

export function VideoImportClient() {
  const [url, setUrl] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [libraryRecipeId, setLibraryRecipeId] = useState<string | null>(null);
  const [libraryCreated, setLibraryCreated] = useState(false);

  useEffect(() => {
    void fetch("/api/video/analyze")
      .then((response) => response.json())
      .then((body: { credentials_configured?: boolean; model?: string }) => {
        setConfigured(Boolean(body.credentials_configured));
        setModel(body.model ?? "");
      })
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function analyze(mode: "video" | "metadata_only") {
    setLoading(mode === "video" ? "正在分析视频" : "正在读取公开元数据");
    setElapsed(0);
    setTransportError(null);
    setResult(null);
    setDraft(null);
    setLibraryRecipeId(null);
    setLibraryCreated(false);
    try {
      const response = await fetch("/api/video/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, mode }),
      });
      const next = await readAnalysis(response);
      setResult(next);
      setDraft(next.ok ? next.recipe : null);
      if (next.ok && mode === "video") {
        const saved = saveAnalyzedRecipe(next.recipe);
        setLibraryRecipeId(saved.recipe.id);
        setLibraryCreated(saved.created);
      }
    } catch (error) {
      setTransportError(error instanceof Error ? error.message : "请求失败");
    } finally {
      setLoading(null);
    }
  }

  async function upload(file: File, sourceUrl: string) {
    setLoading("正在分析上传的视频");
    setElapsed(0);
    setTransportError(null);
    setResult(null);
    setDraft(null);
    setLibraryRecipeId(null);
    setLibraryCreated(false);
    const form = new FormData();
    form.set("file", file);
    if (sourceUrl.trim()) form.set("sourceUrl", sourceUrl.trim());
    try {
      const response = await fetch("/api/video/upload", { method: "POST", body: form });
      const next = await readAnalysis(response);
      setResult(next);
      setDraft(next.ok ? next.recipe : null);
    } catch (error) {
      setTransportError(error instanceof Error ? error.message : "上传失败");
    } finally {
      setLoading(null);
    }
  }

  const video = parseYouTubeUrl(url);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-clay">Phase 0 · 视频理解</p>
        <h1 className="text-3xl font-semibold">分析烹饪视频</h1>
        <p className="leading-7 text-ink/80">
          输入 YouTube 链接并分析成功后，这道菜会直接放进菜谱库。同一条链接不会重复保存。模型没说清的用量会保持未知。
        </p>
      </header>

      <section className="rounded-3xl border border-line bg-card p-4">
        <p className="text-sm">
          {configured == null
            ? "正在检查服务器配置…"
            : configured
              ? `服务器已配置密钥。当前模型：${model}`
              : "服务器还没有 GEMINI_API_KEY。视频理解会失败，页面不会改用假数据。"}
        </p>
      </section>

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void analyze("video");
        }}
      >
        <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="youtube-url">
          YouTube 链接
          <input
            id="youtube-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v="
            className="min-h-12 rounded-2xl border border-line bg-white px-3"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {samples.map(([label, sampleUrl]) => (
            <button
              key={sampleUrl}
              type="button"
              className="min-h-10 rounded-full border border-line bg-white px-3 text-sm"
              onClick={() => setUrl(sampleUrl)}
            >
              填入{label}
            </button>
          ))}
        </div>
        <button type="submit" disabled={Boolean(loading) || !url.trim()} className="min-h-12 rounded-full bg-clay px-5 text-white disabled:opacity-50">
          分析视频
        </button>
        <button
          type="button"
          disabled={Boolean(loading) || !url.trim()}
          className="min-h-12 rounded-full border border-line bg-white px-5 disabled:opacity-50"
          onClick={() => void analyze("metadata_only")}
        >
          只读取公开元数据
        </button>
      </form>

      <UploadForm disabled={Boolean(loading)} onUpload={upload} />

      {loading ? (
        <p className="rounded-2xl bg-white px-4 py-3" role="status">
          {loading}，已等待 {elapsed} 秒。公开视频通常需要一两分钟。
        </p>
      ) : null}
      {transportError ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-red-900">{transportError}</p> : null}
      {!loading && !result && !transportError ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-ink/70">还没有分析结果。</p>
      ) : null}

      {video ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">原视频</h2>
          <div className="aspect-video overflow-hidden rounded-2xl bg-black">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${video.videoId}`}
              title="YouTube 视频"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <a className="text-sm text-moss underline" href={video.canonicalUrl} target="_blank" rel="noreferrer">
            如果嵌入被阻止，打开原始链接
          </a>
        </section>
      ) : null}

      {result && !result.ok ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-950">
          <h2 className="text-lg font-semibold">分析失败</h2>
          <p className="mt-2">
            {result.error.code}：{result.error.message}
          </p>
          <p className="mt-2 text-sm">没有用示例菜谱代替这次结果。</p>
          {result.metadata ? <MetadataNote result={result} /> : null}
          {result.raw_text ? <RawText text={result.raw_text} /> : null}
        </section>
      ) : null}

      {result?.ok && draft ? (
        <RecipeEditor result={result} draft={draft} onChange={setDraft} libraryRecipeId={libraryRecipeId} libraryCreated={libraryCreated} />
      ) : null}
    </main>
  );
}

function UploadForm({ disabled, onUpload }: { disabled: boolean; onUpload: (file: File, sourceUrl: string) => void }) {
  const [sourceUrl, setSourceUrl] = useState("");
  return (
    <form
      className="flex flex-col gap-3 rounded-3xl border border-line bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem("video");
        const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
        if (file) onUpload(file, sourceUrl);
      }}
    >
      <h2 className="font-semibold">上传我有权处理的视频</h2>
      <p className="text-sm leading-6 text-ink/75">这是视频链接无法分析时的备用路径。文件会交给 Gemini，分析结束后删除远程副本。</p>
      <input name="video" type="file" accept="video/mp4,video/webm,video/quicktime,video/mpeg" className="text-sm" />
      <input
        value={sourceUrl}
        onChange={(event) => setSourceUrl(event.target.value)}
        placeholder="可选：原始 YouTube 链接"
        className="min-h-12 rounded-2xl border border-line bg-white px-3"
      />
      <button type="submit" disabled={disabled} className="min-h-12 rounded-full border border-line bg-white disabled:opacity-50">
        分析上传的视频
      </button>
    </form>
  );
}

function RecipeEditor({
  result,
  draft,
  onChange,
  libraryRecipeId,
  libraryCreated,
}: {
  result: Extract<AnalysisResponse, { ok: true }>;
  draft: RecipeDraft;
  onChange: (recipe: RecipeDraft) => void;
  libraryRecipeId: string | null;
  libraryCreated: boolean;
}) {
  const [savedHref, setSavedHref] = useState<string | null>(libraryRecipeId ? `/recipes/${libraryRecipeId}` : null);
  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-3xl bg-white p-4">
        <p className="text-sm text-moss">
          {libraryRecipeId
            ? libraryCreated
              ? "已放进菜谱库"
              : "这条视频已经在菜谱库里，没有再存一份"
            : result.mode === "video"
              ? "视频理解草稿"
              : result.mode === "uploaded_file"
                ? "上传视频的理解草稿"
                : "低置信度元数据，不是视频理解"}
        </p>
        <p className="mt-1 text-sm text-ink/70">
          模型 {result.model ?? "无"} · {(result.duration_ms / 1000).toFixed(1)} 秒 ·{" "}
          {result.estimated_cost?.estimated_total_usd == null ? "费用未知" : `估算 ${result.estimated_cost.estimated_total_usd} 美元`}
        </p>
      </div>
      {result.warnings.length ? (
        <ul className="rounded-3xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <MetadataNote result={result} />
      <label className="flex flex-col gap-2 text-sm font-medium">
        标题
        <input className="min-h-12 rounded-2xl border border-line bg-white px-3" value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        作者
        <input className="min-h-12 rounded-2xl border border-line bg-white px-3" value={draft.creator ?? ""} onChange={(event) => onChange({ ...draft, creator: event.target.value || null })} />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        简介
        <textarea className="min-h-24 rounded-2xl border border-line bg-white px-3 py-2" value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextStat label="准备时间" value={draft.preparation_time} onChange={(value) => onChange({ ...draft, preparation_time: value })} />
        <TextStat label="烹饪时间" value={draft.cooking_time} onChange={(value) => onChange({ ...draft, cooking_time: value })} />
        <label className="flex flex-col gap-2 text-sm font-medium">
          份量
          <input
            className="min-h-12 rounded-2xl border border-line bg-white px-3"
            value={draft.servings ?? ""}
            placeholder="未知"
            onChange={(event) => onChange({ ...draft, servings: event.target.value ? Number(event.target.value) : null })}
          />
        </label>
      </div>
      <IngredientList title="食材" items={draft.ingredients} onChange={(ingredients) => onChange({ ...draft, ingredients })} />
      <IngredientList title="调料" items={draft.seasonings} onChange={(seasonings) => onChange({ ...draft, seasonings })} />
      <StepList steps={draft.cooking_steps} onChange={(cooking_steps) => onChange({ ...draft, cooking_steps })} />
      <NoticeList title="未知或缺失" items={draft.missing_information} />
      <NoticeList title="需要核对" items={draft.uncertain_information} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-12 rounded-full bg-clay px-5 text-white"
          onClick={() => setSavedHref(`/recipes/${saveRecipe(draft, libraryRecipeId ?? undefined).id}`)}
        >
          {libraryRecipeId ? "把当前修改写回菜谱库" : "保存到菜谱库"}
        </button>
        <button
          type="button"
          className="min-h-12 rounded-full bg-moss px-5 text-white"
          onClick={() => void navigator.clipboard.writeText(JSON.stringify(draft, null, 2))}
        >
          复制当前草稿 JSON
        </button>
      </div>
      {savedHref ? (
        <Link href={savedHref} className="text-sm text-clay">
          {libraryCreated ? "打开这道菜" : "打开菜谱库里的这道菜"}
        </Link>
      ) : null}
      {result.raw_text ? <RawText text={result.raw_text} /> : null}
    </section>
  );
}

function IngredientList({ title, items, onChange }: { title: string; items: RecipeIngredient[]; onChange: (items: RecipeIngredient[]) => void }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length === 0 ? <p className="text-sm text-ink/60">没有{title}。</p> : null}
      {items.map((item, index) => (
        <div key={`${item.name}-${index}`} className="grid gap-2 rounded-2xl border border-line bg-white p-3">
          <input className="min-h-11 rounded-xl border border-line px-2" value={item.name} onChange={(event) => updateItem(items, index, { name: event.target.value }, onChange)} />
          <div className="grid grid-cols-2 gap-2">
            <input className="min-h-11 rounded-xl border border-line px-2" value={item.quantity ?? ""} placeholder="用量未知" onChange={(event) => updateItem(items, index, { quantity: event.target.value === "" ? null : Number(event.target.value) }, onChange)} />
            <input className="min-h-11 rounded-xl border border-line px-2" value={item.unit ?? ""} placeholder="单位" onChange={(event) => updateItem(items, index, { unit: event.target.value || null }, onChange)} />
          </div>
          <select className="min-h-11 rounded-xl border border-line px-2" value={item.source_type} onChange={(event) => updateItem(items, index, { source_type: event.target.value as RecipeIngredient["source_type"] }, onChange)}>
            <option value="explicit">视频明确</option>
            <option value="estimated">估算</option>
            <option value="unknown">未知</option>
          </select>
          <p className="text-xs text-ink/60">{item.evidence_timestamp ? `依据时间 ${item.evidence_timestamp}` : "没有时间戳"}</p>
        </div>
      ))}
    </section>
  );
}

function StepList({ steps, onChange }: { steps: CookingStep[]; onChange: (steps: CookingStep[]) => void }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">步骤</h2>
      {steps.length === 0 ? <p className="text-sm text-ink/60">没有步骤。</p> : null}
      {steps.map((step, index) => (
        <label key={step.step_number} className="flex flex-col gap-2 text-sm">
          <span>
            {step.step_number}. {step.video_timestamp ? `时间 ${step.video_timestamp}` : "没有时间戳"}
            {step.heat_level ? ` · ${step.heat_level}` : ""}
            {step.estimated_duration ? ` · ${step.estimated_duration}` : ""}
          </span>
          <textarea className="min-h-20 rounded-2xl border border-line bg-white px-3 py-2" value={step.instruction} onChange={(event) => onChange(steps.map((item, itemIndex) => itemIndex === index ? { ...item, instruction: event.target.value } : item))} />
          {step.evidence_notes ? <span className="text-ink/60">依据：{step.evidence_notes}</span> : null}
        </label>
      ))}
    </section>
  );
}

function MetadataNote({ result }: { result: AnalysisResponse }) {
  if (!result.metadata && !(result.ok && result.metadata_comparison)) return null;
  return (
    <div className="rounded-2xl border border-line bg-card p-4 text-sm leading-6">
      <p className="font-medium">公开元数据对照</p>
      <p>标题：{result.metadata?.title ?? "没有取到"}</p>
      <p>作者：{result.metadata?.author_name ?? "没有取到"}</p>
      <p>{result.metadata?.note}</p>
      {result.ok && result.metadata_comparison ? (
        <p>标题文本没有覆盖的名称：{result.metadata_comparison.ingredients_beyond_metadata_text.join("、") || "无"}</p>
      ) : null}
    </div>
  );
}

function NoticeList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-2 list-disc pl-5 text-sm leading-6">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function TextStat({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <input className="min-h-12 rounded-2xl border border-line bg-white px-3" value={value ?? ""} placeholder="未知" onChange={(event) => onChange(event.target.value || null)} />
    </label>
  );
}

function RawText({ text }: { text: string }) {
  return (
    <details className="rounded-2xl bg-white p-4 text-sm">
      <summary>原始模型输出</summary>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap">{text}</pre>
    </details>
  );
}

function updateItem(
  items: RecipeIngredient[],
  index: number,
  patch: Partial<RecipeIngredient>,
  onChange: (items: RecipeIngredient[]) => void,
) {
  onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
}

async function readAnalysis(response: Response): Promise<AnalysisResponse> {
  const text = await response.text();
  try {
    return JSON.parse(text) as AnalysisResponse;
  } catch {
    return {
      ok: false,
      live: false,
      provider: null,
      mode: null,
      model: null,
      interaction_id: null,
      status: null,
      duration_ms: 0,
      usage: null,
      estimated_cost: null,
      attempts: [],
      metadata: null,
      error: { code: "provider", message: text.slice(0, 500) || `HTTP ${response.status}` },
      raw_text: null,
      repair_attempted: false,
    };
  }
}
