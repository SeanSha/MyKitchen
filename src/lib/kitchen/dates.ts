export function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function mondayOf(date: Date): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = copy.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  copy.setDate(copy.getDate() + diff);
  return formatISODate(copy);
}

export function addDays(isoDate: string, days: number): string {
  const date = parseISODate(isoDate);
  date.setDate(date.getDate() + days);
  return formatISODate(date);
}

export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export type ShoppingScope = "today" | "tomorrow" | "dayAfter" | "week";

export function shoppingScopeDate(today: string, scope: Exclude<ShoppingScope, "week">): string {
  if (scope === "today") return today;
  if (scope === "tomorrow") return addDays(today, 1);
  return addDays(today, 2);
}

const WEEKDAY = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function weekdayLabel(isoDate: string): string {
  const day = parseISODate(isoDate).getDay();
  return WEEKDAY[day === 0 ? 6 : day - 1];
}

export function shortDate(isoDate: string): string {
  const date = parseISODate(isoDate);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function monthStart(isoDate: string): string {
  const date = parseISODate(isoDate);
  return formatISODate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function shiftMonth(month: string, delta: number): string {
  const date = parseISODate(monthStart(month));
  return formatISODate(new Date(date.getFullYear(), date.getMonth() + delta, 1));
}

export function monthTitle(month: string): string {
  const date = parseISODate(monthStart(month));
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function monthGrid(month: string): string[] {
  const first = parseISODate(monthStart(month));
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const start = mondayOf(first);
  const end = addDays(mondayOf(last), 6);
  const days: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) days.push(cursor);
  return days;
}

export function inSameMonth(isoDate: string, month: string): boolean {
  const day = parseISODate(isoDate);
  const start = parseISODate(monthStart(month));
  return day.getFullYear() === start.getFullYear() && day.getMonth() === start.getMonth();
}
