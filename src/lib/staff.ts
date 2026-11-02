import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/db";
import { staff } from "@/db/schema";
import type { Session } from "./auth";

// A real hash of a random string, so unknown usernames take as long to check
// as wrong passwords and can't be discovered by timing.
const DUMMY_HASH = "$2b$10$XIFQYNA6ZBFVt0ZQWlXi5OgQAYfG2ID06..VRmMr./UYo7SDA6meO";

export async function authenticate(
  username: string,
  password: string,
  db: Db = defaultDb,
): Promise<Session | null> {
  const [user] = await db.select().from(staff).where(eq(staff.username, username));
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return null;
  return { staffId: user.id, username: user.username, role: user.role };
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}
