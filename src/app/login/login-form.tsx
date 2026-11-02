"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    const body = (await res.json()) as { role?: string; message?: string };
    setPending(false);
    if (!res.ok) {
      setError(body.message ?? "เข้าสู่ระบบไม่สำเร็จ");
      return;
    }
    router.push(body.role === "kitchen" && next.startsWith("/admin") ? "/kitchen" : next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="username" className="text-sm font-medium">
          ชื่อผู้ใช้
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          className="mt-1 w-full rounded-lg border border-line bg-ticket px-3 py-2.5 outline-none focus:border-ink"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium">
          รหัสผ่าน
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-lg border border-line bg-ticket px-3 py-2.5 outline-none focus:border-ink"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-ink py-3 font-semibold text-paper hover:bg-black disabled:opacity-60"
      >
        {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </button>
      <p className="text-xs text-muted">บัญชีทดลอง: admin / admin1234 หรือ kitchen / kitchen1234</p>
    </form>
  );
}
