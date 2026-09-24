package com.medbrains.patient

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonSectionTitle
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import uniffi.edge_rn.AdherenceEvent
import uniffi.edge_rn.DailyBrief
import uniffi.edge_rn.MedicationPlan
import uniffi.edge_rn.dailyBrief
import java.io.File

/**
 * The health record the companion keeps on the phone: a JSON file in the
 * app's private files, the same shape the React Native app wrote. A corrupt
 * or missing file reads as an empty record — the only place swallowing a
 * failure is right, because an empty local record claims nothing.
 */
@Serializable
data class HealthRecord(val medications: List<Medication> = emptyList(), val adherence: List<Adherence> = emptyList(), val observations: List<Observation> = emptyList()) {
    @Serializable data class Medication(val id: String, val name: String, val instructions: String = "", val times: List<String> = emptyList(), val startedOn: String, val endsOn: String? = null)
    @Serializable data class Adherence(val id: String, val planId: String, val scheduledFor: String, val status: String)
    @Serializable data class Observation(val id: String, val recordedAt: String)

    companion object {
        private val json = Json { ignoreUnknownKeys = true }
        fun load(dir: File): HealthRecord = runCatching {
            json.decodeFromString(serializer(), File(dir, "health-record.json").readText())
        }.getOrDefault(HealthRecord())
    }
}

private val CONFIDENCE = mapOf("calibrating" to "Still learning", "building" to "Building a baseline", "established" to "Established")

/** Health → Today: one number, one sentence, then the doses. The verdict is the clinical core's closed set. */
@Composable
fun HealthTab(openBands: () -> Unit) {
    val context = LocalContext.current
    var brief by remember { mutableStateOf<DailyBrief?>(null) }
    LaunchedEffect(Unit) {
        val r = HealthRecord.load(context.filesDir)
        brief = dailyBrief(
            r.medications.map { MedicationPlan(it.id, it.name, it.instructions, it.times, it.startedOn, it.endsOn) },
            r.adherence.map { AdherenceEvent(it.planId, it.scheduledFor, it.status) },
            r.observations.map { it.recordedAt },
            System.currentTimeMillis() / 1000,
        )
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("tab-health")) {
        brief?.let { b ->
            Column(Modifier.padding(16.dp)) {
                Text(b.adherencePercent?.let { "$it%" } ?: "—", style = MaterialTheme.typography.displaySmall, color = MaterialTheme.colorScheme.primary)
                Eyebrow("Taken this week")
                Text(b.verdict, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(top = 8.dp))
                Row(Modifier.padding(top = 8.dp)) {
                    CarbonTag(CONFIDENCE[b.confidence] ?: b.confidence, CarbonTone.Info)
                    if (b.streakDays > 0u) CarbonTag("${b.streakDays}-day streak", CarbonTone.Success, modifier = Modifier.padding(start = 8.dp))
                }
            }
            if (b.slots.isEmpty()) CarbonNotification(NotificationKind.Info, "Nothing scheduled today", "Medications you add will appear here at their times.", Modifier.padding(horizontal = 16.dp))
            b.slots.forEach { s ->
                CarbonTonedTile(if (s.status == "taken") CarbonTone.Success else CarbonTone.Neutral, Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Row(Modifier.fillMaxWidth()) {
                        Text(s.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                        CarbonTag(if (s.status == "taken") "taken" else if (s.status == "due") s.time else s.status, if (s.status == "taken") CarbonTone.Success else CarbonTone.Neutral)
                    }
                    if (s.instructions.isNotEmpty()) Text(s.instructions, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            CarbonSectionTitle("Bands")
            CarbonActionRow("Bands", "Where a wearable connects.", onClick = openBands, modifier = Modifier.fillMaxWidth().testTag("open-bands"))
        }
    }
}

/** Health → Bands: nothing pairs yet, and the screen says what will, which is a fact rather than a promise. */
@Composable
fun BandsScreen() {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-bands")) {
        CarbonPageHeader("Health", "Bands", "Where a wearable connects, and the truth about it.")
        CarbonNotification(NotificationKind.Info, "No band connected", "An Apple Watch, a Health Connect device or a MedBrains band will appear here once paired.", Modifier.padding(16.dp))
    }
}
