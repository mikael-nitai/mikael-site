import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.unit.test.{ts,mts}"],
    environment: "node",
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    sequence: { concurrent: false },
  },
});
