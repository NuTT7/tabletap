import { AppError } from "./errors";
import { getSession, hasRole, type Session } from "./auth";
import type { StaffRole } from "@/db/schema";

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError(400, "invalid_json", "รูปแบบข้อมูลไม่ถูกต้อง");
  }
}

export async function requireStaff(role: StaffRole): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AppError(401, "unauthenticated", "กรุณาเข้าสู่ระบบ");
  if (!hasRole(session, role)) throw new AppError(403, "forbidden", "ไม่มีสิทธิ์");
  return session;
}

/**
 * Reject cross-site state-changing requests. Cookies are SameSite=Lax, and
 * this Origin check adds a second layer against CSRF on the JSON API.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return; // non-browser clients and same-origin GETs
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host || new URL(origin).host !== host) {
    throw new AppError(403, "bad_origin", "คำขอไม่ถูกต้อง");
  }
}
