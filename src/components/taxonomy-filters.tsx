"use client";

import { chipTone } from "@/components/recipe-bits";
import { DISH_TYPES, type DishType } from "@/lib/kitchen/taxonomy";

export function TaxonomyFilters({
  dishType,
  onDishType,
}: {
  dishType: "全部" | DishType;
  onDishType: (value: "全部" | DishType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(["全部", ...DISH_TYPES] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onDishType(item)}
          className={`shrink-0 rounded-full px-3 py-2 text-sm ${dishType === item ? "bg-clay text-white" : chipTone(item === "全部" ? "家常" : item)}`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
