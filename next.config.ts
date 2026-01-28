import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use serverExternalPackages to tell Next.js not to bundle pdf-parse
  serverExternalPackages: ['pdf-parse'],

  // Custom Webpack config to explicitly ignore canvas/encoding
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};

// Explicitly add turbopack config at root level (bypassing strict type check if needed)
// This satisfies the "Webpack with Turbopack" requirement
// @ts-ignore
nextConfig.turbopack = {};

export default nextConfig;
