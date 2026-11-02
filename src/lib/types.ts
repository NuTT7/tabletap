import type { OrderStatus } from "@/db/schema";

export interface OrderItemView {
  id: number;
  name: string;
  unitPriceSatang: number;
  quantity: number;
  note: string;
}

export interface OrderView {
  id: string;
  tableId: number;
  tableName?: string;
  status: OrderStatus;
  note: string;
  totalSatang: number;
  createdAt: string;
  items: OrderItemView[];
}

export interface MenuItemView {
  id: number;
  name: string;
  description: string;
  priceSatang: number;
  isAvailable: boolean;
}

export interface CategoryView {
  id: number;
  name: string;
  items: MenuItemView[];
}

/** Convert DB rows (with Date objects) into plain JSON for client components. */
export function toOrderView<
  T extends {
    id: string;
    tableId: number;
    status: OrderStatus;
    note: string;
    totalSatang: number;
    createdAt: Date | string;
    items: OrderItemView[];
    tableName?: string;
  },
>(o: T): OrderView {
  return {
    id: o.id,
    tableId: o.tableId,
    tableName: o.tableName,
    status: o.status,
    note: o.note,
    totalSatang: o.totalSatang,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      name: i.name,
      unitPriceSatang: i.unitPriceSatang,
      quantity: i.quantity,
      note: i.note,
    })),
  };
}
