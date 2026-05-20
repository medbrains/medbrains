import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";

export default defineConfig(async () => {
  const plugins: PluginOption[] = [react(), wasm(), topLevelAwait()];
  const devHttpsDomain = process.env.DEV_HTTPS_DOMAIN ?? "medbrains.localhost";
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
    plugins,
    resolve: {
      dedupe: ["react", "react-dom", "react-hook-form"],
      alias: {
        "@": path.resolve(__dirname, "./src"),
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
      sourcemap: "hidden",
      target: "es2022",
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router"],
            "vendor-mantine": [
              "@mantine/core",
              "@mantine/hooks",
              "@mantine/notifications",
              "@mantine/charts",
            ],
            "vendor-query": ["@tanstack/react-query", "zustand"],
          },
        },
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      hmr: {
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
