import assert from "node:assert/strict";
import test from "node:test";
import { analyzedSaveTarget } from "../src/lib/kitchen/storage";

test("the same video URL is stored once", () => {
  const recipes = [{ id: "shrimp", draft: { source_url: "https://www.youtube.com/watch?v=1BZyz-fw_YE" } }];
  assert.equal(analyzedSaveTarget(recipes, "https://www.youtube.com/watch?v=1BZyz-fw_YE"), "shrimp");
  assert.equal(analyzedSaveTarget(recipes, "https://www.youtube.com/watch?v=FjfN732wQlU"), null);
  assert.equal(analyzedSaveTarget(recipes, ""), null);
});
