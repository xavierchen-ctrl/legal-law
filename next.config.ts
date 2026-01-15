import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Required for instrumentation in some versions, harmless if mainstraemed
    instrumentationHook: true,
  },
};

export default nextConfig;
