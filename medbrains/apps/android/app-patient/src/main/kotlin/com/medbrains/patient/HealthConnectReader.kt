package com.medbrains.patient

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.medbrains.kit.HealthAppReading
import com.medbrains.kit.HealthDataKind
import com.medbrains.kit.HealthShare
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlin.reflect.KClass

/**
 * Reads (never writes) the kinds of readings the patient chose to share from
 * Health Connect, since the last share. Each record keeps its Health Connect
 * id, so sharing twice stores it once on the server.
 */
class HealthConnectReader(private val context: Context) {
    private val prefs = context.getSharedPreferences("health-share", Context.MODE_PRIVATE)

    val isAvailable: Boolean get() = HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
    private val client by lazy { HealthConnectClient.getOrCreate(context) }

    suspend fun granted(): Set<String> = client.permissionController.getGrantedPermissions()

    /** Readings of `kind` since the last share (or the last 90 days). */
    suspend fun readings(kind: HealthDataKind): List<HealthAppReading> {
        val since = Instant.ofEpochSecond(prefs.getLong(anchor(kind), Instant.now().minus(HealthShare.LOOKBACK_DAYS, ChronoUnit.DAYS).epochSecond))
        return when (kind) {
            HealthDataKind.BLOOD_PRESSURE -> read(BloodPressureRecord::class, since).map {
                reading(kind, it.metadata.id, it.time, systolic = it.systolic.inMillimetersOfMercury, diastolic = it.diastolic.inMillimetersOfMercury)
            }
            HealthDataKind.GLUCOSE -> read(BloodGlucoseRecord::class, since).map { reading(kind, it.metadata.id, it.time, it.level.inMilligramsPerDeciliter) }
            HealthDataKind.WEIGHT -> read(WeightRecord::class, since).map { reading(kind, it.metadata.id, it.time, it.weight.inKilograms) }
            HealthDataKind.SPO2 -> read(OxygenSaturationRecord::class, since).map { reading(kind, it.metadata.id, it.time, it.percentage.value) }
            HealthDataKind.HEART_RATE -> HealthShare.thinned(
                read(HeartRateRecord::class, since).flatMap { rec ->
                    rec.samples.mapIndexed { i, s -> reading(kind, "${rec.metadata.id}:$i", s.time, s.beatsPerMinute.toDouble()) }
                }.sortedBy { it.epochSeconds },
                HealthShare.HEART_RATE_EVERY_MINUTES,
            )
        }
    }

    /** Remember that `kind` was shared up to `through`. */
    fun markShared(kind: HealthDataKind, throughEpochSeconds: Long) {
        prefs.edit().putLong(anchor(kind), throughEpochSeconds + 1).apply()
    }

    private fun anchor(kind: HealthDataKind) = "shared-through.${kind.wire}"

    private suspend fun <T : Record> read(type: KClass<T>, since: Instant): List<T> {
        val out = mutableListOf<T>()
        var page: String? = null
        do {
            val res = client.readRecords(ReadRecordsRequest(type, TimeRangeFilter.after(since), pageToken = page))
            out += res.records
            page = res.pageToken
        } while (page != null && out.size < MAX_RECORDS_PER_KIND)
        return out
    }

    private fun reading(kind: HealthDataKind, id: String, at: Instant, value: Double? = null, systolic: Double? = null, diastolic: Double? = null) =
        HealthAppReading(kind, id, at.toString(), value, systolic, diastolic).also { it.epochSeconds = at.epochSecond }

    companion object {
        /** Records read per kind in one share; older ones follow next time. */
        const val MAX_RECORDS_PER_KIND = 5_000

        /** The Health Connect read permission behind a kind of reading. */
        fun permission(kind: HealthDataKind): String = HealthPermission.getReadPermission(
            when (kind) {
                HealthDataKind.BLOOD_PRESSURE -> BloodPressureRecord::class
                HealthDataKind.GLUCOSE -> BloodGlucoseRecord::class
                HealthDataKind.WEIGHT -> WeightRecord::class
                HealthDataKind.SPO2 -> OxygenSaturationRecord::class
                HealthDataKind.HEART_RATE -> HeartRateRecord::class
            },
        )
    }
}
