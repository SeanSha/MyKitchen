import type { KitchenData } from "./types";

export function preferKitchen(local: KitchenData, remote: KitchenData): "local" | "remote" | "same" {
  const localEmpty = local.recipes.length === 0 && local.meals.length === 0;
  const remoteEmpty = remote.recipes.length === 0 && remote.meals.length === 0;
  if (localEmpty && remoteEmpty) return "same";
  if (localEmpty && !remoteEmpty) return "remote";
  if (!localEmpty && remoteEmpty) return "local";
  const remoteIds = new Set(remote.recipes.map((recipe) => recipe.id));
  const localIds = new Set(local.recipes.map((recipe) => recipe.id));
  const localCoversRemote = [...remoteIds].every((id) => localIds.has(id));
  const remoteCoversLocal = [...localIds].every((id) => remoteIds.has(id));
  const localUpdated = latestUpdate(local);
  const remoteUpdated = latestUpdate(remote);
  if (localCoversRemote && remoteCoversLocal && localUpdated === remoteUpdated && local.meals.length === remote.meals.length) return "same";
  if (localCoversRemote && localUpdated > remoteUpdated) return "local";
  if (remoteCoversLocal && remoteUpdated > localUpdated) return "remote";
  if (remote.recipes.length !== local.recipes.length) return remote.recipes.length > local.recipes.length ? "remote" : "local";
  if (remoteUpdated !== localUpdated) return remoteUpdated > localUpdated ? "remote" : "local";
  return "same";
}

function latestUpdate(data: KitchenData): string {
  return data.recipes.reduce((latest, recipe) => (recipe.updatedAt > latest ? recipe.updatedAt : latest), "");
}
