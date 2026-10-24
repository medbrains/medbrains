import { defineConfig } from "vitest/config";
import path from "path";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [svgr()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/test/**", "src/vite-env.d.ts"],
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
