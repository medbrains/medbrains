/**
 * The one set of money, number, date and time formatters for the web
 * (RFC-WORLD-READY §4.1). Each takes the hospital's locale profile, so no
 * screen picks a locale, currency or zone of its own. Built on the browser's
 * `Intl` (its CLDR data); this is the only module that constructs one.
 *
 * Neutral rendering: a profile without a currency shows the bare number, and
 * one without a time zone shows UTC and says "UTC". Never a guessed country.
 */

/** The profile fields these formatters read; `LocaleProfile["values"]` fits. */
export interface FormatProfile {
  locale?: string;
  currency?: string;
  timezone?: string;
  hour_cycle?: "h12" | "h23";
  calendars?: { primary: string; also: string[] };
  name_order?: "given_family" | "family_given";
}

/** A money amount: a decimal string (as the API sends `numeric`) or a number. */
export type Amount = string | number;

/** The language tag formatting falls back to when the profile names none. */
const NEUTRAL_LOCALE = "en";
const UTC = "UTC";
/** Bound on cached formatters: a screen uses a handful, a session a few dozen. */
const CACHE_LIMIT = 64;

const numberCache = new Map<string, Intl.NumberFormat>();
const dateCache = new Map<string, Intl.DateTimeFormat>();

/** One cached formatter per (kind, locale, options); building them is the slow part. */
function cached<F>(cache: Map<string, F>, key: string, make: () => F): F {
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  const made = make();
  cache.set(key, made);
  return made;
}

/** The profile's locale, or the neutral one when it is missing or unusable. */
function localeOf(profile: FormatProfile): string {
  const tag = profile.locale;
  if (!tag) return NEUTRAL_LOCALE;
  return Intl.NumberFormat.supportedLocalesOf([tag]).length > 0 ? tag : NEUTRAL_LOCALE;
}

/** A cached number formatter for the locale and options. */
function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  return cached(
    numberCache,
    `${locale}|${JSON.stringify(options)}`,
    () => new Intl.NumberFormat(locale, options),
  );
}

/**
 * `Intl` formats a decimal string exactly (no float rounding), which is how
 * money must travel; the ES2022 typings only admit numbers.
 */
function formatExact(fmt: Intl.NumberFormat, amount: Amount): string {
  return (fmt.format as (value: Amount) => string)(amount);
}

/** Most decimals any stored amount carries (money columns are `numeric(_,4)` at most). */
const MAX_DECIMALS = 4;

/** The non-zero decimals an amount carries: "12.50" has 1, "12.345" has 3. */
function decimalsIn(amount: Amount): number {
  const text = typeof amount === "number" ? String(amount) : amount;
  const fraction = text.split(".")[1]?.replace(/0+$/, "") ?? "";
  return Math.min(fraction.length, MAX_DECIMALS);
}

/**
 * Money in the hospital's currency, with that currency's minor units (KWD 3,
 * JPY 0), and never fewer decimals than the amount carries: CLDR shows IDR or
 * PKR without decimals, and a bill must not hide the paisa it was charged.
 * Without a currency in the profile, the number alone: never a guessed symbol.
 */
export function formatMoney(amount: Amount, profile: FormatProfile): string {
  const locale = localeOf(profile);
  const base: Intl.NumberFormatOptions = profile.currency
    ? { style: "currency", currency: profile.currency }
    : { minimumFractionDigits: 2 };
  const minimum = numberFormat(locale, base).resolvedOptions().minimumFractionDigits ?? 0;
  const options = { ...base, maximumFractionDigits: Math.max(minimum, decimalsIn(amount)) };
  return formatExact(numberFormat(locale, options), amount);
}

/** A plain number, grouped as the locale groups (12,34,567 in en-IN). */
export function formatNumber(
  value: Amount,
  profile: FormatProfile,
  options: Intl.NumberFormatOptions = {},
): string {
  return formatExact(numberFormat(localeOf(profile), options), value);
}

type DateStyle = "date" | "dateTime" | "time";

const STYLE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  date: { year: "numeric", month: "short", day: "numeric" },
  dateTime: { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
  time: { hour: "2-digit", minute: "2-digit" },
};

