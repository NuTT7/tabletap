import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { hasRole, signSession, verifySession } from "@/lib/auth";

describe("sessions", () => {
  it("round-trips a signed session", async () => {
    const token = await signSession({ staffId: 7, username: "kitchen", role: "kitchen" });
    expect(await verifySession(token)).toEqual({ staffId: 7, username: "kitchen", role: "kitchen" });
  });

  it("rejects a token signed with a different secret", async () => {
    const forged = await new SignJWT({ username: "x", role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("1")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("another-secret-another-secret-123456"));
    expect(await verifySession(forged)).toBeNull();
  });

  it("rejects tampered and garbage tokens", async () => {
    const token = await signSession({ staffId: 1, username: "a", role: "kitchen" });
    const [h, , s] = token.split(".");
    const evilPayload = Buffer.from(JSON.stringify({ sub: "1", username: "a", role: "admin" })).toString("base64url");
    expect(await verifySession(`${h}.${evilPayload}.${s}`)).toBeNull();
    expect(await verifySession("not-a-jwt")).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });

  it("gives admins access to kitchen routes but not the reverse", () => {
    expect(hasRole({ staffId: 1, username: "a", role: "admin" }, "kitchen")).toBe(true);
    expect(hasRole({ staffId: 2, username: "k", role: "kitchen" }, "admin")).toBe(false);
    expect(hasRole(null, "kitchen")).toBe(false);
  });
});
