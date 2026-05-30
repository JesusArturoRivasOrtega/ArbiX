import * as nextEnv from "@next/env";
import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

type NextEnvModule = typeof nextEnv & { default?: typeof nextEnv };
const { loadEnvConfig } = (nextEnv as NextEnvModule).default ?? nextEnv;

loadEnvConfig(resolve(process.cwd(), "../.."), true);

const apiPort = process.env.API_PORT ?? "4000";
const webPort = process.env.WEB_PORT ?? "3001";
const apiURL = process.env.PLAYWRIGHT_API_URL ?? `http://localhost:${apiPort}`;
const webURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${webPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: webURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: "npm run dev -w @arbix/api",
      url: `${apiURL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000
    },
    {
      command: "npm run dev -w @arbix/web",
      url: webURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000
    }
  ]
});
