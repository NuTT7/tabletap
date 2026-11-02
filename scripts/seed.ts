import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const url = process.env.DATABASE_URL ?? "postgres://app:app@localhost:5432/tabletap";
const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

const existing = await db.select().from(schema.staff).limit(1);
if (existing.length > 0) {
  console.log("Database already seeded, skipping");
  await client.end();
  process.exit(0);
}

await db.insert(schema.staff).values([
  { username: "admin", passwordHash: await bcrypt.hash("admin1234", 10), role: "admin" },
  { username: "kitchen", passwordHash: await bcrypt.hash("kitchen1234", 10), role: "kitchen" },
]);

await db.insert(schema.diningTables).values(
  ["A1", "A2", "A3", "B1", "B2", "B3"].map((name) => ({
    name,
    token: randomBytes(16).toString("base64url"),
  })),
);

const cats = await db
  .insert(schema.categories)
  .values([
    { name: "อาหารจานเดียว", sortOrder: 1 },
    { name: "กับข้าว", sortOrder: 2 },
    { name: "เครื่องดื่ม", sortOrder: 3 },
  ])
  .returning();

const [single, sides, drinks] = cats;
await db.insert(schema.menuItems).values([
  { categoryId: single.id, name: "ข้าวกะเพราหมูสับไข่ดาว", description: "เผ็ดกลาง ปรับได้", priceSatang: 6000 },
  { categoryId: single.id, name: "ข้าวผัดกุ้ง", description: "", priceSatang: 7000 },
  { categoryId: single.id, name: "ผัดไทยกุ้งสด", description: "เส้นจันท์", priceSatang: 8000 },
  { categoryId: single.id, name: "ข้าวมันไก่", description: "พร้อมน้ำซุป", priceSatang: 5500 },
  { categoryId: sides.id, name: "ต้มยำกุ้งน้ำข้น", description: "", priceSatang: 15000 },
  { categoryId: sides.id, name: "ไข่เจียวหมูสับ", description: "", priceSatang: 6000 },
  { categoryId: sides.id, name: "ผัดผักบุ้งไฟแดง", description: "", priceSatang: 5000 },
  { categoryId: drinks.id, name: "ชาไทยเย็น", description: "", priceSatang: 4000 },
  { categoryId: drinks.id, name: "น้ำมะนาวโซดา", description: "", priceSatang: 3500 },
  { categoryId: drinks.id, name: "น้ำเปล่า", description: "", priceSatang: 1500 },
]);

console.log("Seeded: staff admin/admin1234 and kitchen/kitchen1234, 6 tables, 10 menu items");
await client.end();
