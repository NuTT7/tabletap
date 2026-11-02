import type { StreamState } from "@/lib/use-event-stream";

export function LiveBadge({ state, dark = false }: { state: StreamState; dark?: boolean }) {
  const label = state === "live" ? "เชื่อมต่อสด" : state === "connecting" ? "กำลังเชื่อมต่อ" : "กำลังเชื่อมต่อใหม่";
  const dot = state === "live" ? "bg-green-500" : "bg-turmeric animate-pulse";
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
        dark ? "bg-white/10 text-white/80" : "bg-ink/5 text-muted"
      }`}
    >
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      {label}
    </span>
  );
}
