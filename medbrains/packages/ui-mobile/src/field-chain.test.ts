import { describe, expect, it } from "vitest";
import {
  canChainByReturnKey,
  needsDoneAccessory,
  nextField,
  returnKeyFor,
  shouldKeepKeyboard,
} from "./field-chain.js";

const CHAIN = ["chief_complaint", "examination", "assessment", "plan"] as const;

describe("nextField", () => {
  it("walks the chain in the order the form reads", () => {
    expect(nextField(CHAIN, "chief_complaint")).toBe("examination");
    expect(nextField(CHAIN, "examination")).toBe("assessment");
    expect(nextField(CHAIN, "assessment")).toBe("plan");
  });

  it("ends at the last field rather than wrapping", () => {
    // Wrapping to the top would send a clinician who just finished the plan
    // back to the complaint, which reads as the form having reset.
    expect(nextField(CHAIN, "plan")).toBeNull();
  });

  it("returns null for a field that is not in the chain", () => {
    expect(nextField(CHAIN, "not_a_field")).toBeNull();
  });
});

describe("returnKeyFor", () => {
  it("says next while there is somewhere to go and done at the end", () => {
    expect(returnKeyFor(CHAIN, "chief_complaint")).toBe("next");
    expect(returnKeyFor(CHAIN, "plan")).toBe("done");
  });
});

describe("shouldKeepKeyboard", () => {
  it("keeps the keyboard up between fields", () => {
    // Dismissing between hops makes a keyboard-avoiding form jump, moving the
    // next field out from under the thumb reaching for it.
    expect(shouldKeepKeyboard(CHAIN, "chief_complaint")).toBe(true);
  });

  it("lets it go after the last one", () => {
    expect(shouldKeepKeyboard(CHAIN, "plan")).toBe(false);
  });
});

describe("needsDoneAccessory", () => {
  it("flags every keyboard that has no return key", () => {
    // The trap that cost a red Detox run: `tapReturnKey()` on a phone-pad does
    // nothing at all, so the keyboard stays up over the submit button.
    for (const keyboard of ["phone-pad", "number-pad", "decimal-pad", "numeric"]) {
      expect(needsDoneAccessory(keyboard), keyboard).toBe(true);
    }
  });

  it("leaves text keyboards to their return key", () => {
    for (const keyboard of ["default", "email-address", "url", undefined]) {
      expect(needsDoneAccessory(keyboard), String(keyboard)).toBe(false);
    }
  });
});

describe("canChainByReturnKey", () => {
  it("chains an ordinary single-line text field", () => {
    expect(canChainByReturnKey({ keyboardType: "default" })).toBe(true);
    expect(canChainByReturnKey({})).toBe(true);
  });

  it("refuses a multi-line field, whose return key belongs to the author", () => {
    // A clinician writing an examination needs newlines. Android's own default
    // for a multi-line input is a carriage return, not an action.
    expect(canChainByReturnKey({ multiline: true })).toBe(false);
  });

  it("refuses a numeric field, which has no return key to press", () => {
    expect(canChainByReturnKey({ keyboardType: "phone-pad" })).toBe(false);
    expect(canChainByReturnKey({ keyboardType: "number-pad", multiline: false })).toBe(false);
  });
});
