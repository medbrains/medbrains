package com.medbrains.kit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/** Goldens for the six locales #5926 names, through the JDK's CLDR data. */
class FormatTest {
    private fun profile(locale: String, currency: String?, zone: String?, h23: Boolean = false) =
        LocaleProfile("world", LocaleProfile.Values(currency = currency, locale = locale, timezone = zone, hour_cycle = if (h23) "h23" else "h12"))

    private val instant = Instant.parse("2026-03-05T18:30:00Z")

    /** Spaces and direction marks vary by data release; compare without them. */
    private fun squash(s: String) = s.filterNot { it.isWhitespace() || it == ' ' || it == ' ' || it == '‏' || it == '‎' }

    @Test fun moneyInEachLocale() {
        // A device's java.text is ICU and groups en-IN in lakhs; the JDK's
        // DecimalFormat has one grouping size, so a JVM test sees 1,234,567.
        val india = squash(Format.money("1234567.50", profile("en-IN", "INR", "UTC"))!!)
        assertTrue(india, india == "₹12,34,567.50" || india == "₹1,234,567.50")
        assertEquals("$1,234,567.50", squash(Format.money("1234567.50", profile("en-US", "USD", "UTC"))!!))
        assertEquals("1.234.567,50€", squash(Format.money("1234567.50", profile("de-DE", "EUR", "UTC"))!!))
        assertEquals("1234567,50€", squash(Format.money("1234567.50", profile("fr-FR", "EUR", "UTC"))!!))
        // ISO 4217 gives the rupiah two decimals.
        assertEquals("Rp1.234.567,50", squash(Format.money("1234567.50", profile("id-ID", "IDR", "UTC"))!!))
        val ae = Format.money("1234567.50", profile("ar-AE", "AED", "Asia/Dubai"))!!
        assertTrue(ae, ae.contains("1,234,567.50") || ae.contains("١٬٢٣٤٬٥٦٧٫٥٠"))
    }

    @Test fun minorUnitsAndExactDecimals() {
        val kuwait = profile("en", "KWD", null)
        assertTrue(squash(Format.money("12.5", kuwait)!!).endsWith("12.500"))
        assertTrue(squash(Format.money("0.1234", kuwait)!!).endsWith("0.1234"))
        assertEquals("₹9,007,199,254,740,993.00", squash(Format.money("9007199254740993", profile("en", "INR", null))!!))
        assertNull(Format.money("twelve", kuwait))
    }

    @Test fun noCurrencyShowsTheBareNumber() {
        assertEquals("1,500.00", Format.money("1500", profile("en-IN", null, null)))
    }

    @Test fun timesInTheFacilitysZone() {
        assertTrue(Format.time(instant, profile("en-IN", null, "Asia/Kolkata")).startsWith("12:00"))
        assertEquals("19:30", Format.time(instant, profile("de-DE", null, "Europe/Berlin", h23 = true)))
        assertEquals("19:30", Format.time(instant, profile("fr-FR", null, "Europe/Paris", h23 = true)))
        assertTrue(Format.time(instant, profile("en-US", null, "America/New_York")).startsWith("01:30"))
        assertEquals("01:30", Format.time(instant, profile("id-ID", null, "Asia/Jakarta", h23 = true)))
        val ae = Format.time(instant, profile("ar-AE", null, "Asia/Dubai"))
        assertTrue(ae, ae.contains("10:30") || ae.contains("١٠:٣٠"))
        assertTrue(Format.date(instant, profile("en-IN", null, "Asia/Kolkata")).contains("6"))
    }

    @Test fun noZoneSaysUtc() {
        assertEquals("18:30 UTC", Format.time(instant, profile("en-GB", null, null, h23 = true)))
    }

    @Test fun hijriBesideGregorian() {
        val dubai = profile("ar-AE", "AED", "Asia/Dubai").let { it.copy(values = it.values.copy(calendars = LocaleProfile.Calendars(also = listOf("islamic-umalqura")))) }
        val also = Format.dateAlso(instant, dubai)
        assertEquals(1, also.size)
        assertTrue(also[0], also[0].contains("1447") || also[0].contains("١٤٤٧"))
        assertEquals(emptyList<String>(), Format.dateAlso(instant, profile("en-IN", "INR", "Asia/Kolkata")))
    }

    @Test fun nameOrder() {
        val p = profile("ja-JP", "JPY", "Asia/Tokyo")
        assertEquals("Mei Tanaka", Format.name("Mei", "Tanaka", p))
        assertEquals("Tanaka Mei", Format.name("Mei", "Tanaka", p.copy(values = p.values.copy(name_order = "family_given"))))
    }

    @Test fun lastGoodProfileIsKeptPerTenant() {
        val disk = mutableMapOf<String, String>()
        val text = object : TextStore {
            override fun read(key: String) = disk[key]
            override fun write(key: String, value: String) { disk[key] = value }
        }
        val store = LocaleProfileStore(text)
        store.useLastGood("t1", "u1")
        assertEquals(LocaleProfileState.UNAVAILABLE, store.state.value)
        assertEquals(LocaleProfile.NEUTRAL, store.profile.value)
        val dubai = profile("ar-AE", "AED", "Asia/Dubai")
        store.adopt(dubai, "t1", "u1")
        val later = LocaleProfileStore(text)
        later.useLastGood("t1", "u1")
        assertEquals(LocaleProfileState.LAST_GOOD, later.state.value)
        assertEquals(dubai, later.profile.value)
        later.useLastGood("t2", "u1")
        assertEquals("another hospital's profile is never borrowed", LocaleProfileState.UNAVAILABLE, later.state.value)
    }

    @Test fun anUnknownZoneFallsBackToLabelledUtc() {
        val bad = profile("en-GB", null, "Mars/Olympus", h23 = true)
        assertEquals("18:30 UTC", Format.time(instant, bad))
        assertTrue(Format.date(instant, bad), Format.date(instant, bad).endsWith(" UTC"))
        assertTrue(Format.date(instant, profile("en-GB", null, null)).endsWith(" UTC"))
        assertTrue(!Format.date(instant, profile("en-GB", null, "Europe/London")).endsWith(" UTC"))
    }

    @Test fun theCacheIsPerUserNotOnlyPerHospital() {
        val disk = mutableMapOf<String, String>()
        val text = object : TextStore {
            override fun read(key: String) = disk[key]
            override fun write(key: String, value: String) { disk[key] = value }
        }
        LocaleProfileStore(text).adopt(profile("ar-AE", "AED", "Asia/Dubai"), "t1", "nurse")
        val other = LocaleProfileStore(text)
        other.useLastGood("t1", "doctor")
        assertEquals("a colleague's facility profile is never borrowed", LocaleProfileState.UNAVAILABLE, other.state.value)
    }

    @Test fun aCancelledRefreshIsRethrownNotReadAsFailure() {
        val store = LocaleProfileStore(object : TextStore {
            override fun read(key: String): String? = null
            override fun write(key: String, value: String) = Unit
        })
        val thrown = runCatching {
            kotlinx.coroutines.runBlocking { store.refreshWith({ throw kotlinx.coroutines.CancellationException("gone") }, "t1", "u1") }
        }.exceptionOrNull()
        assertTrue(thrown is kotlinx.coroutines.CancellationException)
        assertEquals(LocaleProfileState.LOADING, store.state.value)
    }
}
