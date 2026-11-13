"use client";

import { useState } from "react";
import type { CookingStep, RecipeDraft, RecipeIngredient } from "@/lib/video/types";

export function RecipeFields({ draft, onChange }: { draft: RecipeDraft; onChange: (draft: RecipeDraft) => void }) {
  return (
    <>
      <IngredientEditor title="食材" items={draft.ingredients} onChange={(ingredients) => onChange({ ...draft, ingredients })} />
      <IngredientEditor title="调料" items={draft.seasonings} onChange={(seasonings) => onChange({ ...draft, seasonings })} />
      <StepEditor steps={draft.cooking_steps} onChange={(cooking_steps) => onChange({ ...draft, cooking_steps })} />
    </>
  );
}

function IngredientEditor({
  title,
  items,
  onChange,
}: {
  title: string;
  items: RecipeIngredient[];
  onChange: (items: RecipeIngredient[]) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button type="button" className="min-h-11 rounded-full bg-card px-4 text-sm" onClick={() => onChange([...items, blankIngredient()])}>
          加一条
        </button>
      </div>
      {items.length === 0 ? <p className="text-sm text-ink/60">还没有{title}。用量可以空着，想好了再写。</p> : null}
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={index} className="rounded-2xl bg-card p-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_7rem_6rem_auto]">
              <input
                aria-label={`${title}名称`}
                value={item.name}
                placeholder="名称"
                className="min-h-11 rounded-xl border border-line bg-white px-3"
                onChange={(event) => onChange(replace(items, index, named(item, event.target.value)))}
              />
              <QuantityField
                label={`${title}用量`}
                quantity={item.quantity}
                onCommit={(quantity) => onChange(replace(items, index, withQuantity(item, quantity)))}
              />
              <input
                aria-label={`${title}单位`}
                value={item.unit ?? ""}
                placeholder="单位"
                className="min-h-11 rounded-xl border border-line bg-white px-3"
                onChange={(event) => onChange(replace(items, index, { ...item, unit: event.target.value || null }))}
              />
              <button type="button" aria-label={`删除${title}`} className="min-h-11 rounded-xl px-3 text-sm text-ink/50" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>
                删除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StepEditor({ steps, onChange }: { steps: CookingStep[]; onChange: (steps: CookingStep[]) => void }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">步骤</h2>
        <button type="button" className="min-h-11 rounded-full bg-card px-4 text-sm" onClick={() => onChange([...steps, blankStep(steps.length + 1)])}>
          加一步
        </button>
      </div>
      {steps.length === 0 ? <p className="text-sm text-ink/60">还没有步骤。</p> : null}
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <li key={index} className="rounded-2xl bg-card p-3">
            <div className="mb-2 flex items-center justify-between text-sm text-ink/55">
              <span>第 {index + 1} 步</span>
              <button
                type="button"
                className="min-h-11 px-2 text-ink/50"
                onClick={() => onChange(steps.filter((_, stepIndex) => stepIndex !== index).map((item, stepIndex) => ({ ...item, step_number: stepIndex + 1 })))}
              >
                删除
              </button>
            </div>
            <textarea
              aria-label={`第 ${index + 1} 步`}
              value={step.instruction}
              placeholder="这一步做什么"
              className="min-h-20 w-full rounded-xl border border-line bg-white px-3 py-2"
              onChange={(event) => onChange(steps.map((item, stepIndex) => (stepIndex === index ? { ...item, instruction: event.target.value, step_number: stepIndex + 1 } : { ...item, step_number: stepIndex + 1 })))}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function QuantityField({ quantity, onCommit, label }: { quantity: number | null; onCommit: (quantity: number | null) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (quantity == null ? "" : String(quantity));

  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={text}
      placeholder="用量"
      className="min-h-11 rounded-xl border border-line bg-white px-3"
      onFocus={() => setDraft(quantity == null ? "" : String(quantity))}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        const next = event.target.value.trim();
        if (next !== "" && !/^\d*\.?\d*$/.test(next)) return;
        setDraft(event.target.value);
        if (next === "" || next === ".") onCommit(null);
        else if (/^\d+(\.\d+)?$/.test(next)) onCommit(Number(next));
      }}
    />
  );
}

function blankIngredient(): RecipeIngredient {
  return {
    name: "",
    normalized_name: "",
    quantity: null,
    unit: null,
    preparation_notes: null,
    source_type: "unknown",
    evidence_timestamp: null,
  };
}

function blankStep(stepNumber: number): CookingStep {
  return {
    step_number: stepNumber,
    instruction: "",
    estimated_duration: null,
    heat_level: null,
    associated_ingredients: [],
    video_timestamp: null,
    evidence_notes: null,
  };
}

function named(item: RecipeIngredient, name: string): RecipeIngredient {
  return { ...item, name, normalized_name: name.trim() };
}

function withQuantity(item: RecipeIngredient, quantity: number | null): RecipeIngredient {
  if (quantity == null) return { ...item, quantity: null, source_type: "unknown" };
  return { ...item, quantity, source_type: "explicit" };
}

function replace<T>(items: T[], index: number, next: T): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? next : item));
}
