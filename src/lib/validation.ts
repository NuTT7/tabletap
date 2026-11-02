import { z } from "zod";

export const placeOrderSchema = z.object({
  idempotencyKey: z.string().uuid(),
  note: z.string().trim().max(200).default(""),
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
        note: z.string().trim().max(100).default(""),
      }),
    )
    .min(1, "ตะกร้าว่าง")
    .max(30),
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const updateStatusSchema = z.object({
  from: z.enum(["pending", "preparing", "ready", "served", "cancelled"]),
  to: z.enum(["pending", "preparing", "ready", "served", "cancelled"]),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
});

export const menuItemSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(""),
  price: z.string().trim(),
});
