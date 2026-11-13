"use client";

import { useEffect, useSyncExternalStore } from "react";
import { pullSharedKitchen } from "@/lib/kitchen/sync";
import { emitKitchenChange, getServerKitchen, hasStoredKitchen, loadKitchen, subscribeKitchen } from "@/lib/kitchen/storage";
import type { KitchenData } from "@/lib/kitchen/types";

let useStoredKitchen = false;

function clientKitchen(provided: KitchenData): KitchenData {
  if (!useStoredKitchen || !hasStoredKitchen()) return provided;
  const stored = loadKitchen();
  const storedEmpty = stored.recipes.length + stored.meals.length === 0;
  const providedHasFood = provided.recipes.length + provided.meals.length > 0;
  if (storedEmpty && providedHasFood) return provided;
  return stored;
}

export function useKitchen(initial?: KitchenData) {
  const provided = initial ?? getServerKitchen();
  const data = useSyncExternalStore(
    subscribeKitchen,
    () => clientKitchen(provided),
    () => provided,
  );
  useEffect(() => {
    useStoredKitchen = true;
    emitKitchenChange();
    void pullSharedKitchen();
    const refresh = () => {
      if (document.visibilityState === "visible") void pullSharedKitchen();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);
  return { data };
}
