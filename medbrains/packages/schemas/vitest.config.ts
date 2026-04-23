import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: true,
    reporters: ["default", ["allure-vitest/reporter", { resultsDir: "../../qa/allure-results" }]],
    setupFiles: ["allure-vitest/setup"],
  },
});
