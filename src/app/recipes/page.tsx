"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KindChips, RecipeCover } from "@/components/recipe-bits";
import { TaxonomyFilters } from "@/components/taxonomy-filters";
import { useKitchen } from "@/components/use-kitchen";
import { createRecipe, importDrafts, statusLabel } from "@/lib/kitchen/storage";
import { DISH_TYPES, classifyRecipe, type DishType } from "@/lib/kitchen/taxonomy";
import type { RecipeDraft } from "@/lib/video/types";

export default function RecipesPage() {
  const router = useRouter();
  const { data } = useKitchen();
  const [query, setQuery] = useState("");
  const [dishType, setDishType] = useState<"全部" | DishType>("全部");
  const [message, setMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const needle = query.trim().toLowerCase();
  const recipes = data.recipes.filter((recipe) => {
    const kind = classifyRecipe(recipe);
    if (dishType !== "全部" && kind.dishType !== dishType) return false;
    if (!needle) return true;
    const draft = recipe.draft;
    const haystack = [draft.title, draft.creator ?? "", kind.dishType, ...draft.ingredients.map((item) => item.name)].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
  const groups = DISH_TYPES.map((item) => ({
    dishType: item,
    recipes: recipes.filter((recipe) => classifyRecipe(recipe).dishType === item),
  })).filter((group) => group.recipes.length > 0);

  async function importLatest() {
    setImporting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/kitchen/import-latest");
      const body = (await response.json()) as { recipes?: RecipeDraft[]; message?: string };
      if (!response.ok) {
        setMessage(body.message || "没能读取已保存的识别结果。");
        return;
      }
      const added = importDrafts(body.recipes ?? []);
      setMessage(added ? `已放入 ${added} 道菜。` : "这些菜已经在菜谱库里。");
    } catch {
      setMessage("没能读取已保存的识别结果。");
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-clay">收集的菜谱</p>
          <h1 className="text-3xl font-semibold tracking-tight">菜谱库</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="min-h-12 rounded-full bg-clay px-4 text-sm text-white" onClick={() => router.push(`/recipes/${createRecipe().id}`)}>
            自己写一道菜
          </button>
          <Link href="/dev/video-import" className="min-h-12 rounded-full border border-line bg-card px-4 py-3 text-sm">
            从视频加入
          </Link>
        </div>
      </header>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜菜名、食材或分类"
        className="min-h-12 rounded-2xl border border-line bg-card px-3 shadow-soft"
      />

      <TaxonomyFilters dishType={dishType} onDishType={setDishType} />

      <button type="button" disabled={importing} onClick={() => void importLatest()} className="min-h-12 self-start rounded-full border border-line bg-card px-4 shadow-soft disabled:opacity-50">
        {importing ? "正在放入" : "导入最近一次视频识别结果"}
      </button>
      {message ? <p className="text-sm leading-6">{message}</p> : null}

      {recipes.length === 0 ? (
        <p className="rounded-3xl bg-card p-4 leading-7 shadow-soft">
          {data.recipes.length === 0 ? "菜谱库还是空的。可以自己写一道菜，或从视频识别后再改用量。" : "没有符合筛选的菜。"}
        </p>
      ) : null}

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.dishType}>
            <h2 className="text-lg font-semibold text-clay">{group.dishType}</h2>
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.recipes.map((recipe) => {
                const kind = classifyRecipe(recipe);
                return (
                  <li key={recipe.id}>
                    <Link href={`/recipes/${recipe.id}`} className="block overflow-hidden rounded-3xl bg-card shadow-soft">
                      <RecipeCover title={recipe.draft.title || "菜"} videoId={recipe.draft.video_id} />
                      <div className="flex flex-col gap-2 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-lg font-semibold leading-7">{recipe.draft.title || "未命名菜谱"}</h3>
                          {recipe.favorite ? <span className="shrink-0 rounded-full bg-blush px-2 py-1 text-xs text-clay">已收藏</span> : null}
                        </div>
                        <KindChips dishType={kind.dishType} />
                        <p className="text-sm text-ink/60">{[recipe.draft.creator, statusLabel(recipe.cookStatus)].filter(Boolean).join(" · ")}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
