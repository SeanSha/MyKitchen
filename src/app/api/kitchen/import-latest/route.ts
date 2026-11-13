import { NextResponse } from "next/server";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { recipeDraftSchema } from "@/lib/video/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_VIDEO_IMPORT !== "true") {
    return NextResponse.json({ recipes: [], message: "生产环境默认不读取本地分析记录。" }, { status: 403 });
  }
  const root = path.join(process.cwd(), "evals", "runs");
  let runs: string[] = [];
  try {
    runs = readdirSync(root)
      .filter((name) => statSync(path.join(root, name)).isDirectory())
      .sort()
      .reverse();
  } catch {
    return NextResponse.json({ recipes: [] });
  }

  for (const run of runs) {
    const recipes = [];
    const dir = path.join(root, run);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const parsed = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as { ok?: boolean; recipe?: unknown };
        if (!parsed.ok || !parsed.recipe) continue;
        const recipe = recipeDraftSchema.safeParse(parsed.recipe);
        if (recipe.success && (recipe.data.ingredients.length > 0 || recipe.data.cooking_steps.length > 0)) {
          recipes.push(recipe.data);
        }
      } catch {
        continue;
      }
    }
    if (recipes.length) return NextResponse.json({ recipes, run });
  }
  return NextResponse.json({ recipes: [] });
}
