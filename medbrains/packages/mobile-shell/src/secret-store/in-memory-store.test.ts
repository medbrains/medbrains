import { describe, expect, it } from "vitest";
import { InMemorySecretStore } from "./in-memory-store.js";
import { SECRET_KEYS } from "./types.js";

describe("InMemorySecretStore", () => {
  it("round-trips a value", async () => {
    const store = new InMemorySecretStore();
    await store.setItem(SECRET_KEYS.jwt, "abc.def.ghi");
    expect(await store.getItem(SECRET_KEYS.jwt)).toBe("abc.def.ghi");
  });

  it("returns null for missing keys", async () => {
    const store = new InMemorySecretStore();
    expect(await store.getItem(SECRET_KEYS.refreshToken)).toBeNull();
  });

  it("delete removes the key", async () => {
    const store = new InMemorySecretStore();
    await store.setItem(SECRET_KEYS.jwt, "x");
    await store.deleteItem(SECRET_KEYS.jwt);
    expect(await store.getItem(SECRET_KEYS.jwt)).toBeNull();
  });

  it("isAvailable always true", async () => {
    expect(await new InMemorySecretStore().isAvailable()).toBe(true);
  });

  it("size reflects entry count", async () => {
    const store = new InMemorySecretStore();
    await store.setItem("a", "1");
    await store.setItem("b", "2");
    await store.setItem("a", "3");
    expect(store.size()).toBe(2);
  });
});
