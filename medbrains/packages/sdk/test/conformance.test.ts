import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAgainstMock, runConformance } from "../src/conformance.js";
import type { Manifest } from "../src/manifest.js";

const manifest = JSON.parse(
  readFileSync(join(__dirname, "../../../docs/extensions/fixtures/valid/census-sync.json"), "utf8"),
) as Manifest;

describe("conformance suite", () => {
  it("passes against the mock, webhook checks included", async () => {
    const results = await runAgainstMock(manifest);
    expect(results.filter((r) => !r.ok)).toEqual([]);
    const names = results.map((r) => r.name);
    expect(names).toContain("a replayed webhook outside the window is refused");
    expect(names).toContain("an unsupported grant type is refused, never cached");
  });

  it("fails a server that says yes to everything", async () => {
    const server = createServer((_, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ access_token: "x", token_type: "Bearer", expires_in: 900, resourceType: "Patient" }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const results = await runConformance(manifest, { baseUrl, clientId: "a", clientSecret: "b" });
      const failed = results.filter((r) => !r.ok).map((r) => r.name);
      expect(failed).toContain("a wrong secret is refused");
      expect(failed).toContain("a call without a token is refused");
      expect(failed).toContain("an unsupported grant type is refused, never cached");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
