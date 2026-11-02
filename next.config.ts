import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["ioredis", "postgres"],
  allowedDevOrigins: ["192.168.1.20"],
};

export default nextConfig;
