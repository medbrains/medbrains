import { NEWS2_BANDS } from "@medbrains/schemas";
import type { HeightUnit, TemperatureUnit, WeightUnit } from "@medbrains/types";

// ── Conversion helpers ──

export function kgToLbs(kg: number): number {
  return kg * 2.20462;
}

export function lbsToKg(lbs: number): number {
  return lbs / 2.20462;
}

export function cmToIn(cm: number): number {
  return cm / 2.54;
}

export function inToCm(inches: number): number {
  return inches * 2.54;
}

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9;
}

// ── Unit configuration for vitals ──

export interface VitalUnitConfig {
  unit: string;
  min: number;
  max: number;
  step: number;
  precision: number;
  normalRange: readonly [number, number];
  borderlineRange: readonly [number, number];
}

/**
 * A °C range as the °F readings that fall in it: a °F reading counts when it
 * converts to a °C value which, rounded to one decimal as the NEWS2 chart is,
 * lies in the range. So 96.9 °F (36.06 °C, charted 36.1) is normal.
 */
function fahrenheitRange([low, high]: readonly [number, number]): [number, number] {
  /** `c` °C in °F, rounded to a tenth in the direction `round` gives. */
  const tenths = (c: number, round: (x: number) => number) =>
    round(celsiusToFahrenheit(c) * 10) / 10;
  return [tenths(low - 0.05, Math.ceil), tenths(high + 0.05, Math.floor)];
}

/** Input limits and NEWS2 grading bands for temperature in the hospital's unit. */
export function getTemperatureConfig(tempUnit: TemperatureUnit): VitalUnitConfig {
  if (tempUnit === "fahrenheit") {
    return {
      unit: "°F",
      min: 90,
      max: 110,
      step: 0.1,
      precision: 1,
      normalRange: fahrenheitRange(NEWS2_BANDS.temperature.normal),
      borderlineRange: fahrenheitRange(NEWS2_BANDS.temperature.borderline),
    };
  }
  return {
    unit: "°C",
    min: 32,
    max: 43,
    step: 0.1,
    precision: 1,
    // NEWS2 temperature bands (`pages/opd/vitals-thresholds` names them).
    normalRange: NEWS2_BANDS.temperature.normal,
    borderlineRange: NEWS2_BANDS.temperature.borderline,
  };
}

export function getWeightConfig(weightUnit: WeightUnit): VitalUnitConfig {
  if (weightUnit === "lbs") {
    return {
      unit: "lbs",
      min: 1,
      max: 1100,
      step: 0.01,
      precision: 2,
      normalRange: [0, 9999],
      borderlineRange: [0, 9999],
    };
  }
  // To the gram: a preterm baby is dosed per kg, and 0.1 kg is 8% of 1.2 kg.
  // From 0.3 kg, the lowest weight history import accepts as plausible.
  return {
    unit: "kg",
    min: 0.3,
    max: 500,
    step: 0.001,
    precision: 3,
    normalRange: [0, 9999],
    borderlineRange: [0, 9999],
  };
}

export function getHeightConfig(heightUnit: HeightUnit): VitalUnitConfig {
  if (heightUnit === "in") {
    return {
      unit: "in",
      min: 8,
      max: 120,
      step: 0.1,
      precision: 1,
      normalRange: [0, 9999],
      borderlineRange: [0, 9999],
    };
  }
  return {
    unit: "cm",
    min: 20,
    max: 300,
    step: 0.1,
    precision: 1,
    normalRange: [0, 9999],
    borderlineRange: [0, 9999],
  };
}

/**
 * Convert weight from display unit to storage unit (kg).
 * Backend always stores in kg.
 */
export function weightToKg(value: number, unit: WeightUnit): number {
  return unit === "lbs" ? lbsToKg(value) : value;
}

/**
 * Convert height from display unit to storage unit (cm).
 * Backend always stores in cm.
 */
export function heightToCm(value: number, unit: HeightUnit): number {
  return unit === "in" ? inToCm(value) : value;
}
