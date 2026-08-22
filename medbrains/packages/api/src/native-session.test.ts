// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { api, clearNativeAuthTokens, configureNativeAuth, setNativeAuthSession } from "./client.js";

/**
 * A 401 must only end the session it was actually answering.
 *
 * Native surfaces seat their token asynchronously: the shell hydrates from the
 * keychain, or a display waits for an administrator to approve its pairing, and
 * either way the first screen has usually already fired its queries. Those go
 * out unauthenticated and come back 401.
 *
 * Clearing on every 401 turned that into a permanent failure. The 401 for the
 * unauthenticated request landed *after* the token had been installed and wiped
 * it, so every later request was unauthenticated too and nothing recovered
 * without a restart. A paired TV showed "queue feed is unreachable" for ever
 * while holding a perfectly good token.
 */

function authHeaderOf(call: unknown): string | undefined {
  const [, init] = call as [string, { headers?: Record<string, string> }];
  return init?.headers?.Authorization;
}

afterEach(() => {
  clearNativeAuthTokens();
  configureNativeAuth(null);
  vi.unstubAllGlobals();
});

describe("a 401 on a request that carried no token", () => {
  it("leaves a token installed while it was in flight alone", async () => {
    configureNativeAuth("test-surface");
    const calls: unknown[][] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((...args: unknown[]) => {
        calls.push(args);
        // The auth bridge lands mid-flight, exactly as it does on a cold start.
        if (calls.length === 1) {
          setNativeAuthSession("token-installed-late", null);
        }
        return Promise.resolve(
          new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
        );
      }),
    );

    await expect(api.me()).rejects.toThrow("session_expired");

    // The proof: the next request still carries the token. Before the fix this
    // was undefined, and stayed undefined for the life of the process.
    await expect(api.me()).rejects.toThrow();
    const retried = calls.filter((call) => String(call[0]).includes("/auth/me"));
    expect(authHeaderOf(retried[retried.length - 1])).toBe("Bearer token-installed-late");
  });
});

describe("a 401 on a request that did carry the current token", () => {
  it("ends the session, because that token has genuinely been refused", async () => {
    configureNativeAuth("test-surface");
    setNativeAuthSession("token-rejected", null);
    const calls: unknown[][] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve(
          new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
        );
      }),
    );

    await expect(api.me()).rejects.toThrow("session_expired");

    // Cleared: a token the server has refused must not be sent again, or a
    // revoked display would keep asking with a credential nobody honours.
    await expect(api.me()).rejects.toThrow();
    const retried = calls.filter((call) => String(call[0]).includes("/auth/me"));
    expect(authHeaderOf(retried[retried.length - 1])).toBeUndefined();
  });
});
