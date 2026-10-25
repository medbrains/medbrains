import { describe, expect, it } from "vitest";
import { MAX_RECORDS, readRecords } from "./read-records";

describe("readRecords", () => {
  it("accepts a bare list and a records object", () => {
    const rec = { kind: "visit", external_id: "V1" };
    expect(readRecords(JSON.stringify([rec]))).toEqual([rec]);
    expect(readRecords(JSON.stringify({ records: [rec] }))).toEqual([rec]);
  });

  it("names the first record without a kind or external id", () => {
    const text = JSON.stringify([{ kind: "visit", external_id: "V1" }, { kind: "visit" }]);
    expect(() => readRecords(text)).toThrow("Record 2 needs a kind and an external_id.");
  });

  it("refuses empty, non-JSON and oversized files", () => {
    expect(() => readRecords("[]")).toThrow("no records");
    expect(() => readRecords("{oops")).toThrow("not valid JSON");
    const many = Array.from({ length: MAX_RECORDS + 1 }, (_, i) => ({
      kind: "patient",
      external_id: `P${i}`,
    }));
    expect(() => readRecords(JSON.stringify(many))).toThrow("split it into batches");
  });
});
