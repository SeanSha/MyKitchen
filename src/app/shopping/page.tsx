"use client";

import Link from "next/link";
import { useState } from "react";
import { WeekSwitcher } from "@/components/week-switcher";
import { useKitchen } from "@/components/use-kitchen";
import { addDays, formatISODate, mondayOf, parseISODate, shortDate, shoppingScopeDate, weekdayLabel, weekDates, type ShoppingScope } from "@/lib/kitchen/dates";
import { buildShoppingList, carryText, dishesFromRecipes, omitStockedSeasonings } from "@/lib/kitchen/shopping";
import { currentWeek, isChecked, toggleCheck } from "@/lib/kitchen/storage";
import type { KitchenData, ShoppingLine } from "@/lib/kitchen/types";

export default function ShoppingPage() {
  const { data } = useKitchen();
  const week = currentWeek(data);
  const today = formatISODate(new Date());
  const [scope, setScope] = useState<ShoppingScope>("tomorrow");
  const [copied, setCopied] = useState(false);
  const dates = scope === "week" ? weekDates(week) : [shoppingScopeDate(today, scope)];
  const days = dates.map((date) => {
    const meals = data.meals.filter((meal) => meal.date === date);
    const lines = omitStockedSeasonings(buildShoppingList(dishesFromRecipes(data.recipes, meals)), data.pantry);
    return { date, meals, lines, picked: lines.filter((line) => picked(data, date, line)) };
  });
  const visible = scope === "week" ? days.filter((day) => day.meals.length > 0 || day.date === today) : days;
  const carryDays = visible.filter((day) => day.picked.length > 0);

  async function copyList() {
    const text = carryDays
      .map((day) => [dayHeading(day.date, today), ...day.picked.map((line) => carryText(line))].join("\n"))
      .join("\n\n");
    await navigator.clipboard.writeText(text || "还没有勾选要买的");
    setCopied(true);
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <header>
        <p className="text-sm text-clay">按天准备</p>
        <h1 className="text-3xl font-semibold tracking-tight">采购清单</h1>
      </header>
      <div className="flex flex-wrap gap-2" role="group" aria-label="准备哪一天">
        {(
          [
            ["today", "今天"],
            ["tomorrow", "明天"],
            ["dayAfter", "后天"],
            ["week", "本周"],
          ] as const
        ).map(([value, label]) => {
          const active = scope === value;
          const date = value === "week" ? "" : shoppingScopeDate(today, value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setScope(value)}
              className={`min-h-12 rounded-full px-4 text-sm ${active ? "bg-clay text-white" : "border border-line bg-card"}`}
            >
              {label}
              {date ? <span className={`ml-1 ${active ? "text-white/80" : "text-ink/50"}`}>{shortDate(date)}</span> : null}
            </button>
          );
        })}
      </div>
      {scope === "week" ? <WeekSwitcher week={week} /> : null}
      <section className="rounded-3xl bg-mint p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">超市清单</h2>
          <button type="button" onClick={() => void copyList()} className="min-h-11 rounded-full bg-moss px-4 text-sm text-white">
            {copied ? "已复制" : "复制这张清单"}
          </button>
        </div>
        {carryDays.length === 0 ? (
          <p className="mt-2 leading-7 text-ink/70">勾下面你这次要买的。勾上的才会出现在这里，这张就是拿去超市的清单。</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {carryDays.map((day) => (
              <div key={day.date}>
                {scope === "week" ? <p className="text-sm font-medium text-ink/60">{dayHeading(day.date, today)}</p> : null}
                <ul className="mt-1 flex flex-col gap-2">
                  {day.picked.map((line) => (
                    <li key={line.key} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-white px-3">
                      <span className="font-medium">{carryText(line)}</span>
                      <button type="button" className="min-h-11 shrink-0 rounded-full px-3 text-sm text-ink/55" onClick={() => togglePick(day.date, line)}>
                        拿掉
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="text-sm leading-6 text-ink/70">
        下面是菜谱里的材料，当成选项。用量只是参考，家里已经有的调料不会出现，到
        <Link href="/pantry" className="text-clay">调料库存</Link>
        里记一笔就行。
      </p>
      {scope === "week" && visible.every((day) => day.meals.length === 0) ? (
        <p className="rounded-3xl bg-card p-4 leading-7 shadow-soft">
          这一周还没有安排。<Link href="/planner" className="text-clay">先去计划页把菜拖进日历</Link>
        </p>
      ) : null}
      {visible.map((day) => (
        <section key={day.date} className={`rounded-3xl bg-card p-4 shadow-soft ${day.date === today ? "ring-2 ring-butter" : ""}`}>
          <h2 className="text-lg font-semibold">{dayHeading(day.date, today)}</h2>
          {day.meals.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-ink/60">
              这天还没有安排，不用买菜。<Link href="/planner" className="text-clay">去计划页安排</Link>
            </p>
          ) : null}
          <ul className="mt-2 flex flex-wrap gap-2">
            {day.meals.map((meal) => {
              const recipe = data.recipes.find((item) => item.id === meal.recipeId);
              return (
                <li key={meal.id} className="rounded-full bg-blush px-3 py-1 text-sm">
                  {recipe?.draft.title || "菜谱已删除"}
                </li>
              );
            })}
          </ul>
          <LineGroup title="食材" lines={day.lines.filter((line) => line.kind === "ingredient")} date={day.date} data={data} />
          <LineGroup title="调料" lines={day.lines.filter((line) => line.kind === "seasoning")} date={day.date} data={data} />
        </section>
      ))}
      {scope === "week" ? <p className="text-xs text-ink/45">本周范围到 {shortDate(addDays(week, 6))}</p> : null}
    </main>
  );
}

function dayHeading(date: string, today: string): string {
  const when = date === today ? "今天" : date === addDays(today, 1) ? "明天" : date === addDays(today, 2) ? "后天" : "";
  const label = `${weekdayLabel(date)} ${shortDate(date)}`;
  return when ? `${when} · ${label}` : label;
}

function weekOf(date: string): string {
  return mondayOf(parseISODate(date));
}

function pickKey(date: string, lineKey: string): string {
  return `pick|${date}|${lineKey}`;
}

function picked(data: KitchenData, date: string, line: ShoppingLine): boolean {
  return isChecked(data, weekOf(date), pickKey(date, line.key));
}

function togglePick(date: string, line: ShoppingLine) {
  toggleCheck(weekOf(date), pickKey(date, line.key));
}

function LineGroup({ title, lines, date, data }: { title: string; lines: ShoppingLine[]; date: string; data: KitchenData }) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-ink/70">{title}</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {lines.map((line) => {
          const chosen = picked(data, date, line);
          return (
            <li key={line.key}>
              <label className={`flex min-h-14 items-start gap-3 rounded-2xl px-3 py-3 ${chosen ? "bg-mint" : "bg-white"}`}>
                <input type="checkbox" className="mt-1 h-5 w-5 accent-moss" checked={chosen} onChange={() => togglePick(date, line)} />
                <span>
                  <span className="block font-medium">{line.name}</span>
                  {line.quantityLabel !== "用量未知" ? <span className="mt-1 block text-sm text-ink/55">{line.quantityLabel}</span> : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
