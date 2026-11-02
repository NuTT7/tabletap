import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, sqlClient } from "@/db";
import { categories, diningTables, menuItems, staff } from "@/db/schema";
import { getBus, KITCHEN_CHANNEL, tableChannel, type OrderEvent } from "@/lib/events";
import { AppError } from "@/lib/errors";
import { closeBill, getTableByToken, listTableOrders, placeOrder, updateOrderStatus } from "@/lib/orders";

let table: typeof diningTables.$inferSelect;
let steak: typeof menuItems.$inferSelect;
let water: typeof menuItems.$inferSelect;
let soldOut: typeof menuItems.$inferSelect;
let staffId: number;

beforeEach(async () => {
  await db.execute(
    sql`truncate order_items, orders, bills, menu_items, categories, dining_tables, staff restart identity cascade`,
  );
  [table] = await db.insert(diningTables).values({ name: "A1", token: "tok_test_1234567890" }).returning();
  const [cat] = await db.insert(categories).values({ name: "Main" }).returning();
  [steak, water, soldOut] = await db
    .insert(menuItems)
    .values([
      { categoryId: cat.id, name: "Steak", priceSatang: 35000 },
      { categoryId: cat.id, name: "Water", priceSatang: 1500 },
      { categoryId: cat.id, name: "Sold out", priceSatang: 5000, isAvailable: false },
    ])
    .returning();
  [{ id: staffId }] = await db
    .insert(staff)
    .values({ username: "cashier", passwordHash: "x", role: "admin" })
    .returning();
});

afterAll(async () => {
  await sqlClient.end();
});

function input(items: { menuItemId: number; quantity: number }[], key = randomUUID()) {
  return { idempotencyKey: key, note: "", items: items.map((i) => ({ ...i, note: "" })) };
}

async function expectAppError(p: Promise<unknown>, status: number) {
  await expect(p).rejects.toBeInstanceOf(AppError);
  await p.catch((e: AppError) => expect(e.status).toBe(status));
}

describe("placeOrder", () => {
  it("prices the order from the database and snapshots item names and prices", async () => {
    const { order } = await placeOrder(table, input([{ menuItemId: steak.id, quantity: 2 }, { menuItemId: water.id, quantity: 1 }]));
    expect(order.totalSatang).toBe(2 * 35000 + 1500);

    const [withItems] = await listTableOrders(table.id);
    expect(withItems.items.map((i) => [i.name, i.unitPriceSatang, i.quantity])).toEqual([
      ["Steak", 35000, 2],
      ["Water", 1500, 1],
    ]);
  });

  it("returns the first order when the same idempotency key is sent twice", async () => {
    const key = randomUUID();
    const first = await placeOrder(table, input([{ menuItemId: water.id, quantity: 1 }], key));
    const second = await placeOrder(table, input([{ menuItemId: water.id, quantity: 1 }], key));
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.order.id).toBe(first.order.id);
    expect(await listTableOrders(table.id)).toHaveLength(1);
  });

  it("creates only one order when the same request races itself", async () => {
    const key = randomUUID();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => placeOrder(table, input([{ menuItemId: water.id, quantity: 1 }], key))),
    );
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await listTableOrders(table.id)).toHaveLength(1);
  });

  it("rejects unavailable or unknown menu items", async () => {
    await expectAppError(placeOrder(table, input([{ menuItemId: soldOut.id, quantity: 1 }])), 409);
    await expectAppError(placeOrder(table, input([{ menuItemId: 99999, quantity: 1 }])), 409);
    expect(await listTableOrders(table.id)).toHaveLength(0);
  });

  it("publishes order.created to the kitchen and the table channel", async () => {
    const seen: [string, OrderEvent][] = [];
    const bus = getBus();
    const offK = bus.subscribe(KITCHEN_CHANNEL, (e) => seen.push(["kitchen", e]));
    const offT = bus.subscribe(tableChannel(table.id), (e) => seen.push(["table", e]));

    const { order } = await placeOrder(table, input([{ menuItemId: water.id, quantity: 1 }]));
    offK();
    offT();

    expect(seen.map(([c]) => c).sort()).toEqual(["kitchen", "table"]);
    expect(seen[0][1]).toMatchObject({ type: "order.created", orderId: order.id, tableName: "A1" });
  });
});

describe("updateOrderStatus", () => {
  it("lets exactly one of two simultaneous updates win", async () => {
    const { order } = await placeOrder(table, input([{ menuItemId: steak.id, quantity: 1 }]));
    const results = await Promise.allSettled([
      updateOrderStatus(order.id, "pending", "preparing"),
      updateOrderStatus(order.id, "pending", "preparing"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((rejected.reason as AppError).status).toBe(409);
  });

  it("rejects transitions the state machine does not allow", async () => {
    const { order } = await placeOrder(table, input([{ menuItemId: steak.id, quantity: 1 }]));
    await expectAppError(updateOrderStatus(order.id, "pending", "served"), 422);
  });

  it("rejects a stale `from` status", async () => {
    const { order } = await placeOrder(table, input([{ menuItemId: steak.id, quantity: 1 }]));
    await updateOrderStatus(order.id, "pending", "preparing");
    await expectAppError(updateOrderStatus(order.id, "pending", "cancelled"), 409);
  });
});

describe("closeBill", () => {
  async function serve(id: string) {
    await updateOrderStatus(id, "pending", "preparing");
    await updateOrderStatus(id, "preparing", "ready");
    await updateOrderStatus(id, "ready", "served");
  }

  it("refuses while food is still being prepared", async () => {
    await placeOrder(table, input([{ menuItemId: steak.id, quantity: 1 }]));
    await expectAppError(closeBill(table.id, staffId), 409);
  });

  it("totals served orders, skips cancelled ones, and clears the table", async () => {
    const a = await placeOrder(table, input([{ menuItemId: steak.id, quantity: 1 }]));
    const b = await placeOrder(table, input([{ menuItemId: water.id, quantity: 2 }]));
    const c = await placeOrder(table, input([{ menuItemId: steak.id, quantity: 3 }]));
    await serve(a.order.id);
    await serve(b.order.id);
    await updateOrderStatus(c.order.id, "pending", "cancelled");

    const bill = await closeBill(table.id, staffId);
    expect(bill.totalSatang).toBe(35000 + 3000);
    expect(await listTableOrders(table.id)).toHaveLength(0);
  });

  it("creates one bill when two cashiers close the same table at once", async () => {
    const a = await placeOrder(table, input([{ menuItemId: water.id, quantity: 1 }]));
    await serve(a.order.id);
    const results = await Promise.allSettled([closeBill(table.id, staffId), closeBill(table.id, staffId)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [{ count }] = await db.execute<{ count: number }>(sql`select count(*)::int as count from bills`);
    expect(count).toBe(1);
  });
});

describe("getTableByToken", () => {
  it("rejects malformed tokens without querying and inactive tables", async () => {
    expect(await getTableByToken("x")).toBeNull();
    expect(await getTableByToken("tok_test_1234567890")).not.toBeNull();
    await db.update(diningTables).set({ isActive: false });
    expect(await getTableByToken("tok_test_1234567890")).toBeNull();
  });
});
