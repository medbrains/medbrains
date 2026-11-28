import { describe, expect, it } from "vitest";
import { brandingSettingsFormSchema, MAX_BRAND_MARK_CHARS } from "./hms-forms";

/** A valid form with one mark field replaced. */
function withMark(logo_url: string) {
  return brandingSettingsFormSchema.safeParse({
    display_name: "Example Care Centre",
    primary_color: "#0F62FE",
    secondary_color: "#1E293B",
    logo_url,
    name_banner_url: "",
  });
}

describe("branding marks", () => {
  it("accepts empty, an https address, and PNG, JPEG or WebP data URLs", () => {
    for (const value of [
      "",
      "https://example.org/emblem.png",
      "data:image/png;base64,AAAA",
      "data:image/jpeg;base64,AAAA",
      "data:image/webp;base64,AA==",
    ]) {
      expect(withMark(value).success, value).toBe(true);
    }
  });

  it("refuses SVG, text, script and plain http", () => {
    for (const value of [
      "data:image/svg+xml;base64,AAAA",
      "data:text/plain;base64,AAAA",
      "data:text/html,<script>",
      "javascript:alert(1)",
      "http://example.org/emblem.png",
    ]) {
      expect(withMark(value).success, value).toBe(false);
    }
  });

  it("refuses an image over the size cap", () => {
    const huge = `data:image/png;base64,${"A".repeat(MAX_BRAND_MARK_CHARS)}`;
    expect(withMark(huge).success).toBe(false);
  });
});
