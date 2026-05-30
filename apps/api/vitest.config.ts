import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts"]
  },
  resolve: {
    alias: {
      "@arbix/shared": new URL("../../packages/shared/src/index.ts", import.meta.url).pathname,
      "@arbix/config": new URL("../../packages/config/src/index.ts", import.meta.url).pathname
    }
  }
});
