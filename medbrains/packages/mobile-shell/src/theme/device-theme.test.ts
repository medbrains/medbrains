import { blue, emergencyCodes, mint } from "@medbrains/design-system/tokens";
import { describe, expect, it } from "vitest";
import { buildDeviceTheme, DEVICE_PALETTE, deviceTheme, EMERGENCY_CODES } from "./device-theme.js";

describe("device theme", () => {
  it("palette IS the Carbon design-system source (drift-proof)", () => {
    // Assert against the tokens, not hard-coded hexes — so the palette can never silently diverge
    // from the web design system again.
    expect(DEVICE_PALETTE.brand).toBe(blue[5]); // #0f62fe
    expect(DEVICE_PALETTE.brandHover).toBe(blue[6]);
    expect(DEVICE_PALETTE.emerald).toBe(mint[4]); // Carbon support-success
    expect(DEVICE_PALETTE.tint).toBe(blue[0]);
  });

  it("emergency codes are the fixed single source (cardiac blue is NOT the brand blue)", () => {
    expect(EMERGENCY_CODES).toBe(emergencyCodes);
    expect(EMERGENCY_CODES.blue).toBe("#1E63B8");
    expect(EMERGENCY_CODES.blue).not.toBe(DEVICE_PALETTE.brand);
  });

  it("light theme maps primary + background", () => {
    const theme = buildDeviceTheme("light");
    expect(theme.colors.primary).toBe(DEVICE_PALETTE.brand);
    expect(theme.colors.background).toBe(DEVICE_PALETTE.canvas);
    expect(theme.roundness).toBe(2); // Carbon sharp corners
  });

  it("dark theme keeps the brand but flips the canvas", () => {
    const theme = buildDeviceTheme("dark");
    expect(theme.colors.primary).toBe(DEVICE_PALETTE.brand);
    expect(theme.colors.background).not.toBe(DEVICE_PALETTE.canvas);
  });

  it("form-factor presets scale type: TV > kiosk > mobile", () => {
    const size = (factor: "tv" | "kiosk" | "mobile") =>
      (deviceTheme(factor).fonts.bodyLarge as { fontSize: number }).fontSize;
    expect(size("tv")).toBeGreaterThan(size("kiosk"));
    expect(size("kiosk")).toBeGreaterThan(size("mobile"));
  });
});
