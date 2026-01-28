import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keeping this as it's the standard way to handle native modules
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
