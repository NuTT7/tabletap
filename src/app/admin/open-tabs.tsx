"use client";

import { useCallback, useState } from "react";
import { LiveBadge } from "@/components/live-badge";
import { formatBaht } from "@/lib/money";
import { useEventStream } from "@/lib/use-event-stream";

interface Tab {
  tableId: number;
  tableName: string;
  orderCount: number;
  totalSatang: number;
  unfinished: number;
}

export function OpenTabs({ initialTabs }: { initialTabs: Tab[] }) {
  const [tabs, setTabs] = useState(initialTabs);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/tabs", { cache: "no-store" });
    if (res.ok) setTabs(((await res.json()) as { tabs: Tab[] }).tabs);
  }, []);

  // Admins can read the kitchen stream; any order change may change a total.
  const stream = useEventStream("/api/kitchen/stream", () => void refresh(), refresh);

  async function close(tab: Tab) {
    if (!confirm(`ปิดบิลโต๊ะ ${tab.tableName} ยอด ${formatBaht(tab.totalSatang)}?`)) return;
    setBusy(tab.tableId);
    setMessage(null);
    const res = await fetch(`/api/admin/tables/${tab.tableId}/close-bill`, { method: "POST" });
    const body = (await res.json()) as { message?: string };
    setBusy(null);
    setMessage(res.ok ? `ปิดบิลโต๊ะ ${tab.tableName} แล้ว` : (body.message ?? "ปิดบิลไม่สำเร็จ"));
    await refresh();
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">โต๊ะที่ยังไม่ชำระ</h2>
        <LiveBadge state={stream} />
      </div>
      {message && (
        <p role="status" className="mt-3 rounded-lg bg-ink/5 px-4 py-2 text-sm">
          {message}
        </p>
      )}
      {tabs.length === 0 ? (
        <p className="mt-10 text-center text-muted">ไม่มีโต๊ะค้างชำระ</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tabs.map((t) => (
            <li key={t.tableId} className="rounded-xl border border-line bg-ticket p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold">โต๊ะ {t.tableName}</span>
                <span className="text-sm text-muted">{t.orderCount} ออเดอร์</span>
              </div>
              <p className="mt-2 font-mono text-2xl">{formatBaht(t.totalSatang)}</p>
              {t.unfinished > 0 && (
                <p className="mt-1 text-sm text-chili">ยังไม่เสิร์ฟ {t.unfinished} ออเดอร์</p>
              )}
              <button
                onClick={() => close(t)}
                disabled={busy === t.tableId || t.unfinished > 0}
                className="mt-4 w-full rounded-lg bg-ink py-2.5 font-semibold text-paper hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                รับเงินและปิดบิล
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
