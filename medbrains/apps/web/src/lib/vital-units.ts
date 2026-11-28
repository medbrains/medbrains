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
  normalRange: [number, number];
  borderlineRange: [number, number];
}

export function getTemperatureConfig(tempUnit: TemperatureUnit): VitalUnitConfig {
  if (tempUnit === "fahrenheit") {
    return {
      unit: "°F",
      min: 90,
      max: 110,
      step: 0.1,
      precision: 1,
      normalRange: [97.0, 99.0],
      borderlineRange: [96.0, 100.4],
    };
  }
  return {
    unit: "°C",
    min: 32,
    max: 43,
    step: 0.1,
    precision: 1,
    normalRange: [36.1, 37.2],
    borderlineRange: [35.5, 38.0],
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
