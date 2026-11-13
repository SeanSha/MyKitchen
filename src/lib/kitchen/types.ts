import type { IngredientSourceType, RecipeDraft } from "@/lib/video/types";
import type { DishType } from "./taxonomy";

export type CookStatus = "untested" | "success" | "needs_improvement";
export type MealSlot = "lunch" | "dinner";
export type IngredientKind = "ingredient" | "seasoning";

export interface SavedRecipe {
  id: string;
  savedAt: string;
  updatedAt: string;
  draft: RecipeDraft;
  notes: string;
  cookStatus: CookStatus;
  rating: number | null;
  favorite: boolean;
  dishType?: DishType;
  dishTypeManual?: boolean;
}

export interface MealEntry {
  id: string;
  date: string;
  slot: MealSlot;
  recipeId: string;
  servings: number;
}

export interface KitchenData {
  recipes: SavedRecipe[];
  meals: MealEntry[];
  checks: Record<string, string[]>;
  weekStart: string;
  pantry: string[];
}

export interface ShoppingLine {
  key: string;
  kind: IngredientKind;
  name: string;
  quantityLabel: string;
  sourceType: IngredientSourceType | "mixed";
  recipes: string[];
  note: string | null;
}

export interface ScaledIngredient {
  name: string;
  normalizedName: string;
  kind: IngredientKind;
  quantity: number | null;
  unit: string | null;
  sourceType: IngredientSourceType;
  recipeTitle: string;
  scaleNote: string | null;
}

export function emptyKitchen(): KitchenData {
  return { recipes: [], meals: [], checks: {}, weekStart: "", pantry: [] };
}
