"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { KindChips, RecipeCover } from "@/components/recipe-bits";
import { TaxonomyFilters } from "@/components/taxonomy-filters";
import { useKitchen } from "@/components/use-kitchen";
import { addDays, formatISODate, inSameMonth, monthGrid, monthStart, monthTitle, shiftMonth, shortDate, weekdayLabel, weekDates } from "@/lib/kitchen/dates";
import { addMeal, currentWeek, removeMeal, setWeekStart, updateMeal } from "@/lib/kitchen/storage";
import { DISH_TYPES, classifyRecipe, type DishType } from "@/lib/kitchen/taxonomy";
import type { KitchenData, MealEntry, SavedRecipe } from "@/lib/kitchen/types";

type ViewMode = "week" | "month";

export function PlannerScreen({ initial }: { initial: KitchenData }) {
  const { data } = useKitchen(initial);
  const week = currentWeek(data);
  const [mode, setMode] = useState<ViewMode>("week");
  const [month, setMonth] = useState(monthStart(formatISODate(new Date())));
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dishType, setDishType] = useState<"全部" | DishType>("全部");
  const dragged = useRef(false);
  const today = formatISODate(new Date());
  const needle = query.trim().toLowerCase();
  const recipes = data.recipes.filter((recipe) => {
    const kind = classifyRecipe(recipe);
    if (dishType !== "全部" && kind.dishType !== dishType) return false;
    if (!needle) return true;
    return [recipe.draft.title, kind.dishType].join(" ").toLowerCase().includes(needle);
  });
  const picked = data.recipes.find((recipe) => recipe.id === pickedId) ?? null;
  const visibleDates = mode === "week" ? weekDates(week) : monthGrid(month);

  function place(date: string, payload: string) {
    if (payload.startsWith("recipe:")) {
      const recipeId = payload.slice("recipe:".length);
      const recipe = data.recipes.find((item) => item.id === recipeId);
      if (!recipe) return;
      addMeal({ date, slot: "dinner", recipeId, servings: 1 });
      return;
    }
    if (payload.startsWith("meal:")) updateMeal(payload.slice("meal:".length), { date });
  }

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-3 py-4 xl:grid xl:grid-cols-[240px_minmax(0,1fr)] xl:px-4">
      <aside className="min-w-0 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-6.5rem)] xl:overflow-y-auto">
        <h1 className="text-xl font-semibold tracking-tight xl:text-2xl">收集的菜</h1>
        <p className="mt-1 text-sm leading-6 text-ink/65">一天可以放好几道不同的菜，同一道只放一次。拖过去，或点选后点那一天。</p>
        <div className="mt-3">
          <TaxonomyFilters dishType={dishType} onDishType={setDishType} />
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="找一道菜"
          className="mt-3 min-h-12 w-full rounded-2xl border border-line bg-card px-3 shadow-soft"
        />
        {picked ? <p className="mt-3 rounded-2xl bg-butter px-3 py-2 text-sm">正在拿着「{picked.draft.title}」</p> : null}
        <div className="mt-3 flex max-h-64 flex-col gap-3 overflow-y-auto xl:max-h-none">
          {DISH_TYPES.map((group) => {
            const items = recipes.filter((recipe) => classifyRecipe(recipe).dishType === group);
            if (!items.length) return null;
            return (
              <section key={group}>
                <h2 className="px-1 text-sm font-semibold text-clay">{group}</h2>
                <div className="mt-2 flex flex-col gap-2">
                  {items.map((recipe) => {
                    const kind = classifyRecipe(recipe);
                    return (
                      <article
                        key={recipe.id}
                        draggable
                        onDragStart={(event) => {
                          dragged.current = true;
                          event.dataTransfer.setData("text/plain", `recipe:${recipe.id}`);
                          event.dataTransfer.effectAllowed = "copy";
                          setPickedId(recipe.id);
                        }}
                        onClick={() => {
                          if (dragged.current) {
                            dragged.current = false;
                            return;
                          }
                          setPickedId((current) => (current === recipe.id ? null : recipe.id));
                        }}
                        className={`flex cursor-grab items-center gap-3 rounded-2xl bg-card p-2 text-left shadow-soft active:cursor-grabbing ${pickedId === recipe.id ? "ring-2 ring-clay" : ""}`}
                      >
                        <RecipeCover title={recipe.draft.title || "菜"} videoId={recipe.draft.video_id} className="h-16 w-24 shrink-0 rounded-xl" mark="text-lg" />
                        <span className="min-w-0">
                          <Link href={`/recipes/${recipe.id}`} className="block truncate font-semibold" onClick={(event) => event.stopPropagation()}>
                            {recipe.draft.title || "未命名菜谱"}
                          </Link>
                          <span className="mt-1 block text-xs text-ink/60">{kind.dishType}</span>
                        </span>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        {data.recipes.length === 0 ? (
          <p className="mt-3 text-sm leading-6">
            还没有菜。<Link href="/recipes" className="text-clay">先去菜谱库放入</Link>
          </p>
        ) : null}
      </aside>

      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-full bg-card p-1 shadow-soft">
            <button type="button" className={`min-h-11 rounded-full px-4 text-sm ${mode === "week" ? "bg-clay text-white" : ""}`} onClick={() => setMode("week")}>
              本周
            </button>
            <button type="button" className={`min-h-11 rounded-full px-4 text-sm ${mode === "month" ? "bg-clay text-white" : ""}`} onClick={() => setMode("month")}>
              本月
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="min-h-11 rounded-full bg-card px-3 text-sm shadow-soft" onClick={() => (mode === "week" ? setWeekStart(addDays(week, -7)) : setMonth(shiftMonth(month, -1)))}>
              上一{mode === "week" ? "周" : "月"}
            </button>
            <p className="min-w-28 text-center text-sm font-medium">{mode === "week" ? `${shortDate(week)} – ${shortDate(addDays(week, 6))}` : monthTitle(month)}</p>
            <button type="button" className="min-h-11 rounded-full bg-card px-3 text-sm shadow-soft" onClick={() => (mode === "week" ? setWeekStart(addDays(week, 7)) : setMonth(shiftMonth(month, 1)))}>
              下一{mode === "week" ? "周" : "月"}
            </button>
          </div>
        </div>

        {mode === "week" ? (
          <>
            <div className="mt-4 flex flex-col gap-3 xl:hidden">
              {visibleDates.map((date) => (
                <DayCard key={date} date={date} today={today} meals={data.meals} recipes={data.recipes} picked={picked} active={over === date} setOver={setOver} onPlace={place} layout="row" />
              ))}
            </div>
            <div className="mt-4 hidden xl:grid xl:grid-cols-7 xl:items-start xl:gap-3">
              {visibleDates.map((date) => (
                <DayCard key={date} date={date} today={today} meals={data.meals} recipes={data.recipes} picked={picked} active={over === date} setOver={setOver} onPlace={place} layout="column" />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4">
            <div className="grid grid-cols-7 gap-1 px-1 pb-2 text-center text-xs text-ink/55 sm:gap-2 sm:text-sm">
              {weekDates(week).map((date) => (
                <span key={date}>{weekdayLabel(date)}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {visibleDates.map((date) => (
                <DayCard
                  key={date}
                  date={date}
                  today={today}
                  meals={data.meals}
                  recipes={data.recipes}
                  picked={picked}
                  active={over === date}
                  setOver={setOver}
                  onPlace={place}
                  layout="month"
                  muted={!inSameMonth(date, month)}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function DayCard({
  date,
  today,
  meals,
  recipes,
  picked,
  active,
  setOver,
  onPlace,
  layout,
  muted = false,
}: {
  date: string;
  today: string;
  meals: MealEntry[];
  recipes: SavedRecipe[];
  picked: SavedRecipe | null;
  active: boolean;
  setOver: (value: string | null) => void;
  onPlace: (date: string, payload: string) => void;
  layout: "row" | "column" | "month";
  muted?: boolean;
}) {
  const dayMeals = useMemo(() => meals.filter((meal) => meal.date === date), [meals, date]);
  const tall = layout === "column";
  return (
    <section className={`rounded-3xl bg-card shadow-soft ${layout === "month" ? "min-h-24 p-1.5 sm:min-h-28 sm:p-2" : tall ? "p-2.5" : "p-3"} ${date === today ? "ring-2 ring-butter" : ""} ${muted ? "opacity-45" : ""}`}>
      {tall ? (
        <div className="flex h-11 flex-col justify-center px-0.5">
          <div className="flex h-5 items-center justify-between gap-1">
            <span className="truncate text-sm font-semibold leading-5">{weekdayLabel(date)}</span>
            {date === today ? <span className="shrink-0 rounded-full bg-butter px-1.5 text-[11px] leading-4">今天</span> : null}
          </div>
          <p className="h-4 truncate text-xs leading-4 text-ink/55">{shortDate(date)}</p>
        </div>
      ) : (
        <h2 className={`font-semibold ${layout === "month" ? "text-xs sm:text-sm" : "text-base"}`}>
          {layout === "month" ? parseDay(date) : `${weekdayLabel(date)} ${shortDate(date)}`}
          {date === today ? " · 今天" : ""}
        </h2>
      )}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(date);
        }}
        onDragLeave={() => setOver(null)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(null);
          onPlace(date, event.dataTransfer.getData("text/plain"));
        }}
        onClick={() => {
          if (picked) onPlace(date, `recipe:${picked.id}`);
        }}
        className={`mt-2 rounded-2xl border border-dashed p-1.5 ${tall ? "flex flex-col gap-2" : "flex flex-col gap-2"} ${dayMeals.length === 0 ? "min-h-16" : ""} ${active ? "border-clay bg-blush/80" : picked ? "border-clay/40" : "border-line"} ${picked ? "cursor-pointer" : ""}`}
      >
        {dayMeals.length === 0 ? <p className={`text-ink/40 ${layout === "month" ? "text-[11px]" : "py-3 text-center text-sm"}`}>{layout === "month" ? "空" : "拖到这一天"}</p> : null}
        <ul className="flex flex-col gap-2">
          {dayMeals.map((meal) => {
            const recipe = recipes.find((item) => item.id === meal.recipeId);
            const title = recipe?.draft.title || "菜谱已删除";
            const href = recipe ? `/recipes/${recipe.id}` : "/recipes";
            return (
              <li
                key={meal.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", `meal:${meal.id}`);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => event.preventDefault()}
                onClick={(event) => event.stopPropagation()}
                className={layout === "month" ? "truncate text-xs sm:text-sm" : layout === "row" ? "flex items-center gap-3 rounded-2xl bg-white p-2" : "relative overflow-hidden rounded-2xl bg-white"}
              >
                {layout === "month" ? (
                  <Link href={href}>{title}</Link>
                ) : layout === "row" ? (
                  <>
                    <Link href={href} draggable={false} className="flex min-w-0 flex-1 items-center gap-3">
                      <RecipeCover title={title} videoId={recipe?.draft.video_id ?? null} className="h-20 w-28 shrink-0 rounded-xl" mark="text-xl" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold leading-6">{title}</span>
                        {recipe ? <KindChips dishType={classifyRecipe(recipe).dishType} /> : null}
                      </span>
                    </Link>
                    <button type="button" aria-label="移除" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg text-ink/45" onClick={() => removeMeal(meal.id)}>
                      ×
                    </button>
                  </>
                ) : (
                  <>
                    <Link href={href} draggable={false} className="block">
                      <RecipeCover title={title} videoId={recipe?.draft.video_id ?? null} className="aspect-[16/10] w-full" mark="text-2xl" />
                      <span className="flex h-10 items-center truncate pl-2 pr-9 text-sm font-semibold leading-5">{title}</span>
                    </Link>
                    <button type="button" aria-label="移除" className="absolute right-1 bottom-1.5 grid h-7 w-7 place-items-center rounded-full text-base leading-none text-ink/45" onClick={() => removeMeal(meal.id)}>
                      ×
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {dayMeals.length > 0 && layout !== "month" ? <p className="rounded-xl py-2 text-center text-xs text-ink/45">再放一道</p> : null}
      </div>
    </section>
  );
}

function parseDay(isoDate: string): string {
  return String(Number(isoDate.slice(8)));
}
