import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@arbix/shared"],
  typedRoutes: true,
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
