import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Don't fail the production build if there are ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don't fail the production build if there are TypeScript errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
