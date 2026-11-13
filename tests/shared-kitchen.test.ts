import assert from "node:assert/strict";
import test from "node:test";
import { preferKitchen } from "../src/lib/kitchen/shared";
import { emptyKitchen, type KitchenData, type SavedRecipe } from "../src/lib/kitchen/types";

function kitchen(recipes: Array<[string, string]>, meals = 0): KitchenData {
  return {
    ...emptyKitchen(),
    recipes: recipes.map(([id, updatedAt]) => ({ id, updatedAt }) as SavedRecipe),
    meals: Array.from({ length: meals }, (_, index) => ({ id: `meal-${index}`, date: "2026-11-12", slot: "dinner" as const, recipeId: recipes[0]?.[0] ?? "missing", servings: 1 })),
  };
}

test("an empty phone takes the kitchen stored on this computer", () => {
  const remote = kitchen([["shrimp", "2026-11-11T20:00:00.000Z"], ["bun", "2026-11-11T21:00:00.000Z"]], 2);
  assert.equal(preferKitchen(emptyKitchen(), remote), "remote");
});

test("a fuller local kitchen is kept when the shared copy is empty", () => {
  const local = kitchen([["shrimp", "2026-11-11T20:00:00.000Z"]]);
  assert.equal(preferKitchen(local, emptyKitchen()), "local");
});

test("the same kitchen is left alone", () => {
  const local = kitchen([["shrimp", "2026-11-11T20:00:00.000Z"]], 1);
  const remote = kitchen([["shrimp", "2026-11-11T20:00:00.000Z"]], 1);
  assert.equal(preferKitchen(local, remote), "same");
});

test("a short browser copy does not replace the saved kitchen", () => {
  const local = kitchen([["shrimp", "2026-11-11T22:00:00.000Z"]]);
  const remote = kitchen([
    ["shrimp", "2026-11-11T20:00:00.000Z"],
    ["bun", "2026-11-11T21:00:00.000Z"],
  ]);
  assert.equal(preferKitchen(local, remote), "remote");
});
