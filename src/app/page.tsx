import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-sm tracking-widest text-chili uppercase">TableTap</p>
      <h1 className="mt-3 text-4xl leading-tight font-bold sm:text-5xl">
        สแกนที่โต๊ะ สั่งได้เลย
        <br />
        ครัวเห็นทันที
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted">
        ระบบสั่งอาหารสำหรับร้านขนาดเล็ก ลูกค้าสแกน QR ที่โต๊ะเพื่อสั่ง จอครัวอัปเดตแบบ real-time
        และสถานะอาหารเด้งกลับไปที่มือถือลูกค้า
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <Link
          href="/kitchen"
          className="rounded-xl border border-ink bg-ink px-5 py-4 text-paper transition hover:bg-black"
        >
          <span className="block font-semibold">จอครัว</span>
          <span className="text-sm opacity-70">สำหรับพนักงานครัว</span>
        </Link>
        <Link
          href="/admin"
          className="rounded-xl border border-line bg-ticket px-5 py-4 transition hover:border-ink"
        >
          <span className="block font-semibold">หลังร้าน</span>
          <span className="text-sm text-muted">เมนู โต๊ะ QR และปิดบิล</span>
        </Link>
      </div>

      <p className="mt-8 text-sm text-muted">
        ลูกค้าเข้าผ่านลิงก์ใน QR ของแต่ละโต๊ะ (ดูได้ที่หน้าหลังร้าน → โต๊ะ)
      </p>
    </main>
  );
}
