import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TableTap",
  description: "สั่งอาหารผ่าน QR ที่โต๊ะ ครัวเห็นทันที",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f1e7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
