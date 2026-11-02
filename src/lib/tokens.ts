import { randomBytes } from "node:crypto";

/** 128 bits of randomness, URL-safe. Used for table QR tokens. */
export function newTableToken(): string {
  return randomBytes(16).toString("base64url");
}
