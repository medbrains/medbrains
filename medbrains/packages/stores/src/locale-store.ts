import type {
  HeightUnit,
  LocaleConfig,
  MeasurementSystem,
  TemperatureUnit,
  WeightUnit,
} from "@medbrains/types";
import { create } from "zustand";

interface TenantSettingRow {
  category: string;
  key: string;
  value: unknown;
}

interface LocaleState {
  config: LocaleConfig;
  setFromTenantSettings: (rows: TenantSettingRow[]) => void;
  setConfig: (partial: Partial<LocaleConfig>) => void;
}

const DEFAULT_CONFIG: LocaleConfig = {
  measurement_system: "metric",
  temperature_unit: "celsius",
  weight_unit: "kg",
  height_unit: "cm",
  date_format: "DD/MM/YYYY",
  currency: "INR",
  timezone: "Asia/Kolkata",
  locale: "en",
};

function extractString(value: unknown): string | null {
  if (typeof value === "string") return value;
  // JSONB values come as JSON-encoded strings: "\"metric\""
  if (typeof value === "object" && value !== null) return null;
  return null;
}

export const useLocaleStore = create<LocaleState>()((set) => ({
  config: { ...DEFAULT_CONFIG },

  setFromTenantSettings: (rows) => {
    set((state) => {
      const next = { ...state.config };

      for (const row of rows) {
        const val = extractString(row.value);
        if (!val) continue;

        if (row.category === "units") {
          switch (row.key) {
            case "measurement_system":
              next.measurement_system = val as MeasurementSystem;
              break;
            case "temperature_unit":
              next.temperature_unit = val as TemperatureUnit;
              break;
            case "weight_unit":
              next.weight_unit = val as WeightUnit;
              break;
            case "height_unit":
              next.height_unit = val as HeightUnit;
              break;
          }
        } else if (row.category === "locale") {
          switch (row.key) {
            case "date_format":
              next.date_format = val;
              break;
          }
        }
      }

      return { config: next };
    });
  },

  setConfig: (partial) => {
    set((state) => ({
      config: { ...state.config, ...partial },
    }));
  },
}));
