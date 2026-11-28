/** The `/geo` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  GeoCountry,
  GeoDistrict,
  GeoState,
  GeoSubdistrict,
  GeoTown,
  PincodeResult,
  RegulatoryBody,
} from "@medbrains/types";
import { request } from "../client.js";

export const geoApi = {
  // Geo
  geoCountries: () => request<GeoCountry[]>("/geo/countries"),
  geoStates: (countryId: string) => request<GeoState[]>(`/geo/countries/${countryId}/states`),
  geoDistricts: (stateId: string) => request<GeoDistrict[]>(`/geo/states/${stateId}/districts`),
  geoSubdistricts: (districtId: string) =>
    request<GeoSubdistrict[]>(`/geo/districts/${districtId}/subdistricts`),
  geoTowns: (subdistrictId: string) =>
    request<GeoTown[]>(`/geo/subdistricts/${subdistrictId}/towns`),
  searchPincode: (pincode: string) =>
    request<PincodeResult[]>(`/geo/pincode/${encodeURIComponent(pincode)}`),
  geoRegulators: () => request<RegulatoryBody[]>("/geo/regulators"),
  geoAutoDetectRegulators: (params: { country_id?: string; state_id?: string }) => {
    const qs = new URLSearchParams();
    if (params.country_id) qs.set("country_id", params.country_id);
    if (params.state_id) qs.set("state_id", params.state_id);
    return request<{ regulators: RegulatoryBody[] }>(
      `/geo/regulators/auto-detect?${qs.toString()}`,
    );
  },
};
