import { householdSeasoningName } from "./seasoning-groups";
import type { RecipeIngredient } from "@/lib/video/types";
import type { IngredientKind, SavedRecipe, ScaledIngredient, ShoppingLine } from "./types";

interface UnitRule {
  canonical: string;
  family: "mass" | "volume" | "spoon";
  base: number;
}

const UNITS: Record<string, UnitRule> = {
  g: { canonical: "克", family: "mass", base: 1 },
  gram: { canonical: "克", family: "mass", base: 1 },
  grams: { canonical: "克", family: "mass", base: 1 },
  克: { canonical: "克", family: "mass", base: 1 },
  kg: { canonical: "千克", family: "mass", base: 1000 },
  千克: { canonical: "千克", family: "mass", base: 1000 },
  公斤: { canonical: "千克", family: "mass", base: 1000 },
  ml: { canonical: "毫升", family: "volume", base: 1 },
  毫升: { canonical: "毫升", family: "volume", base: 1 },
  l: { canonical: "升", family: "volume", base: 1000 },
  升: { canonical: "升", family: "volume", base: 1000 },
  tsp: { canonical: "茶匙", family: "spoon", base: 1 },
  茶匙: { canonical: "茶匙", family: "spoon", base: 1 },
  小勺: { canonical: "茶匙", family: "spoon", base: 1 },
  tbsp: { canonical: "汤匙", family: "spoon", base: 3 },
  汤匙: { canonical: "汤匙", family: "spoon", base: 3 },
  大勺: { canonical: "汤匙", family: "spoon", base: 3 },
};

export interface PlanDish {
  title: string;
  recipeServings: number | null;
  plannedServings: number;
  ingredients: RecipeIngredient[];
  seasonings: RecipeIngredient[];
}

export function dishesFromRecipes(
  recipes: SavedRecipe[],
  meals: Array<{ recipeId: string; servings: number }>,
): PlanDish[] {
  return meals.flatMap((meal) => {
    const recipe = recipes.find((item) => item.id === meal.recipeId);
    if (!recipe) return [];
    return [
      {
        title: recipe.draft.title || "未命名菜谱",
        recipeServings: 1,
        plannedServings: 1,
        ingredients: recipe.draft.ingredients.filter((item) => item.name.trim()),
        seasonings: recipe.draft.seasonings.filter((item) => item.name.trim()),
      },
    ];
  });
}

export function buildShoppingList(dishes: PlanDish[]): ShoppingLine[] {
  const scaled = dishes.flatMap((dish) => [
    ...dish.ingredients.map((item) => scaleItem(item, "ingredient", dish)),
    ...dish.seasonings.map((item) => {
      const scaled = scaleItem(item, "seasoning", dish);
      const name = householdSeasoningName(item.name);
      return { ...scaled, name, normalizedName: name };
    }),
  ]);
  const groups = new Map<string, ScaledIngredient[]>();
  for (const item of scaled) {
    const key = groupKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .map(([key, items]) => toLine(key, items))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, "zh-CN"));
}

export function omitStockedSeasonings(lines: ShoppingLine[], stock: string[]): ShoppingLine[] {
  const owned = new Set(stock.map((name) => pantryMatchKey(householdSeasoningName(name))).filter(Boolean));
  if (owned.size === 0) return lines;
  return lines.filter((line) => line.kind !== "seasoning" || !owned.has(pantryMatchKey(householdSeasoningName(line.name))));
}

function pantryMatchKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

export function carryText(line: Pick<ShoppingLine, "name" | "quantityLabel">): string {
  if (!line.quantityLabel || line.quantityLabel === "用量未知") return line.name;
  return `${line.name} ${line.quantityLabel}`;
}

export function scaleItem(item: RecipeIngredient, kind: IngredientKind, dish: PlanDish): ScaledIngredient {
  const base = {
    name: item.name,
    normalizedName: item.normalized_name || item.name,
    kind,
    unit: item.unit,
    sourceType: item.source_type,
    recipeTitle: dish.title,
  };
  if (item.quantity == null) {
    return { ...base, quantity: null, scaleNote: null };
  }
  if (dish.recipeServings == null || dish.recipeServings <= 0) {
    return { ...base, quantity: item.quantity, scaleNote: "菜谱没有份量，数量没有按计划份数换算" };
  }
  const quantity = roundQuantity(item.quantity * (dish.plannedServings / dish.recipeServings));
  const changed = dish.plannedServings !== dish.recipeServings;
  return {
    ...base,
    quantity,
    scaleNote: changed ? `按 ${dish.recipeServings} 份换算为 ${dish.plannedServings} 份` : null,
  };
}

