"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["/", "首页"],
  ["/recipes", "菜谱"],
  ["/planner", "计划"],
  ["/shopping", "采购"],
  ["/pantry", "调料"],
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-5 px-1">
        {items.map(([href, label]) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`mx-1 my-2 flex min-h-12 items-center justify-center rounded-full text-sm ${active ? "bg-blush font-semibold text-clay" : "text-ink/65"}`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
