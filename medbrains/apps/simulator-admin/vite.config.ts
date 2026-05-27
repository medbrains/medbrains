import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(() => {
  const port = Number.parseInt(process.env.VITE_DEV_PORT ?? "5180", 10);
  const devHttpsDomain = process.env.DEV_SIMULATOR_HTTPS_DOMAIN;
  const workspaceRoot = path.resolve(__dirname, "../..");
  return {
    plugins: [react()],
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        react: path.resolve(workspaceRoot, "node_modules/react"),
        "react-dom": path.resolve(workspaceRoot, "node_modules/react-dom"),
      },
    },
    build: {
      sourcemap: "hidden" as const,
      target: "es2022",
    },
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      hmr: devHttpsDomain
        ? {
            protocol: "wss",
            host: devHttpsDomain,
            clientPort: 443,
            path: "/simulator-vite-hmr",
          }
        : {
            protocol: "ws",
            host: "127.0.0.1",
            clientPort: port,
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
