import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./return-path";

const FALLBACK = "/opd";

describe("choosing where back goes", () => {
  it("returns an in-app path unchanged, query and hash included", () => {
    expect(safeReturnPath("/camp/abc/work?patient_id=p1#registrations", FALLBACK)).toBe(
      "/camp/abc/work?patient_id=p1#registrations",
    );
  });

  it("falls back when there is no parameter", () => {
    expect(safeReturnPath(null, FALLBACK)).toBe(FALLBACK);
    expect(safeReturnPath("", FALLBACK)).toBe(FALLBACK);
  });

  it("refuses anything that leaves the application", () => {
    // Each of these is accepted by navigate() or the browser as an
    // off-site destination despite looking path-shaped.
    for (const hostile of [
      "//evil.example/steal",
      "/\\evil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "/javascript:alert(1)",
      "../../etc",
    ]) {
      expect(safeReturnPath(hostile, FALLBACK), `${hostile} must not be followed`).toBe(FALLBACK);
    }
  });
});
