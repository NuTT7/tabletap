import { notFound } from "next/navigation";
import { getMenu, getTableByToken, listTableOrders } from "@/lib/orders";
import { toOrderView } from "@/lib/types";
import { CustomerApp } from "./customer-app";

export const dynamic = "force-dynamic";

export default async function TablePage({ params }: PageProps<"/t/[token]">) {
  const { token } = await params;
  const table = await getTableByToken(token);
  if (!table) notFound();

  const [menu, orders] = await Promise.all([getMenu(), listTableOrders(table.id)]);

  return (
    <CustomerApp
      token={token}
      tableName={table.name}
      menu={menu.map((c) => ({
        id: c.id,
        name: c.name,
        items: c.items.map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          priceSatang: i.priceSatang,
          isAvailable: i.isAvailable,
        })),
      }))}
      initialOrders={orders.map(toOrderView)}
    />
  );
}
