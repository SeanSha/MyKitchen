"use client";

import Link from "next/link";
import { useState } from "react";
import { useKitchen } from "@/components/use-kitchen";
import { groupSeasonings, householdSeasoningName } from "@/lib/kitchen/seasoning-groups";
import { addPantryItem, pantryKey, removePantryItem } from "@/lib/kitchen/storage";

export default function PantryPage() {
  const { data } = useKitchen();
  const [name, setName] = useState("");
  const owned = new Set(data.pantry.map((item) => pantryKey(item)));
  const seen = new Set<string>();
  const suggestions = data.recipes.flatMap((recipe) => recipe.draft.seasonings.map((item) => householdSeasoningName(item.name))).filter((item) => {
    const key = pantryKey(item);
    if (!key || owned.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  function add(value: string) {
    addPantryItem(value);
    setName("");
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <header>
        <p className="text-sm text-clay">家里常备</p>
        <h1 className="text-3xl font-semibold tracking-tight">调料库存</h1>
      </header>
      <p className="text-sm leading-6 text-ink/70">
        记在这里的调料，采购清单里不再列出。食材仍然会按天出现。
        <Link href="/shopping" className="text-clay">回到采购清单</Link>
      </p>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          add(name);
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="比如精盐、生抽、食用油"
          aria-label="调料名称"
          className="min-h-12 min-w-0 flex-1 rounded-2xl border border-line bg-card px-3 shadow-soft"
        />
        <button type="submit" className="min-h-12 shrink-0 rounded-full bg-clay px-5 text-white">
          加入
        </button>
      </form>
      {data.pantry.length === 0 ? <p className="rounded-3xl bg-card p-4 leading-7 shadow-soft">还没有记下家里的调料。</p> : null}
      {groupSeasonings([...new Set(data.pantry.map((item) => householdSeasoningName(item)))]).map((entry) => (
        <section key={entry.group}>
          <h2 className="text-lg font-semibold">{entry.group}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {entry.names.map((item) => (
              <li key={pantryKey(item)} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-card px-4 shadow-soft">
                <span className="font-medium">{item}</span>
                <button type="button" className="min-h-11 rounded-full px-3 text-sm text-ink/55" onClick={() => removePantryItem(item)}>
                  用完了
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {suggestions.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">菜谱里出现过</h2>
            <p className="mt-1 text-sm leading-6 text-ink/60">按类别找，点一下表示家里已经有。</p>
          </div>
          {groupSeasonings(suggestions).map((entry) => (
            <div key={entry.group}>
              <h3 className="text-sm font-semibold text-clay">{entry.group}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {entry.names.map((item) => (
                  <button key={pantryKey(item)} type="button" className="min-h-11 rounded-full bg-card px-4 text-sm shadow-soft" onClick={() => addPantryItem(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}
