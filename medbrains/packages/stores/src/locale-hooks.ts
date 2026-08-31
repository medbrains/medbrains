import type {
  HeightUnit,
  LocaleConfig,
  MeasurementSystem,
  TemperatureUnit,
  WeightUnit,
} from "@medbrains/types";
import { useLocaleStore } from "./locale-store.js";

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
