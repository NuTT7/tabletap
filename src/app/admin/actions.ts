"use server";

import { eq, not } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { diningTables, menuItems } from "@/db/schema";
import { getSession, hasRole } from "@/lib/auth";
import { parseBahtToSatang } from "@/lib/money";
import { newTableToken } from "@/lib/tokens";
import { menuItemSchema } from "@/lib/validation";

export type ActionState = { error?: string; ok?: boolean };

// Server actions are public HTTP endpoints, so each one checks the session itself.
async function requireAdmin() {
  const session = await getSession();
  if (!hasRole(session, "admin")) throw new Error("Forbidden");
  return session;
}

export async function addMenuItem(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = menuItemSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "กรอกข้อมูลให้ครบ" };
  const price = parseBahtToSatang(parsed.data.price);
  if (price === null || price <= 0) return { error: "ราคาไม่ถูกต้อง เช่น 60 หรือ 59.50" };

  await db.insert(menuItems).values({
    categoryId: parsed.data.categoryId,
    name: parsed.data.name,
    description: parsed.data.description,
    priceSatang: price,
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function toggleAvailability(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  await db.update(menuItems).set({ isAvailable: not(menuItems.isAvailable) }).where(eq(menuItems.id, id));
  revalidatePath("/admin");
}

export async function addTable(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  if (!/^[\p{L}\p{N} -]{1,20}$/u.test(name)) return { error: "ชื่อโต๊ะ 1-20 ตัวอักษร" };
  const inserted = await db
    .insert(diningTables)
    .values({ name, token: newTableToken() })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) return { error: "มีโต๊ะชื่อนี้แล้ว" };
  revalidatePath("/admin");
  return { ok: true };
}

/** Issue a new QR token; the old printed QR code stops working immediately. */
export async function rotateTableToken(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  await db.update(diningTables).set({ token: newTableToken() }).where(eq(diningTables.id, id));
  revalidatePath("/admin");
}
