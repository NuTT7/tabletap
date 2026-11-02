import { asc } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { LogoutButton } from "@/components/logout-button";
import { db } from "@/db";
import { categories, diningTables } from "@/db/schema";
import { getSession, hasRole } from "@/lib/auth";
import { formatBaht } from "@/lib/money";
import { getMenu, listOpenTabs } from "@/lib/orders";
import { rotateTableToken, toggleAvailability } from "./actions";
import { AddMenuItemForm, AddTableForm } from "./forms";
import { OpenTabs } from "./open-tabs";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const session = await getSession();
  if (!hasRole(session, "admin")) redirect("/login?next=/admin");

  const tab = ((await searchParams).tab as string) ?? "bills";
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const nav = [
    { id: "bills", label: "ปิดบิล" },
    { id: "menu", label: "เมนู" },
    { id: "tables", label: "โต๊ะ & QR" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-chili uppercase">TableTap · หลังร้าน</p>
          <h1 className="text-2xl font-bold">สวัสดี {session.username}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/kitchen" className="underline-offset-4 hover:underline">
            ไปจอครัว
          </Link>
          <LogoutButton className="text-muted underline-offset-4 hover:underline" />
        </div>
      </header>

      <nav className="mt-6 flex gap-1 border-b border-line" aria-label="ส่วนจัดการ">
        {nav.map((n) => (
          <Link
            key={n.id}
            href={`/admin?tab=${n.id}`}
            aria-current={tab === n.id ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === n.id ? "border-chili text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <main className="mt-6">
        {tab === "bills" && <OpenTabs initialTabs={await listOpenTabs()} />}
        {tab === "menu" && <MenuSection />}
        {tab === "tables" && <TablesSection appUrl={appUrl} />}
      </main>
    </div>
  );
}

async function MenuSection() {
  const [menu, cats] = await Promise.all([
    getMenu(),
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
  ]);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {menu.map((c) => (
          <section key={c.id}>
            <h2 className="text-sm font-semibold text-muted">{c.name}</h2>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-ticket">
              {c.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className={i.isAvailable ? "font-medium" : "font-medium text-muted line-through"}>{i.name}</p>
                    <p className="font-mono text-sm text-muted">{formatBaht(i.priceSatang)}</p>
                  </div>
                  <form action={toggleAvailability}>
                    <input type="hidden" name="id" value={i.id} />
                    <button
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        i.isAvailable ? "bg-basil/15 text-basil" : "bg-ink/10 text-muted"
                      }`}
                      aria-label={`${i.isAvailable ? "ตั้งเป็นหมด" : "ตั้งเป็นมีขาย"}: ${i.name}`}
                    >
                      {i.isAvailable ? "มีขาย" : "หมด"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <AddMenuItemForm categories={cats.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}

async function TablesSection({ appUrl }: { appUrl: string }) {
  const tables = await db.select().from(diningTables).orderBy(asc(diningTables.name));
  const withQr = await Promise.all(
    tables.map(async (t) => {
      const url = `${appUrl}/t/${t.token}`;
      return { ...t, url, qr: await QRCode.toDataURL(url, { margin: 1, width: 240 }) };
    }),
  );
  return (
    <div>
      <AddTableForm />
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {withQr.map((t) => (
          <li key={t.id} className="rounded-xl border border-line bg-ticket p-4 text-center">
            <p className="text-lg font-bold">โต๊ะ {t.name}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.qr} alt={`QR สำหรับโต๊ะ ${t.name}`} className="mx-auto mt-2 size-40" />
            <a href={t.url} target="_blank" className="mt-2 block truncate font-mono text-xs text-muted hover:text-ink">
              {t.url}
            </a>
            <form action={rotateTableToken} className="mt-3">
              <input type="hidden" name="id" value={t.id} />
              <button className="text-xs text-muted underline-offset-4 hover:text-chili hover:underline">
                ออก QR ใหม่ (QR เดิมใช้ไม่ได้)
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
