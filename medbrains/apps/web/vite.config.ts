import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";

function manualChunks(id: string) {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (id.includes("@mantine/charts") || id.includes("recharts")) {
    return "vendor-charts";
  }

  if (id.includes("echarts")) {
    return "vendor-echarts";
  }

  if (id.includes("@mantine/schedule")) {
    return "vendor-schedule";
  }

  if (id.includes("@mantine/dates") || id.includes("dayjs")) {
    return "vendor-dates";
  }

  if (id.includes("@xyflow/react") || id.includes("@dnd-kit") || id.includes("codemirror")) {
    return "vendor-workbench";
  }

  if (id.includes("react-hook-form") || id.includes("@hookform/resolvers")) {
    return "vendor-forms";
  }

  if (id.includes("@tanstack/react-query") || id.includes("@tanstack/react-pacer")) {
    return "vendor-query";
  }

  if (id.includes("zustand")) {
    return "vendor-state";
  }

  if (id.includes("react") || id.includes("i18next")) {
    return "vendor-react";
  }

  if (id.includes("@mantine/")) {
    return "vendor-mantine-core";
  }

  return undefined;
}

export default defineConfig(async () => {
  const plugins: PluginOption[] = [react(), wasm(), topLevelAwait()];
  const devHttpsDomain = process.env.DEV_HTTPS_DOMAIN ?? "medbrains.localhost";
  const devPort = Number.parseInt(process.env.VITE_DEV_PORT ?? "5173", 10);
  const reactScanDev = process.env.VITE_REACT_SCAN === "true";
  const workspaceRoot = path.resolve(__dirname, "../..");

  if (process.env.ANALYZE === "true") {
    const { visualizer } = await import("rollup-plugin-visualizer");
    plugins.push(
      visualizer({
        filename: "dist/stats.html",
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
    );
  }

  return {
    cacheDir: process.env.VITE_CACHE_DIR ?? path.resolve(__dirname, "node_modules/.vite"),
    plugins,
    resolve: {
      dedupe: ["react", "react-dom", "react-hook-form"],
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@medbrains/design-system": path.resolve(workspaceRoot, "packages/design-system/src"),
        react: path.resolve(workspaceRoot, "node_modules/react"),
        "react-dom": path.resolve(workspaceRoot, "node_modules/react-dom"),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler",
        },
      },
    },
    build: {
      cssCodeSplit: true,
      modulePreload: {
        polyfill: false,
      },
      reportCompressedSize: false,
      sourcemap: "hidden",
      target: "es2022",
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
    // Pre-bundle the tiptap editor deps so adding them never triggers a
    // late re-optimize / 504 "Outdated Optimize Dep" on the dev server.
    optimizeDeps: {
      include: [
        "@mantine/tiptap",
        "@tiptap/react",
        "@tiptap/pm",
        "@tiptap/starter-kit",
        "@tiptap/extension-link",
      ],
    },
    server: {
      host: "127.0.0.1",
      port: devPort,
      strictPort: !reactScanDev,
      hmr: reactScanDev
        ? {
            protocol: "ws",
            host: "127.0.0.1",
            clientPort: devPort,
            path: "/vite-hmr",
          }
        : {
            protocol: "wss",
            host: devHttpsDomain,
            clientPort: 443,
            path: "/vite-hmr",
          },
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          cookieDomainRewrite: "",
        },
      },
    },
  };
});
