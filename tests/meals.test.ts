import assert from "node:assert/strict";
import test from "node:test";
import { alreadyOnDay } from "../src/lib/kitchen/storage";

test("the same dish can be planned once on a day", () => {
  const meals = [{ date: "2026-11-11", recipeId: "shrimp" }];
  assert.equal(alreadyOnDay(meals, "2026-11-11", "shrimp"), true);
  assert.equal(alreadyOnDay(meals, "2026-11-11", "beef"), false);
  assert.equal(alreadyOnDay(meals, "2026-11-12", "shrimp"), false);
});
