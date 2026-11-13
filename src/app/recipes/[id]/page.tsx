"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { KindChips } from "@/components/recipe-bits";
import { RecipeFields } from "@/components/recipe-fields";
import { useKitchen } from "@/components/use-kitchen";
import { formatISODate } from "@/lib/kitchen/dates";
import { addMeal, alreadyOnDay, removeRecipe, saveRecipe, statusLabel, updateRecipe } from "@/lib/kitchen/storage";
import { DISH_TYPES, classifyRecipe, type DishType } from "@/lib/kitchen/taxonomy";
import type { CookStatus } from "@/lib/kitchen/types";
import type { RecipeDraft } from "@/lib/video/types";

export default function RecipeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data } = useKitchen();
  const recipe = data.recipes.find((item) => item.id === params.id);
  const [added, setAdded] = useState<string | null>(null);

  if (!recipe) {
    if (data.recipes.length === 0) return <main className="mx-auto max-w-3xl px-4 py-8" />;
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <p>这道菜不在菜谱库里。</p>
        <Link href="/recipes" className="text-clay">
          返回菜谱库
        </Link>
      </main>
    );
  }

  const draft = recipe.draft;
  const kind = classifyRecipe(recipe);
  const recipeId = recipe.id;
  const today = formatISODate(new Date());
  function saveDraft(next: RecipeDraft) {
    saveRecipe(next, recipeId);
  }
  function planToday() {
    if (alreadyOnDay(data.meals, today, recipeId)) {
      setAdded("今天已经有这道菜");
      return;
    }
    addMeal({ date: today, slot: "dinner", recipeId, servings: 1 });
    setAdded("已加到今天，还可以再加别的菜");
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <Link href="/recipes" className="text-sm text-clay">
        返回菜谱库
      </Link>
      <header>
        <input
          aria-label="菜名"
          value={draft.title}
          placeholder="菜名"
          className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none"
          onChange={(event) => saveDraft({ ...draft, title: event.target.value })}
        />
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {DISH_TYPES.map((item) => (
              <button key={item} type="button" className={`min-h-11 rounded-full px-4 text-sm ${kind.dishType === item ? "bg-clay text-white" : "bg-card"}`} onClick={() => updateRecipe(recipe.id, { dishType: item as DishType, dishTypeManual: true })}>
                {item}
              </button>
            ))}
          </div>
          <KindChips dishType={kind.dishType} />
        </div>
        <p className="mt-2 text-sm leading-6 text-ink/70">{[draft.creator, "用量和步骤改完就会保存"].filter(Boolean).join(" · ")}</p>
      </header>

      {draft.video_id ? (
        <div className="overflow-hidden rounded-3xl bg-black">
          <iframe
            className="aspect-video w-full"
            src={`https://www.youtube.com/embed/${draft.video_id}`}
            title={draft.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}
      {draft.source_url ? (
        <a href={draft.source_url} target="_blank" rel="noreferrer" className="text-sm text-clay">
          打开原始视频
        </a>
      ) : null}
      {draft.description ? <p className="leading-7">{draft.description}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-12 rounded-full bg-clay px-4 text-white" onClick={planToday}>
          加到今天
        </button>
        <button
          type="button"
          className="min-h-12 rounded-full border border-line bg-white px-4"
          onClick={() => updateRecipe(recipe.id, { favorite: !recipe.favorite })}
        >
          {recipe.favorite ? "取消收藏" : "收藏"}
        </button>
      </div>
      {added ? <p className="text-sm text-moss">{added}</p> : null}

      <RecipeFields draft={draft} onChange={saveDraft} />

      {draft.missing_information.length ? <Notice title="视频里没说清" items={draft.missing_information} /> : null}
      {draft.uncertain_information.length ? <Notice title="需要核对" items={draft.uncertain_information} /> : null}

      <section className="flex flex-col gap-3 rounded-3xl bg-card p-4">
        <h2 className="text-lg font-semibold">我的记录</h2>
        <label className="flex flex-col gap-2 text-sm">
          做过没有
          <select
            className="min-h-12 rounded-2xl border border-line bg-white px-3"
            value={recipe.cookStatus}
            onChange={(event) => updateRecipe(recipe.id, { cookStatus: event.target.value as CookStatus })}
          >
            <option value="untested">{statusLabel("untested")}</option>
            <option value="success">{statusLabel("success")}</option>
            <option value="needs_improvement">{statusLabel("needs_improvement")}</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              type="button"
              className={`min-h-12 min-w-12 rounded-full border px-3 ${recipe.rating === score ? "border-clay bg-clay text-white" : "border-line bg-white"}`}
              onClick={() => updateRecipe(recipe.id, { rating: recipe.rating === score ? null : score })}
            >
              {score}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-2 text-sm">
          笔记
          <textarea
            className="min-h-28 rounded-2xl border border-line bg-white px-3 py-2"
            value={recipe.notes}
            onChange={(event) => updateRecipe(recipe.id, { notes: event.target.value })}
            placeholder="下次少放盐、换成家里有的材料……"
          />
        </label>
      </section>

      <button
        type="button"
        className="min-h-12 self-start rounded-full border border-line px-4 text-sm text-clay"
        onClick={() => {
          if (window.confirm(`从菜谱库移除「${draft.title || "未命名菜谱"}」？本周安排里的这道菜也会去掉。`)) {
            removeRecipe(recipe.id);
            router.push("/recipes");
          }
        }}
      >
        从菜谱库移除
      </button>
    </main>
  );
}

function Notice({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-3xl bg-amber-50 p-4">
      <h2 className="font-semibold text-amber-950">{title}</h2>
      <ul className="mt-2 flex flex-col gap-1 text-sm leading-6 text-amber-950">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
