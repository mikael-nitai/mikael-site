import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const systemChromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const chromePath = process.env.PLAYWRIGHT_CHROME_PATH ??
  (process.platform === "win32" && existsSync(systemChromePath) ? systemChromePath : undefined);
const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.browser.test.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["line"], ["html", { open: "never", outputFolder: join(tmpdir(), "mikael-site-playwright-report") }]] : "line",
  // Vite watches the workspace. Keeping traces outside it prevents a trace
  // write from becoming an HMR reload in the page under test.
  outputDir: join(tmpdir(), "mikael-site-playwright-results"),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Keep the suite runnable with a system Chrome installation alone. Traces
    // and failure screenshots provide diagnostics without Playwright's optional
    // ffmpeg download.
    video: "off",
    launchOptions: chromePath ? { executablePath: chromePath } : undefined,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
      ? undefined
      : {
        cwd: workspaceRoot,
        // The wrapper migrates the disposable local D1 before Vinext starts.
        // Production's Node adapter cannot load `cloudflare:workers`, so browser
        // tests use the Cloudflare Vite runtime against the same route graph.
        command: "node ./tests/start-test-server.mjs",
        env: {
          ...process.env,
          MIKAEL_OWNER_USER_ID: "owner-test-id",
          NODE_ENV: "test",
        },
        url: "http://127.0.0.1:4173",
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
