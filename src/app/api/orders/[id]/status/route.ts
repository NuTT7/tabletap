import { AppError, errorResponse } from "@/lib/errors";
import { assertSameOrigin, readJson, requireStaff } from "@/lib/http";
import { updateOrderStatus } from "@/lib/orders";
import { updateStatusSchema } from "@/lib/validation";

export async function PATCH(request: Request, ctx: RouteContext<"/api/orders/[id]/status">) {
  try {
    assertSameOrigin(request);
    await requireStaff("kitchen");
    const { id } = await ctx.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError(404, "not_found", "ไม่พบออเดอร์");

    const parsed = updateStatusSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(400, "invalid_input", "ข้อมูลไม่ถูกต้อง");

    const order = await updateOrderStatus(id, parsed.data.from, parsed.data.to);
    return Response.json({ order });
  } catch (err) {
    return errorResponse(err);
  }
}
