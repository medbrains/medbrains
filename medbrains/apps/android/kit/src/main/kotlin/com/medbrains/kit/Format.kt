package com.medbrains.kit

import java.math.BigDecimal
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.chrono.HijrahChronology
import java.time.chrono.HijrahDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Currency
import java.util.Locale

/**
 * The one set of money, number, date and time formatters on Android
 * (RFC-WORLD-READY §4.1). `java.text` and `java.time` run on the platform's
 * ICU and CLDR data on a device and on the JDK's CLDR data in unit tests.
 * Each takes the hospital's profile, so no screen picks a locale, currency or
 * zone. Money is `BigDecimal`, never a `Double`.
 *
 * Neutral rendering: no currency shows the bare number; no zone shows UTC and
 * says "UTC". Never a guessed country.
 */
object Format {
    private val UTC: ZoneId = ZoneId.of("UTC")
    /** Most decimals a stored amount carries (money columns are `numeric(_,4)`). */
    private const val MAX_DECIMALS = 4

    /** The profile's locale, English when it names none. */
    private fun locale(p: LocaleProfile): Locale = Locale.forLanguageTag(p.values.locale ?: "en")

    /** The facility's zone, or null when the profile has none or names one this device does not know. */
    private fun knownZone(p: LocaleProfile): ZoneId? =
        p.values.timezone?.let { runCatching { ZoneId.of(it) }.getOrNull() }

    /** The zone times are shown in: the facility's, else UTC (labelled). */
    private fun zone(p: LocaleProfile): ZoneId = knownZone(p) ?: UTC

    /** " UTC" whenever UTC stands in for the facility's zone, so a neutral time or date never reads as local. */
    private fun zoneLabel(p: LocaleProfile): String = if (knownZone(p) == null) " UTC" else ""

    /** The decimals an amount carries, so a bill never hides the paisa it was charged. */
    private fun decimalsIn(amount: BigDecimal): Int = amount.stripTrailingZeros().scale().coerceIn(0, MAX_DECIMALS)

    /** Money in the hospital's currency with its ISO 4217 minor units (KWD 3, JPY 0). */
    fun money(amount: BigDecimal, p: LocaleProfile): String {
        val code = p.values.currency
        val f = if (code == null) NumberFormat.getNumberInstance(locale(p)) else NumberFormat.getCurrencyInstance(locale(p))
        val minor = code?.let { runCatching { Currency.getInstance(it) }.getOrNull() }?.let {
            f.currency = it
            it.defaultFractionDigits.coerceAtLeast(0)
        } ?: 2
        f.minimumFractionDigits = minor
        f.maximumFractionDigits = maxOf(minor, decimalsIn(amount))
        return f.format(amount)
    }

    /** Money from the API's decimal string; null when it is not a number. */
    fun money(amount: String, p: LocaleProfile): String? = amount.toBigDecimalOrNull()?.let { money(it, p) }

    /** A plain number grouped as the locale groups. */
    fun number(value: BigDecimal, p: LocaleProfile): String = NumberFormat.getNumberInstance(locale(p)).format(value)

    /** 24- or 12-hour, as the profile's clock says. */
    private fun timePattern(p: LocaleProfile): String = if (p.values.hour_cycle == "h23") "HH:mm" else "hh:mm a"

    /** The date part alone, unlabelled; [date] and [dateTime] add the label once. */
    private fun plainDate(value: Instant, p: LocaleProfile): String =
        DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(locale(p)).format(value.atZone(zone(p)))

    /** An instant as a date in the facility's zone (labelled when UTC stands in: near midnight it can be another day). */
    fun date(value: Instant, p: LocaleProfile): String = plainDate(value, p) + zoneLabel(p)

    /** An instant as a time of day in the facility's zone, never the device's. */
    fun time(value: Instant, p: LocaleProfile): String =
        DateTimeFormatter.ofPattern(timePattern(p), locale(p)).format(value.atZone(zone(p))) + zoneLabel(p)

    /** An instant as date and time in the facility's zone. */
    fun dateTime(value: Instant, p: LocaleProfile): String = "${plainDate(value, p)}, ${time(value, p)}"

    /**
     * The instant in each display calendar the profile adds.
     * ponytail: Hijri (Umm al-Qura) only, the Gulf's need; java.time also has
     * Thai Buddhist and Japanese, add them when a pack asks.
     */
    fun dateAlso(value: Instant, p: LocaleProfile): List<String> =
        p.values.calendars?.also.orEmpty().mapNotNull { id ->
            if (id != "islamic-umalqura") return@mapNotNull null
            val hijri = HijrahDate.from(value.atZone(zone(p)).toLocalDate())
            DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(locale(p))
                .withChronology(HijrahChronology.INSTANCE).format(hijri)
        }

    /** A person's name from its parts in the profile's order; empty parts dropped. */
    fun name(given: String?, family: String?, p: LocaleProfile, middle: String? = null): String {
        val ordered = if (p.values.name_order == "family_given") listOf(family, given, middle) else listOf(given, middle, family)
        return ordered.mapNotNull { it?.trim()?.ifEmpty { null } }.joinToString(" ")
    }
}
