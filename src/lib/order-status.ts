import type { OrderStatus } from "@/db/schema";

/**
 * The order lifecycle as an explicit state machine. Every status change in the
 * app goes through canTransition(), so the kitchen can't, for example, mark a
 * cancelled order as served.
 */
const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served"],
  served: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return transitions[from].includes(to);
}

export function nextStatus(from: OrderStatus): OrderStatus | null {
  const forward = transitions[from].filter((s) => s !== "cancelled");
  return forward[0] ?? null;
}

export function isOpen(status: OrderStatus): boolean {
  return status !== "served" && status !== "cancelled";
}

export const statusLabel: Record<OrderStatus, string> = {
  pending: "รอรับออเดอร์",
  preparing: "กำลังทำ",
  ready: "พร้อมเสิร์ฟ",
  served: "เสิร์ฟแล้ว",
  cancelled: "ยกเลิก",
};
