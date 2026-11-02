import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  // Only allow redirects to local paths, never to another site.
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/kitchen";
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <p className="font-mono text-xs tracking-widest text-chili uppercase">TableTap</p>
      <h1 className="mt-2 text-2xl font-bold">เข้าสู่ระบบพนักงาน</h1>
      <LoginForm next={safeNext} />
    </main>
  );
}
