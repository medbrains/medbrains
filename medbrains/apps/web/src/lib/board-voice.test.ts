import { describe, expect, it } from "vitest";
import { callPhrase, spokenNumber, unspeakable } from "./board-voice";

describe("board voice", () => {
  it("reads a token one character at a time", () => {
    expect(spokenNumber("T-014")).toBe("T 0 1 4");
    expect(spokenNumber("GEN-100")).toBe("G E N 1 0 0");
  });

  it("names the place in each language", () => {
    expect(callPhrase("en", "W-001", "Window 2")).toBe("Token W 0 0 1, please come to Window 2.");
    expect(callPhrase("hi", "W-001", "Window 2")).toContain("W 0 0 1");
    expect(callPhrase("ta", "W-001")).toBe("டோக்கன் W 0 0 1.");
  });

  it("skips a language the screen has no voice for, but not before voices load", () => {
    const englishOnly = [{ lang: "en-IN" }, { lang: "en-US" }];
    expect(unspeakable(["en", "ta"], englishOnly)).toEqual(["ta"]);
    expect(unspeakable(["en", "ta"], [])).toEqual([]);
  });
});
