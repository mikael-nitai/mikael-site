import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const wrangler = "./node_modules/wrangler/bin/wrangler.js";
const migration = spawnSync(
  process.execPath,
  [wrangler, "d1", "migrations", "apply", "site-creator-d1", "--local", "--config", "tests/wrangler.test.jsonc", "--persist-to", ".wrangler/state"],
  { cwd: workspaceRoot, env: { ...process.env, CI: "1" }, stdio: "inherit" },
);

if (migration.status !== 0) process.exit(migration.status ?? 1);

const server = spawn(
  process.execPath,
  ["./node_modules/vite/bin/vite.js", "--config", "tests/vite.config.ts", "--host", "127.0.0.1", "--port", "4173"],
  { cwd: workspaceRoot, env: process.env, stdio: "inherit" },
);

const stop = (signal) => {
  if (!server.killed) server.kill(signal);
};

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
server.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
