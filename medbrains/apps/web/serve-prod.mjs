// Minimal static server that mirrors the Rust ServeDir behavior:
// serves precompressed .br/.gz with Content-Encoding when the client accepts it,
// SPA-fallback to index.html. For verifying production bundle transfer sizes.
import { createServer, request as httpRequest } from "node:http";
import { stat, readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const DIST = join(import.meta.dirname, "dist");
const PORT = Number(process.env.PORT ?? 4180);
// In real prod the Rust server serves /api AND the SPA. Here we proxy /api to
// the running backend so login (httpOnly cookie auth) works against the bundle.
const API_TARGET = { host: "127.0.0.1", port: Number(process.env.API_PORT ?? 3000) };

function proxyApi(req, res) {
  const up = httpRequest(
    { host: API_TARGET.host, port: API_TARGET.port, method: req.method, path: req.url, headers: req.headers },
    (upRes) => {
      res.writeHead(upRes.statusCode ?? 502, upRes.headers); // forwards Set-Cookie
      upRes.pipe(res);
    },
  );
  up.on("error", () => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(`{"error":"backend unreachable on :${API_TARGET.port}"}`);
  });
  req.pipe(up);
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  // Proxy API traffic to the real backend (matches prod single-origin behavior).
  if (req.url.startsWith("/api")) {
    proxyApi(req, res);
    return;
  }
  let urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (urlPath.endsWith("/")) urlPath += "index.html";
  let file = normalize(join(DIST, urlPath));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  // SPA fallback: unknown non-asset paths → index.html
  if (!(await exists(file))) file = join(DIST, "index.html");

  const accept = req.headers["accept-encoding"] ?? "";
  let encoding = null;
  let served = file;
  if (accept.includes("br") && (await exists(`${file}.br`))) {
    encoding = "br";
    served = `${file}.br`;
  } else if (accept.includes("gzip") && (await exists(`${file}.gz`))) {
    encoding = "gzip";
    served = `${file}.gz`;
  }

  const body = await readFile(served);
  const ext = extname(file);
  res.setHeader("Content-Type", TYPES[ext] ?? "application/octet-stream");
  if (encoding) res.setHeader("Content-Encoding", encoding);
  res.setHeader("Vary", "Accept-Encoding");
  if (file.includes("/assets/")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
  res.writeHead(200).end(body);
});

server.listen(PORT, () => {
  console.log(`prod dist served (precompressed): http://127.0.0.1:${PORT}`);
});
