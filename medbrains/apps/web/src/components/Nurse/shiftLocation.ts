// Where a start or end of shift is made, and how to say what the server
// made of it. Kept apart from the widget so the logic is tested on its own.

import { ApiError } from "@medbrains/api";
import type { PunchFix, PunchLocation } from "@medbrains/types";

/** How long the browser gets to find the device before the punch goes without a fix. */
export const FIX_TIMEOUT_MS = 10_000;
/** A fix this recent is still where the nurse is standing. */
export const FIX_MAX_AGE_MS = 60_000;
/** `GeolocationPositionError.PERMISSION_DENIED`. */
const GEO_PERMISSION_DENIED = 1;
const METRES_PER_KM = 1000;

export type FixOutcome = { fix: PunchFix } | { fix: null; reason: "denied" | "unavailable" };

/** Ask the browser where the device is. Never rejects: no fix is an answer the server judges. */
export function readPunchFix(geo: Geolocation | undefined): Promise<FixOutcome> {
  if (!geo) return Promise.resolve({ fix: null, reason: "unavailable" });
  return new Promise((resolve) => {
    geo.getCurrentPosition(
      (p) =>
        resolve({
          fix: {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            accuracy_m: p.coords.accuracy,
          },
        }),
      (e) =>
        resolve({
          fix: null,
          reason: e.code === GEO_PERMISSION_DENIED ? "denied" : "unavailable",
        }),
      { enableHighAccuracy: true, timeout: FIX_TIMEOUT_MS, maximumAge: FIX_MAX_AGE_MS },
    );
  });
}

/** "6.0 km", "240 m" — the same words the server uses. */
export function formatDistance(metres: number): string {
  return metres >= METRES_PER_KM
    ? `${(metres / METRES_PER_KM).toFixed(1)} km`
    : `${Math.round(metres)} m`;
}

export interface PunchState {
  label: string;
  tone: "success" | "warning";
}

/** What to show for a punch, or null when the hospital does not check location. */
export function describePunch(loc: PunchLocation | null | undefined): PunchState | null {
  if (!loc) return null;
  const site = loc.facility_name ?? "the hospital";
  switch (loc.place) {
    case "inside":
      return { label: `On site · ${site}`, tone: "success" };
    case "outside":
      return {
        label: `Outside · ${formatDistance(loc.distance_m ?? 0)} from ${site}`,
        tone: "warning",
      };
    case "uncertain":
      return {
        label: `Location uncertain (±${formatDistance(loc.accuracy_m ?? 0)})`,
        tone: "warning",
      };
    case "no_location":
      return { label: "No location — allow location access", tone: "warning" };
    default:
      return null;
  }
}

/** The hospital blocks punches from off site, and this one was refused. */
export function isGeofenceRefusal(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 403;
}
