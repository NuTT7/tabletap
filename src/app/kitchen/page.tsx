import { redirect } from "next/navigation";
import { getSession, hasRole } from "@/lib/auth";
import { listKitchenOrders } from "@/lib/orders";
import { toOrderView } from "@/lib/types";
import { KitchenBoard } from "./kitchen-board";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const session = await getSession();
  if (!hasRole(session, "kitchen")) redirect("/login?next=/kitchen");
  const orders = await listKitchenOrders();
  return <KitchenBoard initialOrders={orders.map(toOrderView)} username={session.username} />;
}
