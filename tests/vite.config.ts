import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "../build/sites-vite-plugin";

export default defineConfig(async () => {
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        configPath: "tests/wrangler.test.jsonc",
        persistState: { path: ".wrangler/state" },
      }),
    ],
  };
});