function groupKey(item: ScaledIngredient): string {
  if (item.quantity == null || !item.unit) return `${item.kind}|${normalize(item.normalizedName)}|unknown`;
  const rule = unitRule(item.unit);
  if (!rule) return `${item.kind}|${normalize(item.normalizedName)}|raw|${item.unit.trim().toLowerCase()}`;
  return `${item.kind}|${normalize(item.normalizedName)}|family|${rule.family}`;
}

function toLine(key: string, items: ScaledIngredient[]): ShoppingLine {
  const first = items[0];
  const recipes = [...new Set(items.map((item) => item.recipeTitle))];
  const notes = [...new Set(items.map((item) => item.scaleNote).filter((note): note is string => Boolean(note)))];
  const sourceTypes = new Set(items.map((item) => item.sourceType));
  const sourceType = sourceTypes.size === 1 ? first.sourceType : "mixed";
  if (key.endsWith("|unknown") || items.some((item) => item.quantity == null || !item.unit)) {
    return {
      key,
      kind: first.kind,
      name: displayName(items),
      quantityLabel: "用量未知",
      sourceType,
      recipes,
      note: joinNotes(...notes, sourceType === "mixed" ? "含估算或不同来源" : null),
    };
  }
  const rules = items.map((item) => unitRule(item.unit ?? ""));
  const sameRawUnit = rules.every((rule) => !rule) && new Set(items.map((item) => item.unit)).size === 1;
  if (sameRawUnit) {
    const sum = items.reduce((total, item) => total + (item.quantity ?? 0), 0);
    return {
      key,
      kind: first.kind,
      name: displayName(items),
      quantityLabel: `${formatNumber(sum)}${first.unit ?? ""}`,
      sourceType,
      recipes,
      note: sourceNote(notes, sourceType),
    };
  }
  if (rules.some((rule) => !rule) || new Set(rules.map((rule) => rule?.family)).size !== 1) {
    return {
      key,
      kind: first.kind,
      name: displayName(items),
      quantityLabel: items.map((item) => `${formatNumber(item.quantity ?? 0)}${item.unit ?? ""}`).join(" + "),
      sourceType,
      recipes,
      note: joinNotes(...notes, "单位不能安全相加，请分别购买"),
    };
  }
  const family = rules[0]!.family;
  const base = items.reduce((sum, item) => sum + (item.quantity ?? 0) * unitRule(item.unit ?? "")!.base, 0);
  const rendered = renderFamily(family, base);
  return {
    key,
    kind: first.kind,
    name: displayName(items),
    quantityLabel: `${formatNumber(rendered.quantity)}${rendered.unit}`,
    sourceType,
    recipes,
    note: sourceNote(notes, sourceType),
  };
}

function sourceNote(notes: string[], sourceType: ShoppingLine["sourceType"]): string | null {
  const source = sourceType === "estimated" ? "估算用量" : sourceType === "mixed" ? "含估算用量" : null;
  return joinNotes(...notes, source);
}

function renderFamily(family: UnitRule["family"], base: number): { quantity: number; unit: string } {
  if (family === "mass") return base >= 1000 ? { quantity: roundQuantity(base / 1000), unit: "千克" } : { quantity: roundQuantity(base), unit: "克" };
  if (family === "volume") return base >= 1000 ? { quantity: roundQuantity(base / 1000), unit: "升" } : { quantity: roundQuantity(base), unit: "毫升" };
  if (base % 3 === 0) return { quantity: roundQuantity(base / 3), unit: "汤匙" };
  return { quantity: roundQuantity(base), unit: "茶匙" };
}

function unitRule(unit: string): UnitRule | null {
  return UNITS[unit.trim().toLowerCase()] ?? null;
}

function displayName(items: ScaledIngredient[]): string {
  return items.map((item) => item.name).sort((a, b) => a.length - b.length)[0] ?? "未命名";
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function joinNotes(...notes: Array<string | null>): string | null {
  const unique = [...new Set(notes.filter((note): note is string => Boolean(note)))];
  return unique.length ? unique.join("；") : null;
}

function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(roundQuantity(value));
}
