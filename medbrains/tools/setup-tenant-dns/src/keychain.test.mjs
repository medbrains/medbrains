/**
 * Pure-function tests for the keychain module. The store / retrieve
 * sides hit the OS keychain CLI tools and are exercised manually.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SERVICE_PREFIX, retrievalSnippet, platformName } from "./keychain.mjs";

describe("retrievalSnippet", () => {
  it("emits a security command on macOS", { skip: process.platform !== "darwin" }, () => {
    const s = retrievalSnippet("CLOUDFLARE_API_TOKEN", "tenant-x", "CLOUDFLARE_API_TOKEN");
    assert.match(s, /security find-generic-password/);
    assert.match(
      s,
      new RegExp(`-s '${SERVICE_PREFIX}/tenant-x/CLOUDFLARE_API_TOKEN'`),
    );
    assert.match(s, /export CLOUDFLARE_API_TOKEN=/);
  });

  it("emits a secret-tool command on Linux", { skip: process.platform !== "linux" }, () => {
    const s = retrievalSnippet("CLOUDFLARE_API_TOKEN", "tenant-x", "CLOUDFLARE_API_TOKEN");
    assert.match(s, /secret-tool lookup/);
    assert.match(
      s,
      new RegExp(`service '${SERVICE_PREFIX}/tenant-x/CLOUDFLARE_API_TOKEN'`),
    );
  });

  it("throws on unsupported platforms", () => {
    if (process.platform !== "darwin" && process.platform !== "linux") {
      assert.throws(() => retrievalSnippet("X", "y", "X"), /not supported/);
    }
  });
});

describe("platformName", () => {
  it("returns a human-readable label", () => {
    const name = platformName();
    assert.equal(typeof name, "string");
    assert.ok(name.length > 0);
  });
});

describe("SERVICE_PREFIX", () => {
  it("is namespaced under medbrains-dns", () => {
    assert.equal(SERVICE_PREFIX, "medbrains-dns");
  });
});
