import assert from "node:assert/strict";
import test from "node:test";
import { buildShoppingList, carryText, omitStockedSeasonings, scaleItem } from "../src/lib/kitchen/shopping";
import type { RecipeIngredient } from "../src/lib/video/types";
import { addDays, inSameMonth, mondayOf, monthGrid, shiftMonth, shoppingScopeDate } from "../src/lib/kitchen/dates";

function item(partial: Partial<RecipeIngredient> & Pick<RecipeIngredient, "name" | "quantity" | "unit">): RecipeIngredient {
  return {
    normalized_name: partial.normalized_name ?? partial.name,
    preparation_notes: null,
    source_type: partial.source_type ?? "explicit",
    evidence_timestamp: null,
    ...partial,
  };
}

test("sums the same unit and keeps incompatible units apart", () => {
  const lines = buildShoppingList([
    {
      title: "菜甲",
      recipeServings: 2,
      plannedServings: 2,
      ingredients: [item({ name: "豆腐", quantity: 200, unit: "克" }), item({ name: "豆腐", quantity: 1, unit: "块" })],
      seasonings: [item({ name: "盐", quantity: 1, unit: "茶匙" })],
    },
    {
      title: "菜乙",
      recipeServings: 2,
      plannedServings: 2,
      ingredients: [item({ name: "豆腐", quantity: 0.3, unit: "千克" })],
      seasonings: [item({ name: "盐", quantity: 1, unit: "汤匙" })],
    },
  ]);
  const tofuMass = lines.find((line) => line.name === "豆腐" && line.quantityLabel.includes("克"));
  const tofuPiece = lines.find((line) => line.name === "豆腐" && line.quantityLabel.includes("块"));
  const salt = lines.find((line) => line.name === "精盐");
  assert.equal(tofuMass?.quantityLabel, "500克");
  assert.equal(tofuPiece?.quantityLabel, "1块");
  assert.equal(salt?.quantityLabel, "4茶匙");
  assert.equal(salt?.kind, "seasoning");
  const kept = omitStockedSeasonings(lines, ["盐"]);
  assert.equal(kept.some((line) => line.name === "精盐"), false);
  assert.equal(kept.some((line) => line.name === "豆腐"), true);
  const usedAs = omitStockedSeasonings(
    [{ ...salt!, name: "盐（腌肉用）" }],
    ["精盐"],
  );
  assert.equal(usedAs.length, 0);
  const collapsed = buildShoppingList([
    {
      title: "甲",
      recipeServings: 1,
      plannedServings: 1,
      ingredients: [item({ name: "面粉", quantity: 200, unit: "克" })],
      seasonings: [
        item({ name: "盐（面粉调味用）", quantity: null, unit: null, source_type: "unknown" }),
        item({ name: "白糖（和面用）", quantity: null, unit: null, source_type: "unknown" }),
      ],
    },
    {
      title: "乙",
      recipeServings: 1,
      plannedServings: 1,
      ingredients: [],
      seasonings: [
        item({ name: "食盐（浸泡葱姜）", quantity: null, unit: null, source_type: "unknown" }),
        item({ name: "细砂糖（腌肉用）", quantity: null, unit: null, source_type: "unknown" }),
        item({ name: "冰糖老抽", quantity: null, unit: null, source_type: "unknown" }),
      ],
    },
  ]);
  assert.equal(collapsed.filter((line) => line.name === "精盐").length, 1);
  assert.equal(collapsed.filter((line) => line.name === "白糖").length, 1);
  assert.equal(collapsed.some((line) => line.name === "冰糖老抽"), true);
  assert.equal(collapsed.some((line) => line.name === "面粉"), true);
  assert.equal(tofuMass?.kind, "ingredient");
});

test("scales servings and never turns an unknown amount into a number", () => {
  const scaled = scaleItem(item({ name: "牛肉", quantity: 100, unit: "克" }), "ingredient", {
    title: "牛肉",
    recipeServings: 2,
    plannedServings: 4,
    ingredients: [],
    seasonings: [],
  });
  assert.equal(scaled.quantity, 200);
  const unknown = scaleItem(item({ name: "葱", quantity: null, unit: null, source_type: "unknown" }), "ingredient", {
    title: "豆腐",
    recipeServings: 2,
    plannedServings: 6,
    ingredients: [],
    seasonings: [],
  });
  assert.equal(unknown.quantity, null);
  const lines = buildShoppingList([
    {
      title: "豆腐",
      recipeServings: 2,
      plannedServings: 6,
      ingredients: [item({ name: "葱", quantity: null, unit: null, source_type: "unknown" })],
      seasonings: [],
    },
  ]);
  assert.equal(lines[0]?.quantityLabel, "用量未知");
});

test("does not scale when the recipe has no serving count", () => {
  const scaled = scaleItem(item({ name: "牛肉", quantity: 100, unit: "克" }), "ingredient", {
    title: "牛肉",
    recipeServings: null,
    plannedServings: 4,
    ingredients: [],
    seasonings: [],
  });
  assert.equal(scaled.quantity, 100);
  assert.match(scaled.scaleNote ?? "", /没有按计划份数换算/);
});

test("month grid starts on monday and covers every day of the month", () => {
  const days = monthGrid("2026-11-11");
  assert.equal(days[0], "2026-10-26");
  assert.equal(days.at(-1), "2026-12-06");
  assert.equal(days.includes("2026-11-01"), true);
  assert.equal(days.includes("2026-11-30"), true);
  assert.equal(inSameMonth("2026-11-11", "2026-11-01"), true);
  assert.equal(inSameMonth("2026-10-26", "2026-11-01"), false);
  assert.equal(shiftMonth("2026-11-01", 1), "2026-12-01");
  assert.equal(shiftMonth("2026-01-15", -1), "2025-12-01");
});

test("the supermarket list keeps a known amount and drops an unknown one", () => {
  assert.equal(carryText({ name: "牛肉", quantityLabel: "320克" }), "牛肉 320克");
  assert.equal(carryText({ name: "白蘑菇", quantityLabel: "用量未知" }), "白蘑菇");
});

test("shopping can focus on today, tomorrow, or the day after", () => {
  assert.equal(shoppingScopeDate("2026-11-11", "today"), "2026-11-11");
  assert.equal(shoppingScopeDate("2026-11-11", "tomorrow"), "2026-11-12");
  assert.equal(shoppingScopeDate("2026-11-11", "dayAfter"), "2026-11-13");
  assert.equal(shoppingScopeDate("2026-11-15", "tomorrow"), "2026-11-16");
  assert.equal(shoppingScopeDate("2026-11-15", "dayAfter"), "2026-11-17");
});

test("monday starts the week and sunday belongs to the previous monday", () => {
  const monday = mondayOf(new Date(2026, 10, 11));
  assert.equal(monday, "2026-11-09");
  assert.equal(addDays(monday, 6), "2026-11-15");
  assert.equal(mondayOf(new Date(2026, 10, 15)), "2026-11-09");
});
