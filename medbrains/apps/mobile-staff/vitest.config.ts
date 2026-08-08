import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure-logic tests only. React Native components need a native renderer;
    // the decisions worth pinning are extracted into plain modules instead, so
    // this suite runs anywhere without a device harness.
    include: ["src/**/*.test.ts"],
  },
});