const zoneKnown = new Map<string, boolean>();

/**
 * The profile's zone when this browser knows it, else undefined (UTC stands
 * in, labelled). The server stores only IANA names, but an older browser may
 * lack a new zone; `Intl` throws on one, and a screen must never go blank.
 */
function zoneOf(profile: FormatProfile): string | undefined {
  const zone = profile.timezone;
  if (!zone) return undefined;
  let known = zoneKnown.get(zone);
  if (known === undefined) {
    try {
      new Intl.DateTimeFormat(NEUTRAL_LOCALE, { timeZone: zone });
      known = true;
    } catch {
      known = false;
    }
    if (zoneKnown.size < CACHE_LIMIT) zoneKnown.set(zone, known);
  }
  return known ? zone : undefined;
}

/** A cached date formatter in the profile's locale, zone and clock, optionally in another calendar. */
function dateFormat(
  profile: FormatProfile,
  style: DateStyle,
  calendar?: string,
): Intl.DateTimeFormat {
  const locale = localeOf(profile);
  const timeZone = zoneOf(profile) ?? UTC;
  const options: Intl.DateTimeFormatOptions = {
    ...STYLE_OPTIONS[style],
    timeZone,
    ...(style !== "date" && profile.hour_cycle ? { hourCycle: profile.hour_cycle } : {}),
    ...(calendar ? { calendar } : {}),
  };
  return cached(
    dateCache,
    `${locale}|${style}|${timeZone}|${profile.hour_cycle ?? ""}|${calendar ?? ""}`,
    () => new Intl.DateTimeFormat(locale, options),
  );
}

/** " UTC" whenever UTC stands in for the facility's zone, so a neutral time or date never reads as local. */
function zoneLabel(profile: FormatProfile): string {
  return zoneOf(profile) ? "" : ` ${UTC}`;
}

/** The instant a value names, or undefined when it names none. */
function instantOf(value: string | Date): Date | undefined {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Format an instant, or show a value that is not one as it came: a bad date
 * from the server must read as itself, never take the screen down.
 */
function formatInstant(value: string | Date, profile: FormatProfile, style: DateStyle): string {
  const d = instantOf(value);
  if (!d) return typeof value === "string" ? value : "";
  return dateFormat(profile, style).format(d) + zoneLabel(profile);
}

/**
 * An instant (ISO string or Date) as a date in the facility's zone; labelled
 * when UTC stands in (near midnight it can be another day).
 */
export function formatDate(value: string | Date, profile: FormatProfile): string {
  return formatInstant(value, profile, "date");
}

/** An instant as date and time in the facility's zone (RFC §4.1: never the device's). */
export function formatDateTime(value: string | Date, profile: FormatProfile): string {
  return formatInstant(value, profile, "dateTime");
}

/** An instant as a time of day in the facility's zone. */
export function formatTime(value: string | Date, profile: FormatProfile): string {
  return formatInstant(value, profile, "time");
}

/**
 * A date-only value (`YYYY-MM-DD`: a birth date, an LMP). It is a calendar
 * day, not an instant, so no zone ever shifts it; anything else shows as it came.
 */
export function formatCalendarDate(day: string, profile: FormatProfile): string {
  const d = instantOf(`${day}T00:00:00Z`);
  return d ? dateFormat({ ...profile, timezone: UTC }, "date").format(d) : day;
}

/** The same instant in each display calendar the profile adds (Hijri beside Gregorian). */
export function formatDateAlso(value: string | Date, profile: FormatProfile): string[] {
  const d = instantOf(value);
  if (!d) return [];
  const also = profile.calendars?.also ?? [];
  return also.map((calendar) => dateFormat(profile, "date", calendar).format(d));
}

/** A person's name from its parts, in the profile's order; empty parts dropped. */
export function formatName(
  parts: { given?: string | null; middle?: string | null; family?: string | null },
  profile: FormatProfile,
): string {
  const given = [parts.given, parts.middle];
  const ordered =
    profile.name_order === "family_given" ? [parts.family, ...given] : [...given, parts.family];
  return ordered
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
}
