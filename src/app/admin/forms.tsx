"use client";

import { useActionState, useEffect, useRef } from "react";
import { addMenuItem, addTable, type ActionState } from "./actions";

const input = "mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-ink";

export function AddMenuItemForm({ categories }: { categories: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addMenuItem, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="h-fit space-y-3 rounded-xl border border-line bg-ticket p-4">
      <h2 className="font-semibold">เพิ่มเมนู</h2>
      <label className="block text-sm">
        หมวด
        <select name="categoryId" className={input} required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        ชื่อเมนู
        <input name="name" required maxLength={80} className={input} />
      </label>
      <label className="block text-sm">
        รายละเอียด
        <input name="description" maxLength={300} className={input} />
      </label>
      <label className="block text-sm">
        ราคา (บาท)
        <input name="price" required inputMode="decimal" placeholder="60" className={input} />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="w-full rounded-lg bg-ink py-2.5 font-semibold text-paper disabled:opacity-60">
        {pending ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </form>
  );
}

export function AddTableForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addTable, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2">
      <label className="text-sm">
        เพิ่มโต๊ะ
        <input name="name" required maxLength={20} placeholder="เช่น C1" className={`${input} w-40`} />
      </label>
      <button disabled={pending} className="rounded-lg bg-ink px-4 py-2 font-semibold text-paper disabled:opacity-60">
        เพิ่ม
      </button>
      {state.error && (
        <p role="alert" className="w-full text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
