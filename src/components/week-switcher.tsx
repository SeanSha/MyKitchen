"use client";

import { addDays, shortDate } from "@/lib/kitchen/dates";
import { setWeekStart } from "@/lib/kitchen/storage";

export function WeekSwitcher({ week }: { week: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button type="button" className="min-h-12 rounded-full border border-line bg-white px-4" onClick={() => setWeekStart(addDays(week, -7))}>
        上一周
      </button>
      <p className="text-center text-sm font-medium">
        {shortDate(week)} – {shortDate(addDays(week, 6))}
      </p>
      <button type="button" className="min-h-12 rounded-full border border-line bg-white px-4" onClick={() => setWeekStart(addDays(week, 7))}>
        下一周
      </button>
    </div>
  );
}
