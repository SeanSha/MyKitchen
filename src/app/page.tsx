import { connection } from "next/server";
import { HomeScreen } from "@/components/home-screen";
import { readKitchenStore } from "@/lib/kitchen/disk";

export default async function Page() {
  await connection();
  const { kitchen } = readKitchenStore();
  return <HomeScreen initial={kitchen} />;
}
