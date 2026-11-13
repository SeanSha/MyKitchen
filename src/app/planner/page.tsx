import { connection } from "next/server";
import { PlannerScreen } from "./planner-screen";
import { readKitchenStore } from "@/lib/kitchen/disk";

export default async function Page() {
  await connection();
  const { kitchen } = readKitchenStore();
  return <PlannerScreen initial={kitchen} />;
}
