"use client";

import { useCallback, useMemo, useState } from "react";
import { LiveBadge } from "@/components/live-badge";
import { formatBaht } from "@/lib/money";
import { statusLabel } from "@/lib/order-status";
import type { CategoryView, MenuItemView, OrderView } from "@/lib/types";
import { useEventStream } from "@/lib/use-event-stream";

interface CartLine {
  item: MenuItemView;
  quantity: number;
}

const statusTone: Record<OrderView["status"], string> = {
  pending: "bg-ink/5 text-ink",
  preparing: "bg-turmeric/15 text-[#854d0e]",
  ready: "bg-basil text-white",
  served: "bg-ink/5 text-muted",
  cancelled: "bg-red-100 text-red-800 line-through",
};

export function CustomerApp({
  token,
  tableName,
  menu,
  initialOrders,
}: {
  token: string;
  tableName: string;
  menu: CategoryView[];
  initialOrders: OrderView[];
}) {
  const [cart, setCart] = useState<Map<number, CartLine>>(new Map());
  const [orders, setOrders] = useState(initialOrders);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"menu" | "orders">("menu");
  // One key per cart: a double tap or network retry reuses it, so the server
  // creates the order only once.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/tables/${token}/orders`, { cache: "no-store" });
    if (res.ok) setOrders(((await res.json()) as { orders: OrderView[] }).orders);
  }, [token]);

  const stream = useEventStream(
    `/api/tables/${token}/stream`,
    (event) => {
      if (event.type === "order.status") {
        setOrders((prev) => prev.map((o) => (o.id === event.orderId ? { ...o, status: event.status } : o)));
      } else if (event.type === "bill.closed") {
        setOrders([]);
      } else {
        void refresh();
      }
    },
    refresh,
  );

  const lines = [...cart.values()];
  const cartCount = lines.reduce((a, l) => a + l.quantity, 0);
  const cartTotal = lines.reduce((a, l) => a + l.item.priceSatang * l.quantity, 0);
  const tabTotal = useMemo(
    () => orders.filter((o) => o.status !== "cancelled").reduce((a, o) => a + o.totalSatang, 0),
    [orders],
  );

  function change(item: MenuItemView, delta: number) {
    setCart((prev) => {
      const next = new Map(prev);
      const qty = (next.get(item.id)?.quantity ?? 0) + delta;
      if (qty <= 0) next.delete(item.id);
      else next.set(item.id, { item, quantity: Math.min(qty, 20) });
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tables/${token}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          note,
          items: lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity })),
        }),
      });
      const body = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(body.message ?? "สั่งไม่สำเร็จ");
        return;
      }
      setCart(new Map());
      setNote("");
      setIdempotencyKey(crypto.randomUUID());
      await refresh();
      setView("orders");
    } catch {
      setError("เชื่อมต่อไม่ได้ กดสั่งอีกครั้งได้เลย ระบบจะไม่สั่งซ้ำ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-xl pb-40">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 px-4 pt-4 pb-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs tracking-widest text-chili uppercase">TableTap</p>
            <h1 className="text-2xl font-bold">โต๊ะ {tableName}</h1>
          </div>
          <LiveBadge state={stream} />
        </div>
        <nav className="mt-3 grid grid-cols-2 rounded-lg bg-ink/5 p-1 text-sm font-medium" aria-label="สลับหน้า">
          {(["menu", "orders"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-md py-2 transition ${view === v ? "bg-ticket shadow-sm" : "text-muted"}`}
            >
              {v === "menu" ? "เมนู" : `ออเดอร์ของโต๊ะ (${orders.length})`}
            </button>
          ))}
        </nav>
      </header>

      {view === "menu" ? (
        <main className="px-4">
          {menu.map((cat) => (
            <section key={cat.id} className="mt-6">
              <h2 className="text-sm font-semibold tracking-wide text-muted">{cat.name}</h2>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-ticket">
                {cat.items.map((item) => {
                  const qty = cart.get(item.id)?.quantity ?? 0;
                  return (
                    <li key={item.id} className="flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium ${item.isAvailable ? "" : "text-muted line-through"}`}>
                          {item.name}
                        </p>
                        {item.description && <p className="text-sm text-muted">{item.description}</p>}
                        <p className="mt-1 font-mono text-sm">
                          {item.isAvailable ? formatBaht(item.priceSatang) : "หมด"}
                        </p>
                      </div>
                      {item.isAvailable && (
                        <div className="flex items-center gap-1">
                          {qty > 0 && (
                            <>
                              <button
                                onClick={() => change(item, -1)}
                                className="size-9 rounded-full border border-line text-lg"
                                aria-label={`ลด ${item.name}`}
                              >
                                −
                              </button>
                              <span className="w-6 text-center font-mono" aria-live="polite">
                                {qty}
                              </span>
                            </>
                          )}
                          <button
                            onClick={() => change(item, 1)}
                            className="size-9 rounded-full bg-chili text-lg text-white hover:bg-chili-dark"
                            aria-label={`เพิ่ม ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </main>
      ) : (
        <main className="px-4">
          {orders.length === 0 ? (
            <p className="mt-16 text-center text-muted">ยังไม่มีออเดอร์ เลือกเมนูแล้วกดสั่งได้เลย</p>
          ) : (
            <>
              <ul className="mt-6 space-y-3">
                {orders.map((o, idx) => (
                  <li key={o.id} className="rounded-xl border border-line bg-ticket p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted">
                        รอบที่ {idx + 1} ·{" "}
                        {new Date(o.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone[o.status]}`}>
                        {statusLabel[o.status]}
                      </span>
                    </div>
                    <ul className="mt-2 text-sm">
                      {o.items.map((i) => (
                        <li key={i.id} className="flex justify-between py-0.5">
                          <span>
                            {i.quantity} × {i.name}
                          </span>
                          <span className="font-mono">{formatBaht(i.unitPriceSatang * i.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                    {o.note && <p className="mt-2 text-sm text-muted">หมายเหตุ: {o.note}</p>}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-between rounded-xl bg-ink px-4 py-3 text-paper">
                <span>ยอดรวมโต๊ะ</span>
                <span className="font-mono font-semibold">{formatBaht(tabTotal)}</span>
              </div>
              <p className="mt-2 text-center text-xs text-muted">เรียกพนักงานเพื่อชำระเงิน</p>
            </>
          )}
        </main>
      )}

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto max-w-xl px-4 py-3">
            <label className="sr-only" htmlFor="note">
              หมายเหตุถึงครัว
            </label>
            <input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="หมายเหตุถึงครัว เช่น ไม่ใส่ผัก (ไม่บังคับ)"
              className="w-full rounded-lg border border-line bg-ticket px-3 py-2 text-sm outline-none focus:border-ink"
            />
            {error && (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              onClick={submit}
              disabled={submitting}
              className="mt-2 flex w-full items-center justify-between rounded-xl bg-chili px-5 py-3.5 font-semibold text-white transition hover:bg-chili-dark disabled:opacity-60"
            >
              <span>{submitting ? "กำลังส่ง..." : `สั่ง ${cartCount} รายการ`}</span>
              <span className="font-mono">{formatBaht(cartTotal)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
