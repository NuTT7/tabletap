import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-sm text-chili">404</p>
      <h1 className="mt-2 text-2xl font-bold">ไม่พบหน้านี้</h1>
      <p className="mt-2 text-muted">ถ้าสแกน QR ที่โต๊ะแล้วเจอหน้านี้ QR อาจถูกเปลี่ยนแล้ว แจ้งพนักงานได้เลย</p>
      <Link href="/" className="mt-6 underline underline-offset-4">
        กลับหน้าแรก
      </Link>
    </main>
  );
}
