package com.medbrains.kit

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The same decisions the iOS HealthShare tests pin: units, bounds, batches, consent. */
class HealthShareTest {
    private fun reading(kind: HealthDataKind, value: Double? = null, bp: Pair<Double, Double>? = null, at: Long = 0) =
        HealthAppReading(kind, "id-$at-${kind.wire}", "2026-10-29T10:00:00Z", value, bp?.first, bp?.second).also { it.epochSeconds = at }

    @Test fun glucoseIsSentInMgPerDl() {
        assertEquals(99.1, HealthShare.glucoseMgDl(5.5), 0.1)
        assertFalse("mmol/L not converted", HealthShare.isPlausible(reading(HealthDataKind.GLUCOSE, 5.5)))
    }

    @Test fun implausibleReadingsAreNotSent() {
        assertTrue(HealthShare.isPlausible(reading(HealthDataKind.BLOOD_PRESSURE, bp = 128.0 to 82.0)))
        assertFalse(HealthShare.isPlausible(reading(HealthDataKind.BLOOD_PRESSURE, bp = 80.0 to 90.0)))
        assertFalse(HealthShare.isPlausible(reading(HealthDataKind.SPO2, 0.97)))
        assertFalse(HealthShare.isPlausible(reading(HealthDataKind.WEIGHT)))
    }

    @Test fun readingsGoInServerSizedBatches() {
        val many = (0 until 1201).map { reading(HealthDataKind.HEART_RATE, 70.0, at = it.toLong()) } + reading(HealthDataKind.SPO2, 12.0)
        assertEquals(listOf(500, 500, 201), HealthShare.batches(many).map { it.size })
    }

    @Test fun aWatchsHeartRateIsThinnedToOnePerHour() {
        val everyFive = (0 until 36).map { reading(HealthDataKind.HEART_RATE, 70.0, at = it * 300L) }
        assertEquals(listOf(0L, 3600L, 7200L), HealthShare.thinned(everyFive, 60).map { it.epochSeconds })
    }

    @Test fun nothingIsSharedUntilThePatientSaysSo() {
        val json = Json { ignoreUnknownKeys = true }
        val sharing = json.decodeFromString(HealthDataSharing.serializer(),
            """{"consents":[{"source":"health_connect","data_type":"glucose","granted":true,"recorded_at":"x"},{"source":"health_connect","data_type":"weight","granted":false,"recorded_at":"x"},{"source":"healthkit","data_type":"spo2","granted":true,"recorded_at":"x"}]}""")
        assertTrue(sharing.isShared(HealthDataKind.GLUCOSE))
        assertFalse(sharing.isShared(HealthDataKind.WEIGHT))
        assertFalse("per source", sharing.isShared(HealthDataKind.SPO2))
        assertFalse("never asked", sharing.isShared(HealthDataKind.HEART_RATE))
    }

    @Test fun theWireUsesTheServersNames() {
        val body = Json.encodeToString(HealthAppReading.serializer(), reading(HealthDataKind.HEART_RATE, 70.0))
        assertTrue(body, body.contains("\"data_type\":\"heart_rate\""))
        assertFalse("transient epoch stays on the phone", body.contains("epoch"))
    }
}
