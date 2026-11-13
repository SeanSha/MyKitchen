import type { RecipeDraft } from "@/lib/video/types";
import { mondayOf } from "./dates";
import { householdSeasoningName } from "./seasoning-groups";
import type { CookStatus, KitchenData, MealEntry, MealSlot, SavedRecipe } from "./types";
import { emptyKitchen } from "./types";

const STORAGE_KEY = "my-kitchen-v1";
const CHANGE_EVENT = "my-kitchen-change";
const PUSH_EVENT = "my-kitchen-push";
const serverKitchen = emptyKitchen();
let snapshot = serverKitchen;
let rawSnapshot: string | null = null;

export function getServerKitchen(): KitchenData {
  return serverKitchen;
}

export function loadKitchen(): KitchenData {
  if (typeof window === "undefined") return serverKitchen;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === rawSnapshot) return snapshot;
  rawSnapshot = raw;
  snapshot = raw ? parseKitchen(raw) : emptyKitchen();
  return snapshot;
}

export function hasStoredKitchen(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) !== null;
}

export function emitKitchenChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function saveKitchen(data: KitchenData, options?: { skipRemote?: boolean }) {
  snapshot = data;
  rawSnapshot = JSON.stringify(data);
  window.localStorage.setItem(STORAGE_KEY, rawSnapshot);
  window.dispatchEvent(new Event(CHANGE_EVENT));
  if (!options?.skipRemote) window.dispatchEvent(new Event(PUSH_EVENT));
}

export function parseKitchen(raw: string): KitchenData {
  try {
    const parsed = JSON.parse(raw) as Partial<KitchenData>;
    return {
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
      meals: Array.isArray(parsed.meals) ? parsed.meals : [],
      checks: parsed.checks && typeof parsed.checks === "object" ? parsed.checks : {},
      weekStart: typeof parsed.weekStart === "string" ? parsed.weekStart : "",
      pantry: Array.isArray(parsed.pantry) ? parsed.pantry.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [],
    };
  } catch {
    return emptyKitchen();
  }
}

