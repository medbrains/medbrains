import { describe, expect, it } from "vitest";
import {
  type FormatProfile,
  formatCalendarDate,
  formatDate,
  formatDateAlso,
  formatDateTime,
  formatMoney,
  formatName,
  formatNumber,
  formatTime,
} from "./index";

// Goldens for the six locales #5926 names. Spaces matter: CLDR puts a
// no-break space (U+00A0) or a narrow one (U+202F) where a reader sees a gap,
// and Arabic carries right-to-left marks (U+200F).
const PROFILES: Record<string, FormatProfile> = {
  "en-IN": { locale: "en-IN", currency: "INR", timezone: "Asia/Kolkata", hour_cycle: "h12" },
  "en-US": { locale: "en-US", currency: "USD", timezone: "America/New_York", hour_cycle: "h12" },
  "ar-AE": { locale: "ar-AE", currency: "AED", timezone: "Asia/Dubai", hour_cycle: "h12" },
  "de-DE": { locale: "de-DE", currency: "EUR", timezone: "Europe/Berlin", hour_cycle: "h23" },
  "fr-FR": { locale: "fr-FR", currency: "EUR", timezone: "Europe/Paris", hour_cycle: "h23" },
  "id-ID": { locale: "id-ID", currency: "IDR", timezone: "Asia/Jakarta", hour_cycle: "h23" },
};

const INSTANT = "2026-03-05T18:30:00Z";

describe("formatMoney", () => {
  it.each([
    ["en-IN", "₹12,34,567.50"],
    ["en-US", "$1,234,567.50"],
    ["ar-AE", "‏1,234,567.50 د.إ.‏"],
    ["de-DE", "1.234.567,50 €"],
    ["fr-FR", "1 234 567,50 €"],
    // CLDR shows rupiah without decimals; a stored half rupiah still shows.
    ["id-ID", "Rp 1.234.567,5"],
  ])("%s", (locale, expected) => {
    expect(formatMoney("1234567.50", PROFILES[locale] ?? {})).toBe(expected);
  });

  it("keeps a currency's minor units and formats the decimal string exactly", () => {
    const kuwait = { locale: "en", currency: "KWD" };
    expect(formatMoney("12.5", kuwait)).toBe("KWD 12.500");
    expect(formatMoney("0.1234", kuwait)).toBe("KWD 0.1234");
    // A float would print 9007199254740993 as ...992.
    expect(formatMoney("9007199254740993", { locale: "en", currency: "INR" })).toBe(
      "₹9,007,199,254,740,993.00",
    );
  });

  it("shows the bare number when the profile has no currency, never a guessed one", () => {
    expect(formatMoney("1500", { locale: "en-IN" })).toBe("1,500.00");
    expect(formatMoney(1500, {})).toBe("1,500.00");
  });
});

describe("formatNumber", () => {
  it("groups as the locale groups", () => {
    expect(formatNumber("1234567", PROFILES["en-IN"] ?? {})).toBe("12,34,567");
    expect(formatNumber("1234567", PROFILES["de-DE"] ?? {})).toBe("1.234.567");
  });
});

describe("dates and times", () => {
  it.each([
    ["en-IN", "6 Mar 2026, 12:00 am"],
    ["en-US", "Mar 5, 2026, 01:30 PM"],
    ["ar-AE", "5 مارس 2026، 10:30 م"],
    ["de-DE", "5. März 2026, 19:30"],
    ["fr-FR", "5 mars 2026, 19:30"],
    ["id-ID", "6 Mar 2026, 01.30"],
  ])("%s shows the instant in the facility's zone", (locale, expected) => {
    expect(formatDateTime(INSTANT, PROFILES[locale] ?? {})).toBe(expected);
  });

  it("labels UTC when the profile has no zone, so it never reads as local", () => {
    expect(formatTime(INSTANT, { locale: "en-GB" })).toBe("18:30 UTC");
    expect(formatDateTime(INSTANT, { locale: "en-GB" })).toBe("5 Mar 2026, 18:30 UTC");
  });

  it("never shifts a date-only value by a zone", () => {
    const honolulu = { locale: "en-US", timezone: "Pacific/Honolulu" };
    expect(formatCalendarDate("2026-03-05", honolulu)).toBe("Mar 5, 2026");
    expect(formatDate("2026-03-05T00:00:00Z", honolulu)).toBe("Mar 4, 2026");
  });

  it("adds the Hijri date beside the Gregorian one when the profile asks", () => {
    const dubai = {
      ...PROFILES["ar-AE"],
      calendars: { primary: "gregory", also: ["islamic-umalqura"] },
    };
    expect(formatDateAlso(INSTANT, dubai)).toEqual(["16 رمضان 1447 هـ"]);
    expect(formatDateAlso(INSTANT, PROFILES["en-IN"] ?? {})).toEqual([]);
  });
});

describe("formatName", () => {
  it("orders the parts by the profile", () => {
    const parts = { given: "Mei", middle: null, family: "Tanaka" };
    expect(formatName(parts, { name_order: "given_family" })).toBe("Mei Tanaka");
    expect(formatName(parts, { name_order: "family_given" })).toBe("Tanaka Mei");
  });
});
