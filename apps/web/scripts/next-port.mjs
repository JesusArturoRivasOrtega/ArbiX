import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const nextBin = require.resolve("next/dist/bin/next");

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, "..");
const rootDir = resolve(appDir, "../..");

loadEnvConfig(rootDir, process.env.NODE_ENV !== "production");
loadEnvConfig(appDir, process.env.NODE_ENV !== "production");

const command = process.argv[2] ?? "dev";
const port = process.env.WEB_PORT ?? process.env.PORT ?? "3001";
const child = spawn(process.execPath, [nextBin, command, "-p", port], {
  cwd: appDir,
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
