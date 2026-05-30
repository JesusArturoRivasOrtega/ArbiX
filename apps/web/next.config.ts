import * as nextEnv from "@next/env";
import type { NextConfig } from "next";
import { resolve } from "node:path";

type NextEnvModule = typeof nextEnv & { default?: typeof nextEnv };
const { loadEnvConfig } = (nextEnv as NextEnvModule).default ?? nextEnv;

loadEnvConfig(resolve(process.cwd(), "../.."), process.env.NODE_ENV !== "production");

const nextConfig: NextConfig = {
  transpilePackages: ["@arbix/shared"],
  typedRoutes: true,
  output: "standalone"
};

export default nextConfig;
