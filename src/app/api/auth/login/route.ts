import { setSessionCookie } from "@/lib/auth";
import { AppError, errorResponse } from "@/lib/errors";
import { assertSameOrigin, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { authenticate } from "@/lib/staff";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = loginSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "invalid_input", "กรอกชื่อผู้ใช้และรหัสผ่าน");

    // Limit per username so password guessing is slow even across many IPs.
    const limit = rateLimit(`login:${parsed.data.username.toLowerCase()}`, 5, 15 * 60_000);
    if (!limit.ok) throw new AppError(429, "rate_limited", "ลองเข้าสู่ระบบบ่อยเกินไป รอ 15 นาที");

    const session = await authenticate(parsed.data.username, parsed.data.password);
    if (!session) throw new AppError(401, "invalid_credentials", "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");

    await setSessionCookie(session);
    return Response.json({ role: session.role });
  } catch (err) {
    return errorResponse(err);
  }
}
