import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import path from "path";
import svgr from "vite-plugin-svgr";
import pkg from "./package.json" with { type: "json" };

/**
 * In tests, every API area module (`@medbrains/api/modules/<area>`) is the whole `api`
 * object from `@medbrains/api`, so `vi.mock("@medbrains/api")` and `vi.spyOn(api, …)` reach
 * the screens that import an area. Production imports the real area modules.
 */
function apiAreasAreTheMockableClient(): Plugin {
  const prefix = "@medbrains/api/modules/";
  return {
    name: "api-areas-are-the-mockable-client",
    enforce: "pre",
    resolveId: (id) => (id.startsWith(prefix) ? `\0api-area:${id.slice(prefix.length)}` : null),
    load(id) {
      if (!id.startsWith("\0api-area:")) return null;
      const area = id.slice("\0api-area:".length).replace(/[-_](\w)/g, (_, c: string) => c.toUpperCase());
      return `import { api } from "@medbrains/api";\nexport const ${area}Api = api;\n`;
    },
  };
}

export default defineConfig({
  plugins: [svgr(), apiAreasAreTheMockableClient()],
  // The build stamps the app version in (vite.config.ts); tests read the same.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // CI sets VITEST_REPORT_DIR for a JUnit file the PR's per-test summary reads.
    ...(process.env.VITEST_REPORT_DIR
      ? {
          reporters: ["default", "junit"],
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
