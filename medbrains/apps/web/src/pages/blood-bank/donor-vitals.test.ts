import { describe, expect, it } from "vitest";
import { donorVitalsRefusal } from "./donor-vitals";

const fit = { systolic: 120, diastolic: 80, pulse: 72, temperatureC: 36.8 };

describe("donorVitalsRefusal", () => {
  it("lets a donor inside every D&C limit through, edges included", () => {
    expect(donorVitalsRefusal(fit)).toBeNull();
    expect(
      donorVitalsRefusal({ systolic: 100, diastolic: 50, pulse: 60, temperatureC: 37.5 }),
    ).toBeNull();
    expect(donorVitalsRefusal({ systolic: 180, diastolic: 100, pulse: 100 })).toBeNull();
  });

  it("needs BP and pulse measured today", () => {
    expect(donorVitalsRefusal({ ...fit, diastolic: undefined })).toMatch(/Record blood pressure/);
    expect(donorVitalsRefusal({ ...fit, pulse: undefined })).toMatch(/Record blood pressure/);
  });

  it("defers outside BP 100–180 / 50–100, pulse 60–100, or with fever", () => {
    expect(donorVitalsRefusal({ ...fit, systolic: 99 })).toMatch(/Blood pressure 99\/80/);
    expect(donorVitalsRefusal({ ...fit, systolic: 181 })).toMatch(/Defer/);
    expect(donorVitalsRefusal({ ...fit, diastolic: 49 })).toMatch(/Defer/);
    expect(donorVitalsRefusal({ ...fit, diastolic: 101 })).toMatch(/Defer/);
    expect(donorVitalsRefusal({ ...fit, pulse: 59 })).toMatch(/Pulse 59/);
    expect(donorVitalsRefusal({ ...fit, pulse: 101 })).toMatch(/Pulse 101/);
    expect(donorVitalsRefusal({ ...fit, temperatureC: 37.6 })).toMatch(/afebrile/);
  });
});
