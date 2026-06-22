import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { compression } from "vite-plugin-compression2";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";

export default defineConfig(async () => {
  const plugins: PluginOption[] = [
    react(),
    wasm(),
    topLevelAwait(),
    // Precompress hashed, immutable build assets once (brotli-max + gzip).
    // The server serves these directly (ServeDir precompressed_*), so the
    // bundle ships at max ratio with zero per-request CPU. Originals are kept
    // for clients that don't accept the encoding.
    compression({
      algorithms: ["brotliCompress", "gzip"],
      threshold: 1024,
      // Default filter excludes .wasm — but the Loro CRDT wasm is the single
      // largest asset (~3 MB) and compresses ~60% with brotli. Include it.
      include: [/\.(js|mjs|cjs|json|css|html|svg|wasm)$/i],
    }),
  ];
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
      // No custom manualChunks. A hand-rolled split forced interdependent
      // modules (Mantine family, dayjs, and app barrel-file re-exports) into
      // separate chunks, creating cross-chunk circular deps and broken ESM init
      // order — the prod-only "Cannot access 'X' before initialization" / "Jk is
      // not a function" crashes. Rollup's automatic chunking computes a
      // TDZ-safe order and still code-splits the lazy routes. See vitejs/vite
      // discussion #14090 and issue #12209.
    },
    // Pre-bundle the tiptap editor deps so adding them never triggers a
    // late re-optimize / 504 "Outdated Optimize Dep" on the dev server.
    optimizeDeps: {
      include: [
        "@mantine/tiptap",
        "@tiptap/react",
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
