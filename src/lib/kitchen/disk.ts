import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseKitchen } from "./storage";
import type { KitchenData } from "./types";
import { emptyKitchen } from "./types";

const filePath = path.join(os.homedir(), ".my-kitchen", "kitchen.json");

export interface KitchenStore {
  revision: number;
  kitchen: KitchenData;
}

export function readKitchenStore(): KitchenStore {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as { revision?: number; kitchen?: unknown };
    if (parsed && typeof parsed === "object" && parsed.kitchen) {
      return { revision: typeof parsed.revision === "number" ? parsed.revision : 1, kitchen: parseKitchen(JSON.stringify(parsed.kitchen)) };
    }
    return { revision: 1, kitchen: parseKitchen(readFileSync(filePath, "utf8")) };
  } catch {
    return { revision: 0, kitchen: emptyKitchen() };
  }
}

export function writeKitchenStore(kitchen: KitchenData, revision: number): KitchenStore {
  const store = { revision, kitchen };
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(store));
  return store;
}
