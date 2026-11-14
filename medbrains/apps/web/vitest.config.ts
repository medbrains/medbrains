import { defineConfig } from "vitest/config";
import path from "path";
import svgr from "vite-plugin-svgr";
import pkg from "./package.json" with { type: "json" };
import { ALLURE_LINKS } from "./allure-links.ts";

export default defineConfig({
  plugins: [svgr()],
  // The build stamps the app version in (vite.config.ts); tests read the same.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    // CI sets VITEST_REPORT_DIR for a JUnit file the PR's per-test summary reads, and the
    // Allure results the test report at tests.medbrains.in is built from.
    ...(process.env.VITEST_REPORT_DIR
      ? {
          setupFiles: ["allure-vitest/setup", "./src/test/setup.ts"],
          reporters: [
            "default",
            "junit",
            [
              "allure-vitest/reporter",
              {
                resultsDir: `${process.env.VITEST_REPORT_DIR}/allure-results`,
                links: ALLURE_LINKS,
              },
            ],
          ],
          outputFile: { junit: `${process.env.VITEST_REPORT_DIR}/vitest.xml` },
        }
      : {}),
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Generated files are excluded from SonarCloud too; leaving them in the report made it
      // name paths SonarCloud does not index. Stories and fixtures are not shipped code.
      exclude: [
        "src/test/**",
        "src/vite-env.d.ts",
        "src/**/*.generated.*",
        "src/**/*.stories.tsx",
        "src/__fixtures__/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@medbrains/design-system": path.resolve(
        __dirname,
        "../../packages/design-system/src",
      ),
      "@medbrains/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
    },
  },
});
