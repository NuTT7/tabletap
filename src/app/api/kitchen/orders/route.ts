import { errorResponse } from "@/lib/errors";
import { requireStaff } from "@/lib/http";
import { listKitchenOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireStaff("kitchen");
    return Response.json({ orders: await listKitchenOrders() });
  } catch (err) {
    return errorResponse(err);
  }
}
