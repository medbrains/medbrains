import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { compression } from "vite-plugin-compression2";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";
import { execSync } from "child_process";
import pkg from "./package.json" with { type: "json" };

export default defineConfig(async ({ command }) => {
  const isBuild = command === "build";
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

  // Build identity, baked in at build time.
  //
  // "Which version are you on?" had no answer anywhere — not in the UI, not
  // in /api/health, not in a footer. On a hospital system that is the first
  // question support asks and the last one anybody can answer, and a browser
  // holding a stale cached bundle looks identical to one that is up to date.
  //
  // The commit is the same identity the deploy already fingerprints in
  // scripts/source-fingerprint.sh, so the string on the screen and the string
  // terraform prints are the same commit rather than two schemes that drift.
  const gitCommit = (() => {
    try {
      return execSync("git rev-parse --short=12 HEAD", { cwd: workspaceRoot })
        .toString()
        .trim();
    } catch {
      // A tarball or a container build with no .git is a normal way to build
      // this. Say so rather than pretending to a commit.
      return "unknown";
    }
  })();
  const gitDirty = (() => {
    try {
      return execSync("git status --porcelain -- crates apps packages", { cwd: workspaceRoot })
        .toString()
        .trim().length > 0;
    } catch {
      return false;
    }
  })();

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_COMMIT__: JSON.stringify(gitDirty ? `${gitCommit}+local` : gitCommit),
      __APP_BUILT__: JSON.stringify(new Date().toISOString()),
    },
    cacheDir: process.env.VITE_CACHE_DIR ?? path.resolve(__dirname, "node_modules/.vite"),
    plugins,
    // Vite 8 changed CJS default-import interop: `import X from "cjs-dual-pkg"`
    // now yields the module-namespace object instead of the default export,
    // which breaks CJS/dual-package deps at runtime — e.g. lottie-react rendered
    // as an object ("Element type is invalid … got: object" in <CrabLottie>).
    // Restore the Vite 7 interop until those deps ship pure ESM. Deprecated flag;
    // revisit when lottie-react (and any other CJS default-imports) are ESM-only.
    legacy: {
      inconsistentCjsInterop: true,
    },
    // Strip noisy/leaky console + debugger from PRODUCTION builds only (dev keeps
    // them). `pure` drops console.log/info/debug (which may log PHI) via dead-code
    // elimination; console.warn/error are KEPT — error is the client-error report
    // hook in main.tsx, warn is operational.
    esbuild: isBuild
      ? { pure: ["console.log", "console.info", "console.debug"], drop: ["debugger"] }
      : {},
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
      // discussion #14090 and issue #12209. Circular deps are caught separately
      // by `make check-circular` (madge) — see Makefile.
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
