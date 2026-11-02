import { AppError, errorResponse } from "@/lib/errors";
import { assertSameOrigin, readJson } from "@/lib/http";
import { getTableByToken, listTableOrders, placeOrder } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";
import { placeOrderSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/tables/[token]/orders">) {
  try {
    const { token } = await ctx.params;
    const table = await getTableByToken(token);
    if (!table) throw new AppError(404, "table_not_found", "ไม่พบโต๊ะนี้");
    return Response.json({ orders: await listTableOrders(table.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request, ctx: RouteContext<"/api/tables/[token]/orders">) {
  try {
    assertSameOrigin(request);
    const { token } = await ctx.params;
    const table = await getTableByToken(token);
    if (!table) throw new AppError(404, "table_not_found", "ไม่พบโต๊ะนี้");

    const limit = rateLimit(`order:${table.id}`, 10, 60_000);
    if (!limit.ok) {
      throw new AppError(429, "rate_limited", "สั่งถี่เกินไป รอสักครู่แล้วลองใหม่");
    }

    const parsed = placeOrderSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new AppError(400, "invalid_input", parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
    }

    const { order, created } = await placeOrder(table, parsed.data);
    return Response.json({ order }, { status: created ? 201 : 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
