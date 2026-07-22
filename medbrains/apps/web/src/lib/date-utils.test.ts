import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateAge,
  formatDate,
  isPast,
  isToday,
  nextOccurrence,
  parseDate,
  relativeTime,
  toDateString,
  todayDateString,
} from "./date-utils";

/** Every test that depends on "now" pins it, so none of this rots. */
const NOW = new Date(2026, 6, 22, 10, 0, 0); // 22 July 2026, local

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("calculateAge", () => {
  /**
   * Age is completed years. Before this was fixed the function subtracted
   * calendar years, so anyone whose birthday had not yet come round read a
   * year older — a child born in December was wrong for eleven months of the
   * year, and paediatric dosing bands key off age.
   */
  it("does not count a year until the birthday has come round", () => {
    expect(calculateAge("2020-12-25")).toBe("5y"); // turns 6 in December
    expect(calculateAge("2021-07-23")).toBe("4y"); // turns 5 tomorrow
  });

  it("counts the year once the birthday has passed", () => {
    expect(calculateAge("2020-01-15")).toBe("6y");
    expect(calculateAge("2021-07-21")).toBe("5y"); // birthday yesterday
  });

  it("counts the birthday itself", () => {
    expect(calculateAge("2021-07-22")).toBe("5y");
  });

  it("reports months for infants under a year", () => {
    expect(calculateAge("2026-01-22")).toBe("6mo");
    expect(calculateAge("2026-07-22")).toBe("0mo"); // born today
    expect(calculateAge("2026-07-01")).toBe("0mo"); // three weeks old
  });

  it("does not credit a month until its day-of-month arrives", () => {
    // Born on the 25th; on the 22nd the sixth month is still incomplete.
    expect(calculateAge("2025-12-25")).toBe("6mo");
    expect(calculateAge("2025-12-22")).toBe("7mo");
  });

  it("reports years and months for toddlers under three", () => {
    expect(calculateAge("2024-07-22")).toBe("2y 0mo");
    expect(calculateAge("2024-01-22")).toBe("2y 6mo");
    expect(calculateAge("2025-07-22")).toBe("1y 0mo");
  });

  it("handles a leap-day birth without inventing a year", () => {
    // 29 Feb 2024; by 22 July 2026 two birthdays have been observed.
    expect(calculateAge("2024-02-29")).toBe("2y 4mo");
  });

  it("returns an em dash for missing or unparseable input", () => {
    expect(calculateAge(null)).toBe("—");
    expect(calculateAge(undefined)).toBe("—");
    expect(calculateAge("")).toBe("—");
    expect(calculateAge("not-a-date")).toBe("—");
  });
});

describe("toDateString", () => {
  it("formats in local time, so the day never shifts", () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toDateString(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });

  it("returns empty for absent input", () => {
    expect(toDateString(null)).toBe("");
    expect(toDateString(undefined)).toBe("");
  });

  it("todayDateString agrees with the frozen clock", () => {
    expect(todayDateString()).toBe("2026-07-22");
  });
});

describe("parseDate", () => {
  it("parses YYYY-MM-DD at local midnight", () => {
    const d = parseDate("2026-07-22");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(6);
    expect(d?.getDate()).toBe(22);
    expect(d?.getHours()).toBe(0);
  });

  it("returns null for absent or unparseable input", () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("nonsense")).toBeNull();
  });

  /**
   * QUIRK: the pattern check only enforces the shape, and the Date
   * constructor rolls overflowing components forward rather than failing. An
   * impossible calendar date is therefore accepted and silently becomes a
   * different, real one.
   */
  it("QUIRK: an impossible date rolls forward instead of being rejected", () => {
    const d = parseDate("2026-02-30");
    expect(d).not.toBeNull();
    expect(toDateString(d)).toBe("2026-03-02");
    expect(toDateString(parseDate("2025-02-29"))).toBe("2025-03-01"); // 2025 is not a leap year
  });
});

describe("formatDate", () => {
  it("returns an em dash rather than blank for missing or invalid input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("renders a real date", () => {
    // Locale-dependent, so assert the parts rather than an exact string.
    const out = formatDate("2026-07-22");
    expect(out).toContain("2026");
    expect(out).not.toBe("—");
  });
});

describe("isToday / isPast", () => {
  it("isToday compares calendar day, not instant", () => {
    expect(isToday("2026-07-22")).toBe(true);
    expect(isToday(new Date(2026, 6, 22, 23, 59))).toBe(true);
    expect(isToday("2026-07-21")).toBe(false);
  });

  /**
   * QUIRK: a date-only string parses to local midnight, and midnight today is
   * already behind a 10:00 clock. So today's date is simultaneously "today"
   * and "past" — anything treating isPast as "overdue" flags same-day items
   * from one second after midnight.
   */
  it("QUIRK: today's date is both today and past", () => {
    expect(isToday("2026-07-22")).toBe(true);
    expect(isPast("2026-07-22")).toBe(true);
  });

  it("isPast is otherwise the obvious comparison", () => {
    expect(isPast("2026-07-21")).toBe(true);
    expect(isPast("2026-07-23")).toBe(false);
  });
});

describe("relativeTime", () => {
  it("describes recent past and near future symmetrically", () => {
    expect(relativeTime(new Date(NOW.getTime() - 30_000))).toBe("just now");
    expect(relativeTime(new Date(NOW.getTime() - 5 * 60_000))).toBe("5m ago");
    expect(relativeTime(new Date(NOW.getTime() + 5 * 60_000))).toBe("in 5m");
    expect(relativeTime(new Date(NOW.getTime() - 3 * 3600_000))).toBe("3h ago");
    expect(relativeTime(new Date(NOW.getTime() + 2 * 86400_000))).toBe("in 2d");
  });

  it("floors rather than rounds, so 119 minutes reads as 1h", () => {
    expect(relativeTime(new Date(NOW.getTime() - 119 * 60_000))).toBe("1h ago");
    expect(relativeTime(new Date(NOW.getTime() - 59_999))).toBe("just now");
  });
});

describe("nextOccurrence", () => {
  /** The month argument is zero-based, matching the Date constructor. */
  it("returns this year when the date is still ahead", () => {
    const d = nextOccurrence(11, 25); // 25 December
    expect(toDateString(d)).toBe("2026-12-25");
  });

  it("rolls to next year when the date has passed", () => {
    const d = nextOccurrence(0, 26); // 26 January, already gone
    expect(toDateString(d)).toBe("2027-01-26");
  });
});
