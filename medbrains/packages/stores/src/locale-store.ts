import type {
  HeightUnit,
  LocaleConfig,
  LocaleProfile,
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

/**
 * Where the locale profile stands: still loading, resolved, or failed. A
 * failed load is said on screen; it never falls back to a country (RFC-WORLD-READY §2.3).
 */
export type LocaleProfileStatus = "loading" | "ready" | "failed";

interface LocaleState {
  config: LocaleConfig;
  /** The resolved profile from `/api/auth/me`; `null` until it arrives or when it failed. */
  profile: LocaleProfile | null;
  profileStatus: LocaleProfileStatus;
  setFromTenantSettings: (rows: TenantSettingRow[]) => void;
  setProfile: (profile: LocaleProfile | null) => void;
  setConfig: (partial: Partial<LocaleConfig>) => void;
}

/** Units only: money, time zone and locale come from the profile, never a default country. */
const DEFAULT_CONFIG: LocaleConfig = {
  measurement_system: "metric",
  temperature_unit: "celsius",
  weight_unit: "kg",
  height_unit: "cm",
  date_format: "DD/MM/YYYY",
};

/** A setting's value as text, when it is text. */
function extractString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** `config` with one units/locale setting applied; unknown keys leave it as it was. */
function applySetting(config: LocaleConfig, row: TenantSettingRow): LocaleConfig {
  const val = extractString(row.value);
  if (!val) return config;
  if (row.category === "units") {
    switch (row.key) {
      case "measurement_system":
        return { ...config, measurement_system: val as MeasurementSystem };
      case "temperature_unit":
        return { ...config, temperature_unit: val as TemperatureUnit };
      case "weight_unit":
        return { ...config, weight_unit: val as WeightUnit };
      case "height_unit":
        return { ...config, height_unit: val as HeightUnit };
    }
  }
  if (row.category === "locale" && row.key === "date_format") {
    return { ...config, date_format: val };
  }
  return config;
}

/** The profile's units and date format as the rows `applySetting` reads. */
function profileRows(profile: LocaleProfile): TenantSettingRow[] {
  const rows = Object.entries(profile.units).map(([key, value]) => ({
    category: "units",
    key,
    value,
  }));
  if (profile.date_format) {
    rows.push({ category: "locale", key: "date_format", value: profile.date_format });
  }
  return rows;
}

export const useLocaleStore = create<LocaleState>()((set) => ({
  config: { ...DEFAULT_CONFIG },
  profile: null,
  profileStatus: "loading",

  setFromTenantSettings: (rows) => {
    set((state) => ({ config: rows.reduce(applySetting, state.config) }));
  },

  setProfile: (profile) => {
    set((state) => ({
      profile,
      profileStatus: profile ? "ready" : "failed",
      config: profile ? profileRows(profile).reduce(applySetting, state.config) : state.config,
    }));
  },

  setConfig: (partial) => {
    set((state) => ({
      config: { ...state.config, ...partial },
    }));
  },
}));
