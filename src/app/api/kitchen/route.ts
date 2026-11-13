import { NextResponse } from "next/server";
import { readKitchenStore, writeKitchenStore } from "@/lib/kitchen/disk";
import { parseKitchen } from "@/lib/kitchen/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(readKitchenStore());
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { revision?: number | null; kitchen?: unknown };
  const incoming = parseKitchen(JSON.stringify(body.kitchen ?? {}));
  const current = readKitchenStore();
  const currentEmpty = current.kitchen.recipes.length === 0 && current.kitchen.meals.length === 0;
  const revisionMatches = typeof body.revision === "number" && body.revision === current.revision;
  if (!currentEmpty && !revisionMatches) {
    return NextResponse.json(current, { status: 409 });
  }
  const saved = writeKitchenStore(incoming, current.revision + 1);
  return NextResponse.json(saved);
}
