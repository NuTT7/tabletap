import { and, asc, eq, inArray, isNull, ne, notInArray, sql } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/db";
import {
  bills,
  categories,
  diningTables,
  menuItems,
  orderItems,
  orders,
  type OrderStatus,
} from "@/db/schema";
import { AppError } from "./errors";
import { publishOrderEvent } from "./events";
import { sumLines } from "./money";
import { canTransition } from "./order-status";
import type { PlaceOrderInput } from "./validation";

export type Table = typeof diningTables.$inferSelect;

export async function getTableByToken(token: string, db: Db = defaultDb): Promise<Table | null> {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return null;
  const [table] = await db
    .select()
    .from(diningTables)
    .where(and(eq(diningTables.token, token), eq(diningTables.isActive, true)));
  return table ?? null;
}

export async function getMenu(db: Db = defaultDb) {
  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id));
  const items = await db.select().from(menuItems).orderBy(asc(menuItems.id));
  return cats.map((c) => ({ ...c, items: items.filter((i) => i.categoryId === c.id) }));
}

/**
 * Place an order for a table.
 *
 * - Prices come from the database, never from the browser, so a customer
 *   can't edit the request to pay ฿1 for a steak.
 * - The (table, idempotencyKey) unique index makes retries safe: sending the
 *   same request twice returns the first order instead of creating another.
 */
export async function placeOrder(table: Table, input: PlaceOrderInput, db: Db = defaultDb) {
  const result = await db.transaction(async (tx) => {
    const ids = [...new Set(input.items.map((i) => i.menuItemId))];
    const found = await tx
      .select()
      .from(menuItems)
      .where(and(inArray(menuItems.id, ids), eq(menuItems.isAvailable, true)));

    if (found.length !== ids.length) {
      throw new AppError(409, "item_unavailable", "บางเมนูหมดแล้ว กรุณารีเฟรชเมนู");
    }

    const byId = new Map(found.map((m) => [m.id, m]));
    const lines = input.items.map((i) => {
      const m = byId.get(i.menuItemId)!;
      return {
        menuItemId: m.id,
        name: m.name,
        unitPriceSatang: m.priceSatang,
        quantity: i.quantity,
        note: i.note,
      };
    });

    const [created] = await tx
      .insert(orders)
      .values({
        tableId: table.id,
        note: input.note,
        totalSatang: sumLines(lines),
        idempotencyKey: input.idempotencyKey,
      })
      .onConflictDoNothing({ target: [orders.tableId, orders.idempotencyKey] })
      .returning();

    if (!created) {
      const [existing] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.tableId, table.id), eq(orders.idempotencyKey, input.idempotencyKey)));
      return { order: existing, created: false };
    }

    await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: created.id })));
    return { order: created, created: true };
  });

  // Publish only after the transaction commits, so screens never receive an
  // event for an order they can't load yet.
  if (result.created) {
    await publishOrderEvent({
      type: "order.created",
      orderId: result.order.id,
      tableId: table.id,
      tableName: table.name,
    });
  }
  return result;
}

/**
 * Move an order to a new status.
 *
 * The UPDATE only matches if the order is still in the status the cook saw
 * (`from`). If two cooks press "Ready" on the same ticket at the same time,
 * exactly one update succeeds and the other gets a 409 instead of a silent
 * double-change. This is optimistic concurrency control.
 */
export async function updateOrderStatus(
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
  db: Db = defaultDb,
) {
  if (!canTransition(from, to)) {
    throw new AppError(422, "invalid_transition", `เปลี่ยนสถานะจาก ${from} เป็น ${to} ไม่ได้`);
  }

  const [updated] = await db
    .update(orders)
    .set({ status: to, updatedAt: sql`now()` })
    .where(and(eq(orders.id, orderId), eq(orders.status, from), isNull(orders.billId)))
    .returning();

  if (!updated) {
    throw new AppError(409, "status_conflict", "ออเดอร์นี้ถูกอัปเดตไปแล้ว กรุณารีเฟรช");
  }

  await publishOrderEvent({ type: "order.status", orderId, tableId: updated.tableId, status: to });
  return updated;
}

