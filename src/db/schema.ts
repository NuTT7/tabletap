import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const staffRole = pgEnum("staff_role", ["admin", "kitchen"]);

export const orderStatus = pgEnum("order_status", [
  "pending",
  "preparing",
  "ready",
  "served",
  "cancelled",
]);

export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: staffRole("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const diningTables = pgTable("dining_tables", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  // Random, unguessable token printed in the table's QR code. Rotating it
  // invalidates old printed codes.
  token: text("token").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const menuItems = pgTable(
  "menu_items",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    // Money is stored as integer satang (1 baht = 100 satang).
    priceSatang: integer("price_satang").notNull(),
    isAvailable: boolean("is_available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("menu_price_positive", sql`${t.priceSatang} > 0`)],
);

export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id")
    .notNull()
    .references(() => diningTables.id),
  totalSatang: integer("total_satang").notNull(),
  closedBy: integer("closed_by").references(() => staff.id),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableId: integer("table_id")
      .notNull()
      .references(() => diningTables.id),
    status: orderStatus("status").notNull().default("pending"),
    note: text("note").notNull().default(""),
    totalSatang: integer("total_satang").notNull(),
    // Null while the table is still eating; set when the bill is closed.
    billId: integer("bill_id").references(() => bills.id),
    // Client-generated key so a double-tapped "Place order" button or a retried
    // request never creates two orders.
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_table_idem_key").on(t.tableId, t.idempotencyKey),
    index("orders_open_by_table").on(t.tableId).where(sql`${t.billId} is null`),
    index("orders_status").on(t.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItems.id),
    // Snapshot of name and price at order time, so later menu edits don't
    // change what the customer was charged.
    name: text("name").notNull(),
    unitPriceSatang: integer("unit_price_satang").notNull(),
    quantity: integer("quantity").notNull(),
    note: text("note").notNull().default(""),
  },
  (t) => [check("order_item_qty_range", sql`${t.quantity} between 1 and 20`)],
);

export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type StaffRole = (typeof staffRole.enumValues)[number];
