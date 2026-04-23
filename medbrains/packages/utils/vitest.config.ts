import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    reporters: ["default", ["allure-vitest/reporter", { resultsDir: "../../qa/allure-results" }]],
    setupFiles: ["allure-vitest/setup"],
  },
});
