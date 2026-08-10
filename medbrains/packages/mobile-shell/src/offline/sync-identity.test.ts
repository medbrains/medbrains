import { afterEach, describe, expect, it } from "vitest";
import { InMemorySecretStore } from "../secret-store/in-memory-store.js";
import { SECRET_KEYS } from "../secret-store/types.js";
import type { EdgeRnBindings } from "./edge-rn-contract.js";
import { setEdgeRnBindings } from "./edge-rn-loader.js";
import { ensureSyncIdentity, forgetSyncIdentity, peekSyncIdentity } from "./sync-identity.js";

/**
 * Stands in for the Rust bridge. Mirrors the real contract in the one
 * way these tests depend on: a node id is *derived* from a secret, so
 * the same secret always yields the same id and a different secret
 * never does.
 */
function fakeBindings(): EdgeRnBindings & { mints: number } {
  let counter = 0;
  const bindings = {
    mints: 0,
    generateNodeIdentity() {
      counter += 1;
      bindings.mints += 1;
      return { secretHex: `PRIVATE${counter}`, nodeId: `pub${counter}` };
    },
    nodeIdForSecret(secretHex: string) {
      return secretHex.replace("PRIVATE", "pub");
    },
  } as unknown as EdgeRnBindings & { mints: number };
  return bindings;
}

afterEach(() => {
  setEdgeRnBindings(null);
});

describe("sync identity", () => {
  it("mints a key on first use and reports that it did", async () => {
    setEdgeRnBindings(fakeBindings());
    const store = new InMemorySecretStore();

    const first = await ensureSyncIdentity(store);

    expect(first.minted).toBe(true);
    expect(first.nodeId).toBe("pub1");
  });

  /**
   * The guarantee the whole feature rests on. An administrator binds
   * one node id; if the device ever minted a second key it would look
   * correctly paired and silently stop being admitted.
   */
  it("never mints twice — later calls recover the same identity", async () => {
    const bindings = fakeBindings();
    setEdgeRnBindings(bindings);
    const store = new InMemorySecretStore();

    const first = await ensureSyncIdentity(store);
    const second = await ensureSyncIdentity(store);
    const third = await ensureSyncIdentity(store);

    expect(bindings.mints).toBe(1);
    expect(second.minted).toBe(false);
    expect(third.minted).toBe(false);
    expect(second.nodeId).toBe(first.nodeId);
    expect(third.nodeId).toBe(first.nodeId);
  });

  it("keeps the secret in the store and hands back only the public half", async () => {
    setEdgeRnBindings(fakeBindings());
    const store = new InMemorySecretStore();

    const identity = await ensureSyncIdentity(store);

    const stored = await store.getItem(SECRET_KEYS.syncNodeKey);
    expect(stored).toBe("PRIVATE1");
    // The secret must not be reachable through the returned value.
    // The fake names the two halves so that one cannot be a substring
    // of the other — otherwise this assertion passes for free.
    expect(JSON.stringify(identity)).not.toContain("PRIVATE1");
  });

  /**
   * A status card rendering must not create an identity. Minting is
   * something a person does while setting the device up.
   */
  it("peeking does not mint", async () => {
    const bindings = fakeBindings();
    setEdgeRnBindings(bindings);
    const store = new InMemorySecretStore();

    expect(await peekSyncIdentity(store)).toBeNull();
    expect(bindings.mints).toBe(0);

    await ensureSyncIdentity(store);
    expect(await peekSyncIdentity(store)).toBe("pub1");
    expect(bindings.mints).toBe(1);
  });

  it("forgetting clears the identity so a reset device mints afresh", async () => {
    const bindings = fakeBindings();
    setEdgeRnBindings(bindings);
    const store = new InMemorySecretStore();

    const first = await ensureSyncIdentity(store);
    await forgetSyncIdentity(store);

    expect(await peekSyncIdentity(store)).toBeNull();

    const second = await ensureSyncIdentity(store);
    expect(second.minted).toBe(true);
    expect(second.nodeId).not.toBe(first.nodeId);
    expect(bindings.mints).toBe(2);
  });
});
