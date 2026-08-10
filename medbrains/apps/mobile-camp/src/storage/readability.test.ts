import { describe, expect, it } from "vitest";
import { campDataState, needsOperatorAttention, readMayDelete } from "./readability.js";

describe("campDataState", () => {
  it("is absent when there is no file", () => {
    expect(campDataState({ fileExists: false, envelopeValid: false, keyPresent: false })).toBe(
      "absent",
    );
  });

  it("is readable when the file and the key are both there", () => {
    expect(campDataState({ fileExists: true, envelopeValid: true, keyPresent: true })).toBe(
      "readable",
    );
  });

  it("is locked when the file survives but the key is gone", () => {
    // An app reinstall or OS restore. The records are still on disk; only the
    // means to read them has been lost.
    expect(campDataState({ fileExists: true, envelopeValid: true, keyPresent: false })).toBe(
      "locked",
    );
  });

  it("is corrupt when the envelope is not ours", () => {
    expect(campDataState({ fileExists: true, envelopeValid: false, keyPresent: true })).toBe(
      "corrupt",
    );
  });
});

describe("needsOperatorAttention", () => {
  it("stays quiet when there is nothing stored", () => {
    // Also the state after a clean sync — this must not cry wolf.
    expect(needsOperatorAttention("absent")).toBe(false);
  });

  it("stays quiet when everything is readable", () => {
    expect(needsOperatorAttention("readable")).toBe(false);
  });

  it("raises on locked and corrupt", () => {
    // The failure this exists for: an empty outbox after a lost key looks
    // exactly like an empty outbox after a successful upload, so somebody has
    // to be told the difference.
    expect(needsOperatorAttention("locked")).toBe(true);
    expect(needsOperatorAttention("corrupt")).toBe(true);
  });
});

describe("readMayDelete", () => {
  it("is never true", () => {
    // Pinning the rule, not the implementation. A read that deletes destroys
    // the only evidence the records existed, on a path nobody reviews as a
    // write.
    expect(readMayDelete()).toBe(false);
  });
});
