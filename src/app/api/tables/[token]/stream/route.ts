import { tableChannel } from "@/lib/events";
import { getTableByToken } from "@/lib/orders";
import { sseResponse } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, ctx: RouteContext<"/api/tables/[token]/stream">) {
  const { token } = await ctx.params;
  const table = await getTableByToken(token);
  if (!table) return new Response("Not found", { status: 404 });
  return sseResponse([tableChannel(table.id)], request);
}
