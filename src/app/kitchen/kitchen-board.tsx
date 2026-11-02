"use client";

import { useCallback, useEffect, useState } from "react";
import { LiveBadge } from "@/components/live-badge";
import { LogoutButton } from "@/components/logout-button";
import type { OrderStatus } from "@/db/schema";
import { nextStatus, statusLabel } from "@/lib/order-status";
import type { OrderView } from "@/lib/types";
import { useEventStream } from "@/lib/use-event-stream";

const columns: { status: OrderStatus; title: string; accent: string }[] = [
  { status: "pending", title: "ออเดอร์ใหม่", accent: "border-t-chili" },
  { status: "preparing", title: "กำลังทำ", accent: "border-t-turmeric" },
  { status: "ready", title: "พร้อมเสิร์ฟ", accent: "border-t-basil" },
];

const actionLabel: Partial<Record<OrderStatus, string>> = {
  pending: "รับออเดอร์",
  preparing: "ทำเสร็จแล้ว",
  ready: "เสิร์ฟแล้ว",
};

function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

export function KitchenBoard({ initialOrders, username }: { initialOrders: OrderView[]; username: string }) {
  const [orders, setOrders] = useState(initialOrders);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/kitchen/orders", { cache: "no-store" });
    if (res.ok) setOrders(((await res.json()) as { orders: OrderView[] }).orders);
  }, []);

  const stream = useEventStream(
    "/api/kitchen/stream",
    (event) => {
      if (event.type === "order.created") {
        setFresh((s) => new Set(s).add(event.orderId));
        setTimeout(() => setFresh((s) => {
          const n = new Set(s);
          n.delete(event.orderId);
          return n;
        }), 1500);
        void refresh();
      } else if (event.type === "order.status") {
        setOrders((prev) =>
          event.status === "served" || event.status === "cancelled"
            ? prev.filter((o) => o.id !== event.orderId)
            : prev.map((o) => (o.id === event.orderId ? { ...o, status: event.status } : o)),
        );
      }
    },
    refresh,
  );

  async function move(order: OrderView, to: OrderStatus) {
    setBusy(order.id);
    setNotice(null);
    const res = await fetch(`/api/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: order.status, to }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = (await res.json()) as { message?: string };
      setNotice(body.message ?? "อัปเดตไม่สำเร็จ");
      await refresh();
    }
    // On success the SSE event updates every screen, including this one.
  }

  return (
    <div className="min-h-dvh bg-board text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">จอครัว</h1>
          <LiveBadge state={stream} dark />
        </div>
        <div className="flex items-center gap-4 text-sm text-white/60">
          <span>{username}</span>
          <LogoutButton className="underline-offset-4 hover:text-white hover:underline" />
        </div>
      </header>

      {notice && (
        <p role="alert" className="mx-5 mt-4 rounded-lg bg-turmeric/20 px-4 py-2 text-sm text-yellow-100">
          {notice}
        </p>
      )}

      <main className="grid gap-4 p-5 md:grid-cols-3">
        {columns.map((col) => {
          const list = orders.filter((o) => o.status === col.status);
          return (
            <section key={col.status} aria-label={col.title}>
              <h2 className="mb-3 flex items-baseline justify-between text-sm font-semibold text-white/70">
                {col.title}
                <span className="font-mono text-white/40">{list.length}</span>
              </h2>
              <ul className="space-y-3">
                {list.map((o) => {
                  const mins = minutesSince(o.createdAt, now);
                  const late = mins >= 15 && o.status !== "ready";
                  const to = nextStatus(o.status);
                  return (
                    <li
                      key={o.id}
                      className={`rounded-lg border-t-4 bg-ticket p-4 text-ink ${col.accent} ${
                        fresh.has(o.id) ? "ticket-new" : ""
                      }`}
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold">{o.tableName}</span>
                        <span className={`font-mono text-sm ${late ? "font-bold text-chili" : "text-muted"}`}>
                          {mins} นาที
                        </span>
                      </div>
                      <div className="dashed my-3" />
                      <ul className="space-y-1">
                        {o.items.map((i) => (
                          <li key={i.id} className="flex gap-3 text-lg leading-snug">
                            <span className="font-mono font-bold">{i.quantity}×</span>
                            <span>
                              {i.name}
                              {i.note && <span className="block text-sm text-chili">{i.note}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {o.note && (
                        <p className="mt-3 rounded bg-turmeric/15 px-2 py-1 text-sm font-medium">⚑ {o.note}</p>
                      )}
                      <div className="mt-4 flex gap-2">
                        {to && (
                          <button
                            disabled={busy === o.id}
                            onClick={() => move(o, to)}
                            className="flex-1 rounded-md bg-ink py-2.5 font-semibold text-paper hover:bg-black disabled:opacity-50"
                          >
                            {actionLabel[o.status]}
                          </button>
                        )}
                        {o.status !== "ready" && (
                          <button
                            disabled={busy === o.id}
                            onClick={() => {
                              if (confirm(`ยกเลิกออเดอร์โต๊ะ ${o.tableName}?`)) void move(o, "cancelled");
                            }}
                            className="rounded-md border border-line px-3 text-sm text-muted hover:border-red-700 hover:text-red-700"
                            aria-label={`ยกเลิกออเดอร์โต๊ะ ${o.tableName}`}
                          >
                            ยกเลิก
                          </button>
                        )}
                      </div>
                      <p className="sr-only">สถานะ: {statusLabel[o.status]}</p>
                    </li>
                  );
                })}
                {list.length === 0 && (
                  <li className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-white/40">
                    ว่าง
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </main>
    </div>
  );
}
