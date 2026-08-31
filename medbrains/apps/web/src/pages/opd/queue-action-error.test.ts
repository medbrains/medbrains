import { describe, expect, it } from "vitest";
import { isStaleRowError } from "./queue-action-error";

/**
 * The wording the server actually sends.
 *
 * `AppError::NotFound` in medbrains-server-core produces
 * `(StatusCode::NOT_FOUND, "not found", "not found")`, and the API client
 * surfaces the third of those as the Error message. A check written against
 * "Not Found" or "404" — the shapes one assumes — matches none of it, and
 * the operator gets the server's bare wording instead of an explanation.
 */
describe("recognising a row that has already moved on", () => {
  it("matches what AppError::NotFound actually serialises to", () => {
    expect(isStaleRowError(new Error("not found"))).toBe(true);
  });

  it("is not case- or whitespace-sensitive", () => {
    expect(isStaleRowError(new Error("Not Found"))).toBe(true);
    expect(isStaleRowError(new Error("  not found  "))).toBe(true);
  });

  it("leaves every other failure to report itself", () => {
    // A permission failure and an outage must not be explained away as
    // "somebody already called them" — they need their own message.
    expect(isStaleRowError(new Error("forbidden"))).toBe(false);
    expect(isStaleRowError(new Error("Request failed: 503"))).toBe(false);
    expect(isStaleRowError(new Error("patient not found in this department"))).toBe(false);
  });
});
