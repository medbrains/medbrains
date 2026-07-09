import { describe, expect, it } from "vitest";
import {
  classifyDeviceCategory,
  DEVICE_SURFACES,
  factorOf,
  getSurface,
  isRendered,
  surfacesByClass,
} from "./index.js";

// Mirror of the backend `is_valid_app_variant` (device_pairing.rs): legacy coarse variants, or
// `<Factor>-<Name>` / `Web`. Paired UI surfaces must satisfy it so admin minting can't drift.
function backendAcceptsVariant(code: string): boolean {
  if (["staff", "tv", "vendor", "Web"].includes(code)) return true;
  const [factor, ...rest] = code.split("-");
  return (
    factor !== undefined &&
    ["TV", "Mobile", "Desktop", "Kiosk"].includes(factor) &&
    rest.join("-").length > 0
  );
}

describe("device catalog", () => {
  it("has unique codes", () => {
    const codes = DEVICE_SURFACES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("renders flag is consistent with class", () => {
    for (const s of DEVICE_SURFACES) {
      const headless = s.class.startsWith("headless-");
      expect(s.renders).toBe(!headless);
      // Headless devices are never paired as UI surfaces.
      if (headless) expect(s.pairing).not.toBe("paired_devices");
    }
  });

  it("every paired UI surface matches the backend variant shape", () => {
    for (const s of DEVICE_SURFACES) {
      if (s.pairing === "paired_devices") {
        expect(backendAcceptsVariant(s.code), `${s.code} rejected by backend`).toBe(true);
      }
    }
  });

  it("helpers resolve", () => {
    expect(isRendered("TV-Ward")).toBe(true);
    expect(isRendered("edge-gateway")).toBe(false);
    expect(factorOf("Mobile-Doctor")).toBe("mobile");
    expect(getSurface("TV-Queue")?.class).toBe("ui-display");
    expect(surfacesByClass("ui-display").every((s) => s.factor === "tv")).toBe(true);
    expect(surfacesByClass("ui-display").length).toBeGreaterThan(10);
  });

  it("classifies backend device_category into the taxonomy", () => {
    expect(classifyDeviceCategory("lab_analyzer")).toBe("headless-equipment");
    expect(classifyDeviceCategory("cold_chain_sensor")).toBe("headless-iot");
    expect(classifyDeviceCategory("environment_sensor")).toBe("headless-iot");
    expect(classifyDeviceCategory("queue_display")).toBe("ui-display");
    expect(classifyDeviceCategory("self_checkin_kiosk")).toBe("ui-touch");
    expect(classifyDeviceCategory("bedside_tablet")).toBe("ui-mobile");
  });
});
