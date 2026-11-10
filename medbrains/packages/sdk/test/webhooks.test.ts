import { describe, expect, it } from "vitest";
import { sign, verifySignature } from "../src/webhooks.js";

// The same vector the server's own test pins (medbrains-outbox handlers/webhook.rs).
const VECTOR = "t=1700000000,v1=49f24e537407743fa4a0242bb63b94b9a47ee99cbbe071ccd8a22550ae411686";

describe("webhook signatures", () => {
  it("matches the server's signature byte for byte", () => {
    expect(sign("secret", 1_700_000_000, '{"a":1}')).toBe(VECTOR);
  });

  it("accepts a fresh, correct delivery", () => {
    expect(verifySignature({ secret: "secret", header: VECTOR, body: '{"a":1}', now: 1_700_000_100 })).toEqual({ ok: true, timestamp: 1_700_000_000 });
  });

  it("refuses a replay outside the window, a changed body, a wrong secret and no header", () => {
    const base = { secret: "secret", header: VECTOR, body: '{"a":1}', now: 1_700_000_000 };
    expect(verifySignature({ ...base, now: 1_700_000_301 }).ok).toBe(false);
    expect(verifySignature({ ...base, body: '{"a":2}' }).ok).toBe(false);
    expect(verifySignature({ ...base, secret: "other" }).ok).toBe(false);
    expect(verifySignature({ ...base, header: undefined }).ok).toBe(false);
    expect(verifySignature({ ...base, header: "t=1700000000,v1=zz" }).ok).toBe(false);
  });
});