async function withItems<T extends { id: string }>(db: Db, rows: T[]) {
  if (rows.length === 0) return [];
  const items = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((r) => r.id)))
    .orderBy(asc(orderItems.id));
  return rows.map((r) => ({ ...r, items: items.filter((i) => i.orderId === r.id) }));
}

/** Orders the kitchen still has to deal with, oldest first. */
export async function listKitchenOrders(db: Db = defaultDb) {
  const rows = await db
    .select({
      id: orders.id,
      tableId: orders.tableId,
      tableName: diningTables.name,
      status: orders.status,
      note: orders.note,
      totalSatang: orders.totalSatang,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(diningTables, eq(orders.tableId, diningTables.id))
    .where(and(isNull(orders.billId), notInArray(orders.status, ["served", "cancelled"])))
    .orderBy(asc(orders.createdAt));
  return withItems(db, rows);
}

/** Everything a table has ordered since its last closed bill. */
export async function listTableOrders(tableId: number, db: Db = defaultDb) {
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.tableId, tableId), isNull(orders.billId)))
    .orderBy(asc(orders.createdAt));
  return withItems(db, rows);
}

/** Open (unbilled) totals per table, for the cashier view. */
export async function listOpenTabs(db: Db = defaultDb) {
  return db
    .select({
      tableId: diningTables.id,
      tableName: diningTables.name,
      orderCount: sql<number>`count(${orders.id})::int`,
      totalSatang: sql<number>`coalesce(sum(${orders.totalSatang}) filter (where ${orders.status} <> 'cancelled'), 0)::int`,
      unfinished: sql<number>`count(*) filter (where ${orders.status} in ('pending','preparing','ready'))::int`,
    })
    .from(diningTables)
    .innerJoin(orders, and(eq(orders.tableId, diningTables.id), isNull(orders.billId)))
    .groupBy(diningTables.id, diningTables.name)
    .orderBy(asc(diningTables.name));
}

/**
 * Close the bill for a table: total every non-cancelled unbilled order and
 * attach them to a new bill row, all in one transaction.
 *
 * The table row is locked with SELECT ... FOR UPDATE so two cashiers closing
 * the same table at once can't create two bills for the same orders.
 */
export async function closeBill(tableId: number, staffId: number, db: Db = defaultDb) {
  const bill = await db.transaction(async (tx) => {
    const locked = await tx.execute(
      sql`select id from ${diningTables} where ${diningTables.id} = ${tableId} for update`,
    );
    if (locked.length === 0) throw new AppError(404, "table_not_found", "ไม่พบโต๊ะนี้");

    const open = await tx
      .select({ id: orders.id, status: orders.status, totalSatang: orders.totalSatang })
      .from(orders)
      .where(and(eq(orders.tableId, tableId), isNull(orders.billId)));

    if (open.length === 0) throw new AppError(409, "nothing_to_bill", "โต๊ะนี้ไม่มีรายการค้างชำระ");
    if (open.some((o) => o.status === "pending" || o.status === "preparing" || o.status === "ready")) {
      throw new AppError(409, "orders_unfinished", "ยังมีออเดอร์ที่ยังไม่เสิร์ฟ");
    }

    const total = open.filter((o) => o.status !== "cancelled").reduce((a, o) => a + o.totalSatang, 0);
    const [created] = await tx
      .insert(bills)
      .values({ tableId, totalSatang: total, closedBy: staffId })
      .returning();

    await tx
      .update(orders)
      .set({ billId: created.id })
      .where(and(eq(orders.tableId, tableId), isNull(orders.billId)));

    return created;
  });

  await publishOrderEvent({ type: "bill.closed", tableId, billId: bill.id });
  return bill;
}

export async function getOrderTableId(orderId: string, db: Db = defaultDb): Promise<number | null> {
  const [row] = await db
    .select({ tableId: orders.tableId })
    .from(orders)
    .where(and(eq(orders.id, orderId), ne(orders.status, "cancelled")));
  return row?.tableId ?? null;
}
