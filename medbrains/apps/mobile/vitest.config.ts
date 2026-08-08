import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure logic only — React Native screens need a native renderer, so the
    // decisions worth pinning are extracted into plain modules.
    include: ["src/**/*.test.ts"],
  },
});
