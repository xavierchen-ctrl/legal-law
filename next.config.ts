import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use simplified config compatible with Turbopack
  serverExternalPackages: ['pdf-parse'],
  // Allow Turbopack to run without complaint
  experimental: {
    // serverComponentsExternalPackages is alias for serverExternalPackages in some versions, 
    // but 'serverExternalPackages' is top-level in latest Next.js 15/16.
    // Let's stick to top-level if types allow, but the previous error didn't complain about that property.
  }
};

export default nextConfig;
