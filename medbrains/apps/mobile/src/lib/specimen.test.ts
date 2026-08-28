import { describe, expect, it } from "vitest";
import {
  assignBarcode,
  canComplete,
  primaryBarcode,
  type Specimen,
  unlabelledCount,
} from "./specimen.js";

const tubes = (): Specimen[] => [
  { sampleId: "s1", barcode: "", collected: false },
  { sampleId: "s2", barcode: "", collected: false },
  { sampleId: "s3", barcode: "", collected: false },
];

describe("assignBarcode", () => {
  it("labels the tube that was asked for, not the first unlabelled one", () => {
    // The bug this replaces: scanning the third tube recorded against the
    // first, which is exactly the swap this step exists to prevent.
    const result = assignBarcode(tubes(), "s3", "SAM-0003");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.samples.find((s) => s.sampleId === "s3")?.barcode).toBe("SAM-0003");
      expect(result.samples.find((s) => s.sampleId === "s1")?.barcode).toBe("");
    }
  });

  it("refuses a label already on another tube", () => {
    // Two specimens carrying one label means one is mislabelled, and afterwards
    // there is no way to tell which.
    const first = assignBarcode(tubes(), "s1", "SAM-0001");
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = assignBarcode(first.samples, "s2", "SAM-0001");
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toContain("already on another tube");
    }
  });

  it("allows rescanning the same tube with the same label", () => {
    // Correcting or confirming the tube in your hand is not a clash.
    const first = assignBarcode(tubes(), "s1", "SAM-0001");
    if (!first.ok) throw new Error("setup failed");
    const again = assignBarcode(first.samples, "s1", "SAM-0001");
    expect(again.ok).toBe(true);
  });

  it("refuses an empty read rather than marking the tube collected", () => {
    const result = assignBarcode(tubes(), "s1", "   ");
    expect(result.ok).toBe(false);
  });

  it("refuses a tube that is no longer on the collection", () => {
    expect(assignBarcode(tubes(), "gone", "SAM-9999").ok).toBe(false);
  });

  it("does not mutate the caller's array", () => {
    const input = tubes();
    assignBarcode(input, "s1", "SAM-0001");
    expect(input[0]?.barcode).toBe("");
  });
});

describe("canComplete", () => {
  it("is false while any tube is unlabelled", () => {
    const partial = assignBarcode(tubes(), "s1", "SAM-0001");
    if (!partial.ok) throw new Error("setup failed");
    expect(canComplete(partial.samples)).toBe(false);
  });

  it("is true once every tube carries its own label", () => {
    let samples: Specimen[] = tubes();
    for (const [index, id] of ["s1", "s2", "s3"].entries()) {
      const next = assignBarcode(samples, id, `SAM-000${index + 1}`);
      if (!next.ok) throw new Error("setup failed");
      samples = next.samples;
    }
    expect(canComplete(samples)).toBe(true);
  });

  it("is false for an empty collection", () => {
    // Completing a collection with no tubes would record a draw that never
    // happened.
    expect(canComplete([])).toBe(false);
  });
});

describe("unlabelledCount", () => {
  it("counts what is still outstanding", () => {
    const partial = assignBarcode(tubes(), "s2", "SAM-0002");
    if (!partial.ok) throw new Error("setup failed");
    expect(unlabelledCount(partial.samples)).toBe(2);
  });
});

describe("primaryBarcode", () => {
  it("sends the first labelled tube, which is the one drawn first", () => {
    expect(
      primaryBarcode([
        { sampleId: "s1", barcode: "TUBE-A", collected: true },
        { sampleId: "s2", barcode: "TUBE-B", collected: true },
      ]),
    ).toBe("TUBE-A");
  });

  it("skips tubes that were never labelled rather than sending an empty string", () => {
    // An empty barcode written to the order would read downstream as a
    // barcode that exists and matches nothing.
    expect(
      primaryBarcode([
        { sampleId: "s1", barcode: "   ", collected: false },
        { sampleId: "s2", barcode: "TUBE-B", collected: true },
      ]),
    ).toBe("TUBE-B");
  });

  it("is undefined when nothing was labelled, so the order keeps what it had", () => {
    expect(primaryBarcode([{ sampleId: "s1", barcode: "", collected: false }])).toBeUndefined();
    expect(primaryBarcode([])).toBeUndefined();
  });

  it("trims, because a scanner can return trailing whitespace", () => {
    expect(primaryBarcode([{ sampleId: "s1", barcode: " TUBE-A \n", collected: true }])).toBe(
      "TUBE-A",
    );
  });
});
