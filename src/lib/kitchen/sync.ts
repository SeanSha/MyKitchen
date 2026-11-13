import { preferKitchen } from "./shared";
import { loadKitchen, parseKitchen, saveKitchen } from "./storage";
import type { KitchenData } from "./types";

const PUSH_EVENT = "my-kitchen-push";

if (typeof window !== "undefined") {
  window.addEventListener(PUSH_EVENT, () => queueSharedPush(loadKitchen()));
}

let revision: number | null = null;
let pending: KitchenData | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let pulling = false;

export function queueSharedPush(data: KitchenData) {
  pending = data;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flushSharedPush(), 300);
}

export async function pullSharedKitchen() {
  if (pulling) return;
  pulling = true;
  try {
    const response = await fetch("/api/kitchen", { cache: "no-store" });
    if (!response.ok) return;
    const body = (await response.json()) as { revision?: number; kitchen?: unknown };
    const remote = parseKitchen(JSON.stringify(body.kitchen ?? {}));
    revision = typeof body.revision === "number" ? body.revision : 0;
    const local = loadKitchen();
    const choice = preferKitchen(local, remote);
    if (choice === "remote") saveKitchen(remote, { skipRemote: true });
    else if (choice === "local") queueSharedPush(local);
  } catch {
    return;
  } finally {
    pulling = false;
  }
}

async function flushSharedPush() {
  const data = pending;
  pending = null;
  if (!data) return;
  if (revision === null) {
    await pullSharedKitchen();
    if (revision === null) return;
    if (preferKitchen(data, loadKitchen()) !== "local") return;
  }
  let response: Response;
  try {
    response = await fetch("/api/kitchen", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision, kitchen: data }),
    });
  } catch {
    return;
  }
  const body = (await response.json()) as { revision?: number; kitchen?: unknown };
  if (typeof body.revision === "number") revision = body.revision;
  if (response.status === 409) saveKitchen(parseKitchen(JSON.stringify(body.kitchen ?? {})), { skipRemote: true });
}
