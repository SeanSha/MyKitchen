import type { SavedRecipe } from "./types";

export const DISH_TYPES = ["家常菜", "素菜", "凉菜", "汤羹", "主食", "鱼虾", "烘焙"] as const;

export type DishType = (typeof DISH_TYPES)[number];

const BAKE = /烘焙|蛋糕|面包|饼干|披萨|批萨|蛋挞|布丁|甜品|甜点|慕斯|曲奇|司康|泡芙/;
const COLD = /凉菜|沙拉|凉拌|冷盘/;
const SOUP = /汤|羹/;
const STAPLE = /主食|炒饭|拌饭|盖饭|米饭|饺子|包子|肉包|菜包|馒头|馄饨|烧麦|粥|面条|拉面|意面|拌面|炒面|汤面|凉面|热干面|刀削面|手擀面|挂面|乌冬|米粉|河粉|点心|煎饼|馅饼|葱油饼|烙饼|烧饼|饼$/;
const MEAT = /牛|猪|鸡|鸭|羊|肉|排骨|火腿|培根/;

export function classifyDraft(draft: {
  title: string;
  description: string;
  categories: string[];
  ingredients: Array<{ name: string }>;
}): { dishType: DishType } {
  const title = draft.title.trim();
  const categories = draft.categories.join(" ");
  const body = [draft.description, ...draft.ingredients.map((item) => item.name)].join(" ");
  return { dishType: dishTypeFromParts(title, categories, body) };
}

export function classifyRecipe(recipe: SavedRecipe): { dishType: DishType } {
  if (recipe.dishTypeManual && recipe.dishType && (DISH_TYPES as readonly string[]).includes(recipe.dishType)) {
    return { dishType: recipe.dishType };
  }
  return classifyDraft(recipe.draft);
}

function dishTypeFromParts(title: string, categories: string, body: string): DishType {
  const titleForm = formOf(title);
  if (titleForm) return titleForm;
  if (!MEAT.test(title) && !isSeafood(title)) {
    const categoryForm = formOf(categories);
    if (categoryForm) return categoryForm;
  }
  if (isSeafood(title) || isSeafood(body)) return "鱼虾";
  if (!MEAT.test(title) && !MEAT.test(body)) return "素菜";
  return "家常菜";
}

function formOf(text: string): DishType | null {
  if (BAKE.test(text)) return "烘焙";
  if (COLD.test(text)) return "凉菜";
  if (STAPLE.test(text)) return "主食";
  if (SOUP.test(text)) return "汤羹";
  return null;
}

function isSeafood(text: string): boolean {
  const cleaned = text.replace(/鱼香|鱼露/g, "");
  return /虾|蟹|蛤|蚝|鱿|扇贝|海鲜|鱼/.test(cleaned);
}