export function subscribeKitchen(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function analyzedSaveTarget(recipes: Array<{ id: string; draft: { source_url: string } }>, sourceUrl: string): string | null {
  if (!sourceUrl) return null;
  return recipes.find((recipe) => recipe.draft.source_url === sourceUrl)?.id ?? null;
}

export function saveAnalyzedRecipe(draft: RecipeDraft): { recipe: SavedRecipe; created: boolean } {
  const existingId = analyzedSaveTarget(loadKitchen().recipes, draft.source_url);
  if (existingId) {
    const existing = loadKitchen().recipes.find((recipe) => recipe.id === existingId);
    if (existing) return { recipe: existing, created: false };
  }
  return { recipe: saveRecipe(draft), created: true };
}

export function saveRecipe(draft: RecipeDraft, existingId?: string): SavedRecipe {
  const data = loadKitchen();
  const now = new Date().toISOString();
  const current = existingId ? data.recipes.find((recipe) => recipe.id === existingId) : undefined;
  const recipe: SavedRecipe = {
    id: current?.id ?? crypto.randomUUID(),
    savedAt: current?.savedAt ?? now,
    updatedAt: now,
    draft,
    notes: current?.notes ?? "",
    cookStatus: current?.cookStatus ?? "untested",
    rating: current?.rating ?? null,
    favorite: current?.favorite ?? false,
    dishType: current?.dishTypeManual ? current.dishType : undefined,
    dishTypeManual: Boolean(current?.dishTypeManual),
  };
  const recipes = current
    ? data.recipes.map((item) => (item.id === recipe.id ? recipe : item))
    : [recipe, ...data.recipes];
  saveKitchen({ ...data, recipes });
  return recipe;
}

export function updateRecipe(id: string, patch: Partial<Pick<SavedRecipe, "notes" | "cookStatus" | "rating" | "favorite" | "dishType" | "dishTypeManual">>) {
  const data = loadKitchen();
  saveKitchen({
    ...data,
    recipes: data.recipes.map((recipe) =>
      recipe.id === id ? { ...recipe, ...patch, updatedAt: new Date().toISOString() } : recipe,
    ),
  });
}

export function removeRecipe(id: string) {
  const data = loadKitchen();
  saveKitchen({
    recipes: data.recipes.filter((recipe) => recipe.id !== id),
    meals: data.meals.filter((meal) => meal.recipeId !== id),
    checks: data.checks,
    weekStart: data.weekStart,
    pantry: data.pantry,
  });
}

export function importDrafts(drafts: RecipeDraft[]): number {
  const data = loadKitchen();
  const known = new Set(data.recipes.map((recipe) => recipe.draft.source_url).filter(Boolean));
  let added = 0;
  const recipes = [...data.recipes];
  for (const draft of drafts) {
    if (draft.source_url && known.has(draft.source_url)) continue;
    const now = new Date().toISOString();
    recipes.unshift({
      id: crypto.randomUUID(),
      savedAt: now,
      updatedAt: now,
      draft,
      notes: "",
      cookStatus: "untested",
      rating: null,
      favorite: false,
    });
    if (draft.source_url) known.add(draft.source_url);
    added += 1;
  }
  if (added) saveKitchen({ ...data, recipes });
  return added;
}

export function alreadyOnDay(meals: Array<{ date: string; recipeId: string }>, date: string, recipeId: string): boolean {
  return meals.some((meal) => meal.date === date && meal.recipeId === recipeId);
}

export function addMeal(entry: Omit<MealEntry, "id">): MealEntry {
  const data = loadKitchen();
  const existing = data.meals.find((meal) => meal.date === entry.date && meal.recipeId === entry.recipeId);
  if (existing) return existing;
  const meal = { ...entry, id: crypto.randomUUID(), servings: 1 };
  saveKitchen({ ...data, meals: [...data.meals, meal] });
  return meal;
}

export function updateMeal(id: string, patch: Partial<Pick<MealEntry, "date" | "slot" | "servings">>) {
  const data = loadKitchen();
  const current = data.meals.find((meal) => meal.id === id);
  if (!current) return;
  const next = { ...current, ...patch };
  if (data.meals.some((meal) => meal.id !== id && meal.date === next.date && meal.recipeId === next.recipeId)) return;
  saveKitchen({
    ...data,
    meals: data.meals.map((meal) => (meal.id === id ? next : meal)),
  });
}

export function blankDraft(): RecipeDraft {
  return {
    title: "",
    language: "zh-CN",
    source_url: "",
    video_id: null,
    creator: null,
    description: "",
    cooking_time: null,
    preparation_time: null,
    servings: null,
    categories: [],
    ingredients: [],
    seasonings: [],
    cooking_steps: [],
    cooking_tips: [],
    missing_information: [],
    uncertain_information: [],
  };
}

export function createRecipe(): SavedRecipe {
  return saveRecipe(blankDraft());
}

export function removeMeal(id: string) {
  const data = loadKitchen();
  saveKitchen({ ...data, meals: data.meals.filter((meal) => meal.id !== id) });
}

export function currentWeek(data: KitchenData): string {
  return data.weekStart || mondayOf(new Date());
}

export function setWeekStart(weekStart: string) {
  const data = loadKitchen();
  saveKitchen({ ...data, weekStart });
}

export function toggleCheck(weekStart: string, lineKey: string) {
  const data = loadKitchen();
  const current = new Set(data.checks[weekStart] ?? []);
  if (current.has(lineKey)) current.delete(lineKey);
  else current.add(lineKey);
  saveKitchen({ ...data, checks: { ...data.checks, [weekStart]: [...current] } });
}

export function isChecked(data: KitchenData, weekStart: string, lineKey: string): boolean {
  return (data.checks[weekStart] ?? []).includes(lineKey);
}

export function slotLabel(slot: MealSlot): string {
  return slot === "lunch" ? "午饭" : "晚饭";
}

export function statusLabel(status: CookStatus): string {
  if (status === "success") return "做过，成功";
  if (status === "needs_improvement") return "需要调整";
  return "还没做过";
}

export function pantryKey(name: string): string {
  return householdSeasoningName(name).trim().toLowerCase().replace(/\s+/g, "");
}

export function addPantryItem(name: string) {
  const trimmed = householdSeasoningName(name);
  const key = pantryKey(trimmed);
  if (!key) return;
  const data = loadKitchen();
  if (data.pantry.some((item) => pantryKey(item) === key)) return;
  saveKitchen({ ...data, pantry: [...data.pantry, trimmed].sort((a, b) => a.localeCompare(b, "zh-CN")) });
}

export function removePantryItem(name: string) {
  const key = pantryKey(name);
  const data = loadKitchen();
  saveKitchen({ ...data, pantry: data.pantry.filter((item) => pantryKey(item) !== key) });
}
