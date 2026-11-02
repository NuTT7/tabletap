import { AppError, errorResponse } from "@/lib/errors";
import { assertSameOrigin, requireStaff } from "@/lib/http";
import { closeBill } from "@/lib/orders";

export async function POST(request: Request, ctx: RouteContext<"/api/admin/tables/[id]/close-bill">) {
  try {
    assertSameOrigin(request);
    const session = await requireStaff("admin");
    const tableId = Number((await ctx.params).id);
    if (!Number.isInteger(tableId) || tableId <= 0) throw new AppError(404, "not_found", "ไม่พบโต๊ะ");
    const bill = await closeBill(tableId, session.staffId);
    return Response.json({ bill });
  } catch (err) {
    return errorResponse(err);
  }
}
