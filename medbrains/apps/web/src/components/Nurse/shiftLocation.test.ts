import { ApiError } from "@medbrains/api";
import type { PunchLocation } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { describePunch, formatDistance, isGeofenceRefusal, readPunchFix } from "./shiftLocation";

function geo(answer: {
  coords?: Partial<GeolocationCoordinates>;
  errorCode?: number;
}): Geolocation {
  return {
    getCurrentPosition: (ok, fail) => {
      if (answer.errorCode !== undefined) {
        fail?.({ code: answer.errorCode } as GeolocationPositionError);
      } else {
        ok({ coords: answer.coords } as GeolocationPosition);
      }
    },
  } as Geolocation;
}

function loc(over: Partial<PunchLocation>): PunchLocation {
  return {
    lat: 13.08,
    lng: 80.27,
    accuracy_m: 20,
    distance_m: 40,
    inside: true,
    place: "inside",
    facility_id: "f1",
    facility_name: "Sunrise Hospital",
    flagged: false,
    ...over,
  };
}

describe("readPunchFix", () => {
  it("sends the device's position and its own accuracy", async () => {
    const out = await readPunchFix(
      geo({ coords: { latitude: 13.08, longitude: 80.27, accuracy: 25 } }),
    );
    expect(out).toEqual({ fix: { latitude: 13.08, longitude: 80.27, accuracy_m: 25 } });
  });

  it("tells a refused permission apart from a failed fix, without throwing", async () => {
    expect(await readPunchFix(geo({ errorCode: 1 }))).toEqual({ fix: null, reason: "denied" });
    expect(await readPunchFix(geo({ errorCode: 3 }))).toEqual({ fix: null, reason: "unavailable" });
    expect(await readPunchFix(undefined)).toEqual({ fix: null, reason: "unavailable" });
  });
});

describe("describePunch", () => {
  it("names the campus when on site", () => {
    expect(describePunch(loc({}))).toEqual({
      label: "On site · Sunrise Hospital",
      tone: "success",
    });
  });

  it("says how far away an outside punch was, in the server's words", () => {
    expect(describePunch(loc({ place: "outside", inside: false, distance_m: 6042 }))).toEqual({
      label: "Outside · 6.0 km from Sunrise Hospital",
      tone: "warning",
    });
  });

  it("warns on an uncertain fix and on a punch with no location", () => {
    expect(describePunch(loc({ place: "uncertain", inside: null, accuracy_m: 900 }))?.label).toBe(
      "Location uncertain (±900 m)",
    );
    expect(describePunch(loc({ place: "no_location", lat: null, lng: null }))?.tone).toBe(
      "warning",
    );
  });

  it("shows nothing when the hospital does not check location", () => {
    expect(describePunch(loc({ place: "not_checked", inside: null }))).toBeNull();
    expect(describePunch(null)).toBeNull();
  });
});

describe("formatDistance", () => {
  it("matches the server's rounding", () => {
    expect(formatDistance(240.4)).toBe("240 m");
    expect(formatDistance(6042)).toBe("6.0 km");
  });
});

describe("isGeofenceRefusal", () => {
  it("is a 403 from the shift endpoint, not any failure", () => {
    expect(isGeofenceRefusal(new ApiError("You are 6.0 km from X.", 403))).toBe(true);
    expect(isGeofenceRefusal(new ApiError("oops", 500))).toBe(false);
    expect(isGeofenceRefusal(new Error("network"))).toBe(false);
  });
});
