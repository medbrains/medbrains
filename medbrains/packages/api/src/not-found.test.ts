// @vitest-environment node

import { describe, expect, it } from "vitest";
import { ApiError, nullOn404 } from "./client.js";

/**
 * Reads whose record may not exist yet used to be written
 * `.catch(() => null)`, which cannot tell absence from failure — the thrown
 * Error carried no status. A 403 or a 500 therefore rendered exactly like a
 * 404, and a screen that offers to create the record when it reads null would
 * invite a second discharge summary for a patient who already has one.
 */

describe("ApiError", () => {
  it("carries the status alongside the message", () => {
    const error = new ApiError("not found", 404);
    expect(error.status).toBe(404);
    expect(error.message).toBe("not found");
  });

  it("is still an Error, so existing handlers keep working", () => {
    const error = new ApiError("boom", 500);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
  });
});

describe("nullOn404", () => {
  it("turns a 404 into null", () => {
    expect(nullOn404(new ApiError("not found", 404))).toBeNull();
  });

  /**
   * The regression that matters: every other failure must propagate, so the
   * caller shows an error instead of an empty create form.
   */
  it.each([
    ["forbidden", 403],
    ["unauthorized", 401],
    ["conflict", 409],
    ["server error", 500],
  ])("rethrows %s (%i) instead of reporting absence", (message, status) => {
    expect(() => nullOn404(new ApiError(message, status))).toThrow(message);
  });

  it("rethrows a non-ApiError, such as a network failure", () => {
    expect(() => nullOn404(new TypeError("Failed to fetch"))).toThrow("Failed to fetch");
  });

  it("resolves to null inside a promise chain on a 404", async () => {
    const result = await Promise.reject(new ApiError("nope", 404)).catch(nullOn404);
    expect(result).toBeNull();
  });

  it("rejects the promise chain on a 500", async () => {
    await expect(Promise.reject(new ApiError("down", 500)).catch(nullOn404)).rejects.toThrow(
      "down",
    );
  });
});
