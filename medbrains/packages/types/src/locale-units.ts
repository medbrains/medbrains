// Locale / Units types — split out of index.ts, re-exported from the @medbrains/types barrel.

// Locale / Units
export type MeasurementSystem = "metric" | "imperial";
export type TemperatureUnit = "celsius" | "fahrenheit";
export type WeightUnit = "kg" | "lbs";
export type HeightUnit = "cm" | "in";

export interface LocaleConfig {
  measurement_system: MeasurementSystem;
  temperature_unit: TemperatureUnit;
  weight_unit: WeightUnit;
  height_unit: HeightUnit;
  date_format: string;
}

/** Where a profile field's value came from, most specific first. */
export type LocaleProfileSource = "user" | "facility" | "hospital" | "pack";

/** The profile fields (RFC-WORLD-READY §2.2), stored at `locale/<key>`. */
export interface LocaleProfileValues {
  country?: string;
  region?: string;
  pack_version?: string;
  currency?: string;
  locale?: string;
  languages?: string[];
  timezone?: string;
  calendars?: { primary: string; also: string[] };
  hour_cycle?: "h12" | "h23";
  week_start?: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  fiscal_year_start?: number;
  name_order?: "given_family" | "family_given";
}

/**
 * The resolved locale profile `/api/auth/me` serves: user › facility ›
 * hospital › country pack. A field in `missing` has no value anywhere and is
 * rendered neutrally (ISO code, UTC labelled), never guessed.
 */
export interface LocaleProfile {
  /** The pack in force: the country's, or `world`. */
  pack: string;
  values: LocaleProfileValues;
  sources: Partial<Record<keyof LocaleProfileValues, LocaleProfileSource>>;
  missing: (keyof LocaleProfileValues)[];
  units: Record<string, unknown>;
  date_format: string | null;
}

export interface GeoState {
  id: string;
  country_id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface GeoDistrict {
  id: string;
  state_id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface GeoSubdistrict {
  id: string;
  district_id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface GeoTown {
  id: string;
  subdistrict_id: string;
  code: string;
  name: string;
  pincode: string | null;
  is_active: boolean;
}

export interface PincodeResult {
  town_id: string;
  town_name: string;
  pincode: string;
  subdistrict_id: string;
  subdistrict_name: string;
  district_id: string;
  district_name: string;
  state_id: string;
  state_name: string;
  country_id: string;
  country_name: string;
}

export interface RegulatoryBody {
  id: string;
  code: string;
  name: string;
  level: "international" | "national" | "state" | "education";
  country_id: string | null;
  state_id: string | null;
  description: string | null;
  is_active: boolean;
}
