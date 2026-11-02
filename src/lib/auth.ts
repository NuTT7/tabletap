import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { StaffRole } from "@/db/schema";

const COOKIE = "tt_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // one shift

export interface Session {
  staffId: number;
  username: string;
  role: StaffRole;
}

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(s);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ username: session.username, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(session.staffId))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const role = payload.role;
    if (role !== "admin" && role !== "kitchen") return null;
    return { staffId: Number(payload.sub), username: String(payload.username), role };
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, await signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  return verifySession((await cookies()).get(COOKIE)?.value);
}

/** Kitchen staff can work the board; admins can do everything. */
export function hasRole(session: Session | null, needed: StaffRole): session is Session {
  if (!session) return false;
  return session.role === "admin" || session.role === needed;
}
