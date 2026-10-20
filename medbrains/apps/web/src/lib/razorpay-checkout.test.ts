import { afterEach, describe, expect, it } from "vitest";
import {
  loadRazorpayCheckout,
  pollUntil,
  RAZORPAY_CHECKOUT_SRC,
  resetRazorpayCheckout,
} from "./razorpay-checkout";

function checkoutScripts() {
  return Array.from(document.head.querySelectorAll(`script[src="${RAZORPAY_CHECKOUT_SRC}"]`));
}

afterEach(() => {
  for (const s of checkoutScripts()) s.remove();
  delete window.Razorpay;
  resetRazorpayCheckout();
});

describe("loadRazorpayCheckout", () => {
  it("adds checkout.js once, however many payments ask for it", async () => {
    const first = loadRazorpayCheckout();
    const second = loadRazorpayCheckout();
    expect(checkoutScripts()).toHaveLength(1);
    const ctor = class {
      open() {}
    };
    window.Razorpay = ctor;
    checkoutScripts()[0]?.dispatchEvent(new Event("load"));
    await expect(first).resolves.toBe(ctor);
    await expect(second).resolves.toBe(ctor);
  });

  it("uses Razorpay already on the page without loading anything", async () => {
    const ctor = class {
      open() {}
    };
    window.Razorpay = ctor;
    await expect(loadRazorpayCheckout()).resolves.toBe(ctor);
    expect(checkoutScripts()).toHaveLength(0);
  });

  it("says so when the script cannot load, and lets the next attempt retry", async () => {
    const failed = loadRazorpayCheckout();
    checkoutScripts()[0]?.dispatchEvent(new Event("error"));
    await expect(failed).rejects.toThrow("could not be loaded");
    loadRazorpayCheckout();
    expect(checkoutScripts()).toHaveLength(2);
  });
});

describe("pollUntil", () => {
  it("backs off, doubling up to the cap, and stops once the value is final", async () => {
    const waits: number[] = [];
    const answers = ["created", "created", "created", "created", "captured"];
    const result = await pollUntil(
      async () => answers.shift() ?? "never",
      (s) => s === "captured",
      { initialDelayMs: 100, maxDelayMs: 400, sleep: async (ms) => void waits.push(ms) },
    );
    expect(result).toBe("captured");
    expect(waits).toEqual([100, 200, 400, 400, 400]);
  });

  it("gives up after its bound instead of waiting forever", async () => {
    let reads = 0;
    const result = await pollUntil(
      async () => {
        reads += 1;
        return "authorized";
      },
      (s) => s === "captured",
      { maxAttempts: 3, sleep: async () => {} },
    );
    expect(result).toBeNull();
    expect(reads).toBe(3);
  });
});
