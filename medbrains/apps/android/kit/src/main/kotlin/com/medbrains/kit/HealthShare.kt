package com.medbrains.kit

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** The readings a patient can share from Health Connect, as the server names them. */
@Serializable
enum class HealthDataKind(val label: String) {
    @SerialName("blood_pressure") BLOOD_PRESSURE("Blood pressure"),
    @SerialName("glucose") GLUCOSE("Blood glucose"),
    @SerialName("weight") WEIGHT("Weight"),
    @SerialName("spo2") SPO2("Oxygen saturation (SpO₂)"),
    @SerialName("heart_rate") HEART_RATE("Heart rate");

    /** The wire name. */
    val wire: String get() = when (this) {
        BLOOD_PRESSURE -> "blood_pressure"; GLUCOSE -> "glucose"; WEIGHT -> "weight"; SPO2 -> "spo2"; HEART_RATE -> "heart_rate"
    }
}

/** One reading as the server takes it: glucose in mg/dL, weight in kg, SpO₂ in percent. */
@Serializable
data class HealthAppReading(
    val data_type: HealthDataKind,
    /** The record's own id in Health Connect, so sharing twice stores it once. */
    val external_id: String,
    /** RFC 3339. */
    val measured_at: String,
    val value: Double? = null,
    val systolic: Double? = null,
    val diastolic: Double? = null,
) {
    /** Epoch seconds, for thinning; filled by the reader. */
    @kotlinx.serialization.Transient var epochSeconds: Long = 0
}

@Serializable data class HealthDataConsent(val source: String, val data_type: String, val granted: Boolean, val recorded_at: String)

@Serializable
data class HealthDataSharing(val consents: List<HealthDataConsent> = emptyList()) {
    /** Whether `kind` is shared from Health Connect; nothing is until the patient says so. */
    fun isShared(kind: HealthDataKind, source: String = SOURCE): Boolean =
        consents.firstOrNull { it.source == source && it.data_type == kind.wire }?.granted ?: false

    companion object { const val SOURCE = "health_connect" }
}

@Serializable data class HealthRefused(val external_id: String, val reason: String)
@Serializable data class HealthReadingsResult(val accepted: Int, val duplicates: Int, val refused: List<HealthRefused> = emptyList())
@Serializable data class HealthConsentAsk(val source: String, val data_type: HealthDataKind, val granted: Boolean)
@Serializable data class HealthReadingsAsk(val source: String, val readings: List<HealthAppReading>)

object HealthShare {
    /** Readings per request (the server's limit). */
    const val MAX_BATCH = 500
    /** How far back a first share reaches (the server refuses older). */
    const val LOOKBACK_DAYS = 90L
    /** mg/dL per mmol/L of glucose. */
    const val GLUCOSE_MG_PER_MMOL = 18.0156
    /** One heart rate per this many minutes; a watch records every few. */
    const val HEART_RATE_EVERY_MINUTES = 60

    fun glucoseMgDl(mmolPerL: Double): Double = mmolPerL * GLUCOSE_MG_PER_MMOL

    /** The same bounds the server applies, so the phone does not send what will be refused. */
    fun isPlausible(r: HealthAppReading): Boolean {
        fun within(v: Double?, lo: Double, hi: Double) = v != null && v in lo..hi
        return when (r.data_type) {
            HealthDataKind.BLOOD_PRESSURE -> within(r.systolic, 50.0, 300.0) && within(r.diastolic, 20.0, 200.0) && (r.diastolic ?: 0.0) < (r.systolic ?: 0.0)
            HealthDataKind.GLUCOSE -> within(r.value, 10.0, 1000.0)
            HealthDataKind.WEIGHT -> within(r.value, 0.3, 400.0)
            HealthDataKind.SPO2 -> within(r.value, 50.0, 100.0)
            HealthDataKind.HEART_RATE -> within(r.value, 20.0, 300.0)
        }
    }

    /** The first reading in each `everyMinutes` window; input in time order. */
    fun thinned(readings: List<HealthAppReading>, everyMinutes: Int): List<HealthAppReading> {
        var lastKept: Long? = null
        return readings.filter { r ->
            val last = lastKept
            if (last != null && r.epochSeconds - last < everyMinutes * 60L) return@filter false
            lastKept = r.epochSeconds
            true
        }
    }

    /** Plausible readings in request-sized batches. */
    fun batches(readings: List<HealthAppReading>): List<List<HealthAppReading>> = readings.filter(::isPlausible).chunked(MAX_BATCH)
}
