import assert from "node:assert/strict";
import test from "node:test";
import { classifyDraft } from "../src/lib/kitchen/taxonomy";

test("home dishes follow the roles used by Chinese recipe apps", () => {
  assert.equal(
    classifyDraft({
      title: "虾头烧豆腐",
      description: "汤汁收浓",
      categories: ["家常菜"],
      ingredients: [{ name: "虾头" }, { name: "豆腐" }, { name: "高汤" }],
    }).dishType,
    "鱼虾",
  );
  assert.equal(
    classifyDraft({ title: "蒜香蘑菇烧牛肉", description: "", categories: [], ingredients: [{ name: "牛肉" }] }).dishType,
    "家常菜",
  );
  assert.equal(classifyDraft({ title: "番茄意面", description: "", categories: [], ingredients: [{ name: "意面" }] }).dishType, "主食");
  assert.equal(classifyDraft({ title: "拍黄瓜", description: "", categories: ["凉菜"], ingredients: [{ name: "黄瓜" }] }).dishType, "凉菜");
  assert.equal(
    classifyDraft({
      title: "烤脆皮鸡腿",
      description: "表面酥脆",
      categories: ["主食"],
      ingredients: [{ name: "鸡腿" }, { name: "面粉" }],
    }).dishType,
    "家常菜",
  );
  assert.equal(
    classifyDraft({
      title: "上海炸猪排",
      description: "",
      categories: ["烘焙"],
      ingredients: [{ name: "猪排" }, { name: "面包糠" }],
    }).dishType,
    "家常菜",
  );
  assert.equal(
    classifyDraft({ title: "鲜肉包", description: "", categories: [], ingredients: [{ name: "面粉" }, { name: "猪肉" }] }).dishType,
    "主食",
  );
  assert.equal(
    classifyDraft({ title: "鱼香茄子", description: "", categories: [], ingredients: [{ name: "茄子" }, { name: "猪肉" }] }).dishType,
    "家常菜",
  );
});
