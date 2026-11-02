import { getSession, hasRole } from "@/lib/auth";
import { KITCHEN_CHANNEL } from "@/lib/events";
import { sseResponse } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!hasRole(session, "kitchen")) return new Response("Unauthorized", { status: 401 });
  return sseResponse([KITCHEN_CHANNEL], request);
}
