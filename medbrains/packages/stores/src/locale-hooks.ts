import type {
  HeightUnit,
  LocaleConfig,
  LocaleProfile,
  MeasurementSystem,
  TemperatureUnit,
  WeightUnit,
} from "@medbrains/types";
import { type LocaleProfileStatus, useLocaleStore } from "./locale-store.js";

/** The resolved locale profile, or `null` while loading or after a failed load. */
export function useLocaleProfile(): LocaleProfile | null {
  return useLocaleStore((s) => s.profile);
}

/** Whether the profile is loading, ready or failed, so a screen can say which. */
export function useLocaleProfileStatus(): LocaleProfileStatus {
  return useLocaleStore((s) => s.profileStatus);
}

export function useLocaleConfig(): LocaleConfig {
  return useLocaleStore((s) => s.config);
}

export function useTemperatureUnit(): TemperatureUnit {
  return useLocaleStore((s) => s.config.temperature_unit);
}

export function useWeightUnit(): WeightUnit {
  return useLocaleStore((s) => s.config.weight_unit);
}

export function useHeightUnit(): HeightUnit {
  return useLocaleStore((s) => s.config.height_unit);
}

export function useMeasurementSystem(): MeasurementSystem {
  return useLocaleStore((s) => s.config.measurement_system);
}
