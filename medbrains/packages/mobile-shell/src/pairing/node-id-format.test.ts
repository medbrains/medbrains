import { describe, expect, it } from "vitest";
import { groupForReading } from "./node-id-format.js";

describe("groupForReading", () => {
  /**
   * The whole reason this exists: an administrator reads the id aloud
   * or types it across a ward. Grouping is presentation only — if it
   * ever altered the value, the wrong key would get bound and the
   * device would look paired and never connect.
   */
  it("changes only the spacing, never the characters", () => {
    const id = "abcdefghijklmnopqrstuvwxyz012345";
    expect(groupForReading(id).replace(/ /g, "")).toBe(id);
  });

  it("splits into fixed groups", () => {
    expect(groupForReading("aaaabbbbccccdddd", 4)).toBe("aaaa  bbbb  cccc  dddd");
  });

  it("keeps a short trailing group rather than padding it", () => {
    expect(groupForReading("aaaabbbbcc", 4)).toBe("aaaa  bbbb  cc");
  });

  it("leaves an id shorter than one group alone", () => {
    expect(groupForReading("abc", 8)).toBe("abc");
  });

  /**
   * A zero or negative size would loop forever. Returning the id
   * unchanged is the only sane reading of "do not group".
   */
  it("does not hang on a nonsensical group size", () => {
    expect(groupForReading("abcdef", 0)).toBe("abcdef");
    expect(groupForReading("abcdef", -4)).toBe("abcdef");
  });
});
