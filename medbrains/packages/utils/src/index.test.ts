import { describe, expect, it } from "vitest";
import {
  capitalize,
  fieldAccessText,
  maskEmail,
  maskIdentifierKeepLast,
  maskName,
  maskPhone,
  mostRestrictedFieldAccess,
  snakeToTitle,
  truncate,
} from "./index";

describe("capitalize", () => {
  it("capitalizes the first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  it("returns empty string unchanged", () => {
    expect(capitalize("")).toBe("");
  });

  it("leaves already-capitalized strings unchanged", () => {
    expect(capitalize("World")).toBe("World");
  });
});

describe("snakeToTitle", () => {
  it("converts snake_case to Title Case", () => {
    expect(snakeToTitle("patient_management")).toBe("Patient Management");
  });

  it("handles single word", () => {
    expect(snakeToTitle("dashboard")).toBe("Dashboard");
  });

  it("handles multiple underscores", () => {
    expect(snakeToTitle("out_patient_department")).toBe("Out Patient Department");
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates long strings with ellipsis", () => {
    expect(truncate("hello world", 6)).toBe("hello\u2026");
  });
});

describe("maskIdentifierKeepLast", () => {
  it("masks identifiers while preserving separators and last segment", () => {
    expect(maskIdentifierKeepLast("AB-1234-5678", 4)).toBe("XX-XXXX-5678");
  });

  it("masks phone numbers while preserving country separators", () => {
    expect(maskPhone("+91 98765 43210")).toBe("+XX XXXXX X3210");
  });

  it("does not invent masked values for empty input", () => {
    expect(maskIdentifierKeepLast("")).toBe("");
    expect(maskName("   ")).toBe("");
  });

  it("masks email local parts while preserving domain context", () => {
    expect(maskEmail("doctor@example.org")).toBe("dXXXXX@example.org");
  });
});

describe("fieldAccessText", () => {
  it("uses the most restrictive field access level across grouped fields", () => {
    expect(mostRestrictedFieldAccess(["edit", "view"])).toBe("view");
    expect(mostRestrictedFieldAccess(["view", "mask", "edit"])).toBe("mask");
    expect(mostRestrictedFieldAccess(["mask", "hidden", "view"])).toBe("hidden");
  });

  it("returns restricted for hidden fields", () => {
    expect(fieldAccessText("hidden", "9876543210", "phone")).toBe("Restricted");
  });

  it("returns a masked phone for mask access", () => {
    expect(fieldAccessText("mask", "9876543210", "phone")).toBe("XXXXXX3210");
  });

  it("returns raw values for view access", () => {
    expect(fieldAccessText("view", "9876543210", "phone")).toBe("9876543210");
  });

  it("returns masked email and amount labels for mask access", () => {
    expect(fieldAccessText("mask", "billing@example.org", "email")).toBe("bXXXXXX@example.org");
    expect(fieldAccessText("mask", "₹1,250.00", "amount")).toBe("Amount masked");
  });
});
