import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@arbix/shared"],
  typedRoutes: true,
  output: "standalone"
};

export default nextConfig;
