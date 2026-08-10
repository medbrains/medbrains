import { describe, expect, it } from "vitest";
import {
  holdsPatientDetail,
  IDLE_INPUT_TIMEOUT_MS,
  isScannable,
  normaliseScan,
  RESULT_TIMEOUT_MS,
} from "./kiosk-session";

describe("holdsPatientDetail", () => {
  it("is true once a check-in has succeeded", () => {
    expect(holdsPatientDetail("done")).toBe(true);
  });

  it("is true for a failure too", () => {
    // The error can name the appointment date, which tells the lobby that
    // someone holding that code was here.
    expect(holdsPatientDetail("failed")).toBe(true);
  });

  it("is false while nothing personal is on screen", () => {
    expect(holdsPatientDetail("waiting")).toBe(false);
    expect(holdsPatientDetail("checking")).toBe(false);
  });
});

describe("normaliseScan", () => {
  it("takes the payload before the scanner's newline", () => {
    expect(normaliseScan("APPT-12345\n")).toBe("APPT-12345");
  });

  it("ignores a second fire when the sheet is waved across the beam", () => {
    expect(normaliseScan("APPT-12345\nAPPT-12345\n")).toBe("APPT-12345");
  });

  it("handles a carriage return as well as a newline", () => {
    expect(normaliseScan("APPT-999\r\n")).toBe("APPT-999");
  });

  it("trims surrounding whitespace", () => {
    expect(normaliseScan("  APPT-1  ")).toBe("APPT-1");
  });

  it("is empty for an empty read rather than throwing", () => {
    expect(normaliseScan("")).toBe("");
    expect(normaliseScan("\n")).toBe("");
  });
});

describe("isScannable", () => {
  it("accepts any non-empty code", () => {
    // Deliberately permissive: the server decides whether a code is real, and
    // rejecting an unfamiliar shape here strands a patient at a machine that
    // will not explain itself.
    expect(isScannable("APPT-1")).toBe(true);
    expect(isScannable("anything-at-all")).toBe(true);
  });

  it("rejects whitespace only", () => {
    expect(isScannable("   ")).toBe(false);
    expect(isScannable("")).toBe(false);
  });
});

describe("timeouts", () => {
  it("clears a result well inside a minute", () => {
    // Long enough to read a token and photograph the QR, short enough that a
    // patient who walks away does not leave their name in front of the lobby.
    expect(RESULT_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
    expect(RESULT_TIMEOUT_MS).toBeGreaterThanOrEqual(20_000);
  });

  it("clears an abandoned half-typed entry too", () => {
    // A partial identifier is still an identifier.
    expect(IDLE_INPUT_TIMEOUT_MS).toBeGreaterThan(RESULT_TIMEOUT_MS);
  });
});
