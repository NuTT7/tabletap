import { describe, expect, it } from "vitest";
import { formatBaht, parseBahtToSatang, sumLines } from "@/lib/money";
import { canTransition, isOpen, nextStatus } from "@/lib/order-status";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { placeOrderSchema } from "@/lib/validation";

describe("money", () => {
  it("parses baht strings to integer satang without float errors", () => {
    expect(parseBahtToSatang("60")).toBe(6000);
    expect(parseBahtToSatang("59.5")).toBe(5950);
    expect(parseBahtToSatang("0.10")).toBe(10);
    expect(parseBahtToSatang("1.005")).toBeNull();
    expect(parseBahtToSatang("-5")).toBeNull();
    expect(parseBahtToSatang("abc")).toBeNull();
  });

  it("sums order lines", () => {
    expect(sumLines([{ unitPriceSatang: 6000, quantity: 2 }, { unitPriceSatang: 1550, quantity: 3 }])).toBe(16650);
  });

  it("formats baht", () => {
    expect(formatBaht(6000)).toBe("฿60");
    expect(formatBaht(5950)).toBe("฿59.50");
  });
});

describe("order status machine", () => {
  it("allows the normal kitchen flow", () => {
    expect(canTransition("pending", "preparing")).toBe(true);
    expect(canTransition("preparing", "ready")).toBe(true);
    expect(canTransition("ready", "served")).toBe(true);
  });

  it("rejects skipping or reversing steps", () => {
    expect(canTransition("pending", "served")).toBe(false);
    expect(canTransition("ready", "preparing")).toBe(false);
    expect(canTransition("served", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "pending")).toBe(false);
  });

  it("does not allow cancelling food that is already ready", () => {
    expect(canTransition("ready", "cancelled")).toBe(false);
  });

  it("knows the next forward step", () => {
    expect(nextStatus("pending")).toBe("preparing");
    expect(nextStatus("ready")).toBe("served");
    expect(nextStatus("served")).toBeNull();
    expect(isOpen("ready")).toBe(true);
    expect(isOpen("cancelled")).toBe(false);
  });
});

describe("placeOrderSchema", () => {
  const key = "7f1c7b2e-4d4a-4a3e-9d2e-1f2b3c4d5e6f";

  it("accepts a normal order", () => {
    const r = placeOrderSchema.safeParse({ idempotencyKey: key, items: [{ menuItemId: 1, quantity: 2 }] });
    expect(r.success).toBe(true);
  });

  it("rejects an empty cart, silly quantities and client-side prices being trusted", () => {
    expect(placeOrderSchema.safeParse({ idempotencyKey: key, items: [] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ idempotencyKey: key, items: [{ menuItemId: 1, quantity: 0 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ idempotencyKey: key, items: [{ menuItemId: 1, quantity: 999 }] }).success).toBe(false);
    const withPrice = placeOrderSchema.parse({
      idempotencyKey: key,
      items: [{ menuItemId: 1, quantity: 1, priceSatang: 1 }],
    });
    expect(withPrice.items[0]).not.toHaveProperty("priceSatang");
  });
});

describe("rateLimit", () => {
  it("blocks after the limit and resets after the window", () => {
    resetRateLimits();
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, t).ok).toBe(true);
    expect(rateLimit("k", 3, 1000, t + 10).ok).toBe(false);
    expect(rateLimit("k", 3, 1000, t + 1001).ok).toBe(true);
  });
});
