import type { CodeBlueEventRow, EmergencyCodeActivation } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { fromEmergencyCode, openCodes, registerTap } from "./emergency-flash-logic.js";

const codeBlue: CodeBlueEventRow = {
  id: "cb1",
  patient_id: "p1",
  location: "Ward 1",
  started_at: "2026-09-06T10:00:00Z",
};
const fire: EmergencyCodeActivation = {
  id: "er1",
  code_type: "code_red",
  activated_at: "2026-09-06T09:59:00Z",
  deactivated_at: null,
  location: "Kitchen",
  outcome: null,
};

describe("which code owns the screen", () => {
  it("a code blue outranks a fire that was called first", () => {
    const open = openCodes([codeBlue], [fire], new Set());
    expect(open[0]?.codeBlueId).toBe("cb1");
    expect(open[1]?.label).toBe("CODE RED");
  });

  it("silencing one code does not silence the other", () => {
    const open = openCodes([codeBlue], [fire], new Set(["cb:cb1"]));
    expect(open.map((c) => c.key)).toEqual(["er:er1"]);
  });

  it("a code the phone has never heard of is still an alarm, in words", () => {
    const c = fromEmergencyCode({ ...fire, code_type: "code_silver" });
    expect(c.label).toBe("CODE SILVER");
    expect(c.colour).toBeTruthy();
  });

  it("code black is labelled — the word, never the colour alone", () => {
    const c = fromEmergencyCode({ ...fire, code_type: "code_black" });
    expect(c.label).toBe("CODE BLACK");
    expect(c.ink).not.toBe(c.colour);
  });
});

describe("triple-tap to silence", () => {
  it("three quick taps silence", () => {
    let s = registerTap([], 0);
    s = registerTap(s.taps, 200);
    s = registerTap(s.taps, 400);
    expect(s.triple).toBe(true);
    expect(s.taps).toEqual([]);
  });

  it("three taps spread over more than the window do not", () => {
    let s = registerTap([], 0);
    s = registerTap(s.taps, 500);
    s = registerTap(s.taps, 1000);
    expect(s.triple).toBe(false);
  });

  it("a slow tap then two quick ones is not a triple either", () => {
    let s = registerTap([], 0);
    s = registerTap(s.taps, 900);
    s = registerTap(s.taps, 1000);
    expect(s.triple).toBe(false);
    expect(s.taps).toHaveLength(2);
  });
});
