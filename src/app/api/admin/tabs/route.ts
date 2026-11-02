import { errorResponse } from "@/lib/errors";
import { requireStaff } from "@/lib/http";
import { listOpenTabs } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireStaff("admin");
    return Response.json({ tabs: await listOpenTabs() });
  } catch (err) {
    return errorResponse(err);
  }
}
