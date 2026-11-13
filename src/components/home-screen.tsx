"use client";

import Link from "next/link";
import { RecipeCover } from "@/components/recipe-bits";
import { useKitchen } from "@/components/use-kitchen";
import { formatISODate, shortDate, weekdayLabel } from "@/lib/kitchen/dates";
import { currentWeek } from "@/lib/kitchen/storage";
import type { KitchenData } from "@/lib/kitchen/types";

export function HomeScreen({ initial }: { initial: KitchenData }) {
  const { data: kitchen } = useKitchen(initial);
  const today = formatISODate(new Date());
  const week = currentWeek(kitchen);
  const todayMeals = kitchen.meals.filter((meal) => meal.date === today);
  const upcoming = kitchen.meals
    .filter((meal) => meal.date >= week && meal.date > today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header>
        <p className="text-sm text-clay">今天 · {weekdayLabel(today)} {shortDate(today)}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">我的厨房</h1>
      </header>

      <section className="rounded-3xl bg-card p-4 shadow-soft">
        <h2 className="text-lg font-semibold">今天吃什么</h2>
        {todayMeals.length === 0 ? <p className="mt-3 leading-7 text-ink/75">今天还没安排。去计划页把菜拖进日历。</p> : null}
        <ul className="mt-3 flex flex-col gap-2">
          {todayMeals.map((meal) => {
            const recipe = kitchen.recipes.find((item) => item.id === meal.recipeId);
            return (
              <li key={meal.id}>
                <Link href={recipe ? `/recipes/${recipe.id}` : "/planner"} className="flex min-h-16 items-center gap-3 rounded-2xl bg-white px-3">
                  <RecipeCover title={recipe?.draft.title || "菜"} videoId={recipe?.draft.video_id ?? null} className="h-12 w-16 shrink-0 rounded-xl" mark="text-base" />
                  <span className="min-w-0 flex-1 truncate font-medium">{recipe?.draft.title || "菜谱已删除"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-3xl bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">这周接下来</h2>
          <Link href="/planner" className="text-sm text-clay">
            看计划
          </Link>
        </div>
        {upcoming.length === 0 ? <p className="mt-3 text-sm leading-6 text-ink/70">本周后面几天还是空的。</p> : null}
        <ul className="mt-3 flex flex-col gap-2">
          {upcoming.slice(0, 4).map((meal) => {
            const recipe = kitchen.recipes.find((item) => item.id === meal.recipeId);
            return (
              <li key={meal.id} className="flex min-h-12 items-center justify-between rounded-2xl bg-white px-4 text-sm">
                <span>
                  {weekdayLabel(meal.date)} · {recipe?.draft.title || "菜谱已删除"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link href="/recipes" className="rounded-3xl bg-clay px-4 py-5 text-white">
          <span className="block text-lg font-semibold">菜谱库</span>
          <span className="mt-1 block text-sm text-white/85">{kitchen.recipes.length} 道菜</span>
        </Link>
        <Link href="/shopping" className="rounded-3xl border border-line bg-card px-4 py-5 shadow-soft">
          <span className="block text-lg font-semibold">采购清单</span>
          <span className="mt-1 block text-sm text-ink/70">按天列出要买的材料</span>
        </Link>
      </section>
    </main>
  );
}
