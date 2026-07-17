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
  currency: string;
  timezone: string;
  locale: string;
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
