import type { NextConfig } from "next";

// Let phones on the same Wi-Fi use the dev server when APP_URL points at the
// computer's LAN address (e.g. http://192.168.1.20:3000).
const appHost = (() => {
  try {
    return new URL(process.env.APP_URL ?? "http://localhost:3000").hostname;
  } catch {
    return "localhost";
  }
})();

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["ioredis", "postgres"],
  allowedDevOrigins: [appHost],
};

export default nextConfig;
