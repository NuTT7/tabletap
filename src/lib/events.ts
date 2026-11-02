import { EventEmitter } from "node:events";
import { Redis } from "ioredis";
import type { OrderStatus } from "@/db/schema";

/**
 * Real-time event bus.
 *
 * Every server instance publishes order events to Redis and subscribes to the
 * same channels, so a kitchen screen connected to instance A still sees an
 * order placed through instance B. Without REDIS_URL it falls back to an
 * in-process EventEmitter, which is enough for a single server in development.
 */

export type OrderEvent =
  | { type: "order.created"; orderId: string; tableId: number; tableName: string }
  | { type: "order.status"; orderId: string; tableId: number; status: OrderStatus }
  | { type: "bill.closed"; tableId: number; billId: number };

export const KITCHEN_CHANNEL = "kitchen";
export const tableChannel = (tableId: number) => `table:${tableId}`;

type Listener = (event: OrderEvent) => void;

interface Bus {
  publish(channel: string, event: OrderEvent): Promise<void>;
  subscribe(channel: string, listener: Listener): () => void;
}

function createMemoryBus(): Bus {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  return {
    async publish(channel, event) {
      emitter.emit(channel, event);
    },
    subscribe(channel, listener) {
      emitter.on(channel, listener);
      return () => emitter.off(channel, listener);
    },
  };
}

function createRedisBus(url: string): Bus {
  const pub = new Redis(url, { maxRetriesPerRequest: 2 });
  // A connection in subscriber mode can't run other commands, so it gets its own.
  const sub = new Redis(url);
  const local = new EventEmitter();
  local.setMaxListeners(0);
  const refCounts = new Map<string, number>();

  sub.on("message", (channel: string, message: string) => {
    try {
      local.emit(channel, JSON.parse(message) as OrderEvent);
    } catch {
      // Ignore malformed messages rather than crash every open stream.
    }
  });

  return {
    async publish(channel, event) {
      await pub.publish(channel, JSON.stringify(event));
    },
    subscribe(channel, listener) {
      local.on(channel, listener);
      const count = refCounts.get(channel) ?? 0;
      refCounts.set(channel, count + 1);
      if (count === 0) void sub.subscribe(channel);

      return () => {
        local.off(channel, listener);
        const remaining = (refCounts.get(channel) ?? 1) - 1;
        if (remaining <= 0) {
          refCounts.delete(channel);
          void sub.unsubscribe(channel);
        } else {
          refCounts.set(channel, remaining);
        }
      };
    },
  };
}

const globalForBus = globalThis as unknown as { bus?: Bus };

export function getBus(): Bus {
  if (!globalForBus.bus) {
    globalForBus.bus = process.env.REDIS_URL
      ? createRedisBus(process.env.REDIS_URL)
      : createMemoryBus();
  }
  return globalForBus.bus;
}

export async function publishOrderEvent(event: OrderEvent): Promise<void> {
  const bus = getBus();
  const channels = [tableChannel(event.tableId)];
  if (event.type !== "bill.closed") channels.push(KITCHEN_CHANNEL);
  try {
    await Promise.all(channels.map((c) => bus.publish(c, event)));
  } catch (err) {
    // The order is already committed; a lost notification only delays the
    // screen until its next refresh, so log instead of failing the request.
    console.error("[events] publish failed", err);
  }
}
