import { describe, expect, it } from "vitest";
import {
  celsiusToFahrenheit,
  cmToIn,
  fahrenheitToCelsius,
  getHeightConfig,
  getTemperatureConfig,
  getWeightConfig,
  heightToCm,
  inToCm,
  kgToLbs,
  lbsToKg,
  weightToKg,
} from "./vital-units";

/**
 * Patient weight, height and temperature. The backend stores metric, so these
 * conversions sit between what a clinician types and what is persisted — a
 * wrong answer here is a wrong weight in the chart, and weight drives dosing.
 */

describe("conversion against known reference values", () => {
  it("weight", () => {
    expect(kgToLbs(1)).toBeCloseTo(2.20462, 5);
    expect(kgToLbs(70)).toBeCloseTo(154.3234, 3);
    expect(lbsToKg(2.20462)).toBeCloseTo(1, 5);
    expect(lbsToKg(154.3234)).toBeCloseTo(70, 3);
  });

  it("height", () => {
    expect(inToCm(1)).toBeCloseTo(2.54, 10);
    expect(cmToIn(2.54)).toBeCloseTo(1, 10);
    expect(inToCm(70)).toBeCloseTo(177.8, 10);
  });

  it("temperature", () => {
    expect(celsiusToFahrenheit(37)).toBeCloseTo(98.6, 10);
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(-40)).toBe(-40);
    expect(fahrenheitToCelsius(98.6)).toBeCloseTo(37, 10);
    expect(fahrenheitToCelsius(32)).toBe(0);
    expect(fahrenheitToCelsius(-40)).toBe(-40);
  });
});

describe("round trips do not drift", () => {
  it("survives a there-and-back conversion within display precision", () => {
    for (const kg of [0.5, 3.2, 70, 120.7, 500]) {
      expect(lbsToKg(kgToLbs(kg))).toBeCloseTo(kg, 9);
    }
    for (const cm of [20, 50.5, 175, 300]) {
      expect(cmToIn(inToCm(cmToIn(cm) * 2.54) / 2.54)).toBeCloseTo(cmToIn(cm), 9);
      expect(inToCm(cmToIn(cm))).toBeCloseTo(cm, 9);
    }
    for (const c of [35.5, 37, 38.9, 41]) {
      expect(fahrenheitToCelsius(celsiusToFahrenheit(c))).toBeCloseTo(c, 9);
    }
  });

  it("zero and negatives pass through the maths unguarded", () => {
    // No clamping happens here — range enforcement lives in the config min/max.
    expect(kgToLbs(0)).toBe(0);
    expect(weightToKg(0, "lbs")).toBe(0);
    expect(kgToLbs(-5)).toBeCloseTo(-11.0231, 4);
  });
});

describe("display unit to storage unit", () => {
  it("converts lbs to kg and inches to cm", () => {
    expect(weightToKg(154.3234, "lbs")).toBeCloseTo(70, 3);
    expect(heightToCm(70, "in")).toBeCloseTo(177.8, 10);
  });

  it("passes metric through untouched", () => {
    expect(weightToKg(70, "kg")).toBe(70);
    expect(heightToCm(177.8, "cm")).toBe(177.8);
  });

  /**
   * QUIRK: both helpers branch only on the imperial unit and fall through to
   * "already metric" for everything else. If a third unit were ever added
   * (grams, stone, feet) and not handled here, its value would be stored
   * unconverted rather than rejected — a silent wrong weight, not an error.
   */
  it("QUIRK: an unhandled unit is stored unconverted rather than rejected", () => {
    expect(weightToKg(70, "stone" as never)).toBe(70);
    expect(heightToCm(70, "ft" as never)).toBe(70);
  });
});

describe("unit configs", () => {
  it("temperature config switches range with the unit", () => {
    const c = getTemperatureConfig("celsius");
    const f = getTemperatureConfig("fahrenheit");
    expect(c.unit).toBe("°C");
    expect(f.unit).toBe("°F");
    expect(c.normalRange).toEqual([36.1, 37.2]);
    expect(f.normalRange).toEqual([97.0, 99.0]);
  });

  it("the two temperature ranges describe the same physical band", () => {
    const c = getTemperatureConfig("celsius");
    const f = getTemperatureConfig("fahrenheit");
    // Converting the Celsius normal band lands inside the Fahrenheit one,
    // so a patient is not "normal" in one unit and "abnormal" in the other.
    expect(celsiusToFahrenheit(c.normalRange[0])).toBeCloseTo(96.98, 1);
    expect(celsiusToFahrenheit(c.normalRange[1])).toBeCloseTo(98.96, 1);
    expect(celsiusToFahrenheit(c.normalRange[0])).toBeGreaterThanOrEqual(f.borderlineRange[0]);
    expect(celsiusToFahrenheit(c.normalRange[1])).toBeLessThanOrEqual(f.borderlineRange[1]);
  });

  it("weight and height ranges are plausible and unit-appropriate", () => {
    expect(getWeightConfig("kg").max).toBe(500);
    expect(getWeightConfig("lbs").max).toBe(1100);
    // 500 kg is about 1102 lbs, so the imperial ceiling is the same patient.
    expect(kgToLbs(getWeightConfig("kg").max)).toBeCloseTo(1102.31, 1);

    expect(getHeightConfig("cm").max).toBe(300);
    expect(getHeightConfig("in").max).toBe(120);
    expect(cmToIn(getHeightConfig("cm").max)).toBeCloseTo(118.11, 1);
  });

  it("weight and height carry no clinical normal range, unlike temperature", () => {
    // 0..9999 is a deliberate "no banding" sentinel: normal weight depends on
    // age and build, so the recorder must not colour it as abnormal.
    expect(getWeightConfig("kg").normalRange).toEqual([0, 9999]);
    expect(getHeightConfig("cm").normalRange).toEqual([0, 9999]);
  });
});

/**
 * There is no `temperatureToCelsius(value, unit)` to match `weightToKg` and
 * `heightToCm`. That asymmetry is the point of this test: weight and height
 * have a display-to-storage step, temperature does not, so any caller working
 * in Fahrenheit has to convert by hand before persisting.
 */
describe("storage-conversion coverage", () => {
  it("weight and height have a display-to-storage helper; temperature does not", async () => {
    const mod = await import("./vital-units");
    expect(typeof mod.weightToKg).toBe("function");
    expect(typeof mod.heightToCm).toBe("function");
    expect("temperatureToCelsius" in mod).toBe(false);
  });
});
