import { describe, expect, it } from "vitest";
import { sequenceSettingsFormSchema } from "./hms-forms";

const form = (pad_width: number | string) => ({ seq_type: "uhid", prefix: "", pad_width });

describe("sequence pad width", () => {
  it("accepts 0 (no padding) through 10", () => {
    for (const pad of [0, 3, 10]) {
      expect(sequenceSettingsFormSchema.safeParse(form(pad)).success).toBe(true);
    }
  });

  it("rejects -1, 11 and an empty field", () => {
    for (const pad of [-1, 11, ""]) {
      expect(sequenceSettingsFormSchema.safeParse(form(pad)).success).toBe(false);
    }
  });
});
