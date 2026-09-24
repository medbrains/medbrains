package com.medbrains.staff.nurse

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.medbrains.kit.ApiError
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import kotlinx.coroutines.launch
import uniffi.edge_rn.fallRiskMorseLevel

private class FormError(message: String) : Exception(message)

/** Bedside charting: vitals, intake/output, pain, fall risk, each admission-scoped. An empty field is not a zero. */
@Composable
fun BedsideActionScreen(api: NurseApi, admission: AdmissionRow, mode: String) {
    val form = remember { mutableStateMapOf<String, String>() }
    var direction by remember { mutableStateOf("intake") }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val (title, badge, tone) = when (mode) {
        "io" -> Triple("Intake / output", "I/O", CarbonTone.Success)
        "pain" -> Triple("Pain score", "PAIN", CarbonTone.Warning)
        "fall-risk" -> Triple("Fall risk", "FALL", CarbonTone.Info)
        else -> Triple("Vitals", "VITALS", CarbonTone.Info)
    }

    fun text(key: String) = form[key]?.trim()?.ifEmpty { null }
    fun int(key: String, label: String, range: IntRange? = null, required: Boolean = false): Int? {
        val t = text(key) ?: if (required) throw FormError("$label is required") else return null
        val n = t.toIntOrNull() ?: throw FormError("$label must be a number")
        if (range != null && n !in range) throw FormError("$label must be ${range.first}-${range.last}")
        return n
    }

    @Composable
    fun field(label: String, key: String, keyboard: KeyboardType, placeholder: String = "", modifier: Modifier = Modifier) {
        CarbonTextField(form[key] ?: "", { form[key] = it }, if (placeholder.isEmpty()) label else "$label — $placeholder", modifier.testTag("field-$key"), keyboardOptions = KeyboardOptions(keyboardType = keyboard))
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().testTag("screen-bedside-$mode")) {
        CarbonPageHeader("Nurse", title, "${admission.patient_name} · UHID ${admission.uhid}") { CarbonTag(badge, tone) }
        CarbonTonedTile(CarbonTone.Info, Modifier.padding(horizontal = 16.dp)) {
            Eyebrow("Context")
            Text(admission.bed_label ?: "Active admission", style = MaterialTheme.typography.titleMedium)
            Text("This entry is linked to encounter ${admission.encounter_id.take(8)} for audit and shift handover continuity.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            when (mode) {
                "vitals" -> {
                    field("Temperature", "temperature", KeyboardType.Decimal)
                    field("Pulse", "pulse", KeyboardType.Number)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { field("Systolic BP", "systolic_bp", KeyboardType.Number, modifier = Modifier.weight(1f)); field("Diastolic BP", "diastolic_bp", KeyboardType.Number, modifier = Modifier.weight(1f)) }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { field("SpO2", "spo2", KeyboardType.Number, modifier = Modifier.weight(1f)); field("Respiratory rate", "respiratory_rate", KeyboardType.Number, modifier = Modifier.weight(1f)) }
                    field("Notes", "notes", KeyboardType.Text)
                }
                "io" -> {
                    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                        listOf("intake" to "Intake", "output" to "Output").forEachIndexed { i, (v, label) ->
                            SegmentedButton(selected = direction == v, onClick = { direction = v }, shape = SegmentedButtonDefaults.itemShape(i, 2)) { Text(label) }
                        }
                    }
                    field("Category", "category", KeyboardType.Text, if (direction == "intake") "oral / IV / tube" else "urine / drain / emesis")
                    field("Volume ml", "volume_ml", KeyboardType.Number)
                    field("Notes", "notes", KeyboardType.Text)
                }
                "pain" -> {
                    field("Pain score 0-10", "score", KeyboardType.Number)
                    field("Location", "location", KeyboardType.Text)
                    field("Character", "character", KeyboardType.Text, "dull / sharp / burning")
                    field("Intervention", "intervention", KeyboardType.Text)
                }
                else -> {
                    field("Morse score", "score", KeyboardType.Number)
                    field("Interventions", "interventions", KeyboardType.Text, "bed low, call bell, non-skid socks")
                }
            }
            error?.let { CarbonNotification(NotificationKind.Error, "Not saved", it) }
            message?.let { CarbonNotification(NotificationKind.Success, "Saved", it) }
            CarbonPrimaryButton("Save", enabled = !busy, modifier = Modifier.testTag("bedside-save"), onClick = {
                scope.launch {
                    busy = true; error = null; message = null
                    try {
                        when (mode) {
                            "vitals" -> {
                                val temp = text("temperature")
                                if (temp != null && temp.toDoubleOrNull() == null) throw FormError("Temperature must be a number")
                                val p = CreateVitalsPayload(admission.encounter_id, temp, int("pulse", "Pulse", 0..300), int("systolic_bp", "Systolic BP", 0..300), int("diastolic_bp", "Diastolic BP", 0..200), int("respiratory_rate", "Respiratory rate", 0..80), int("spo2", "SpO2", 0..100), text("notes"))
                                if (listOf(p.temperature, p.pulse, p.systolic_bp, p.diastolic_bp, p.respiratory_rate, p.spo2).all { it == null }) throw FormError("Enter at least one vital reading")
                                api.createVitals(p); message = "Saved to bedside chart."
                            }
                            "io" -> {
                                val category = text("category") ?: throw FormError("Category is required")
                                api.createIoEntry(CreateIoEntryPayload(admission.encounter_id, category, direction, int("volume_ml", "Volume", required = true)!!, text("notes")))
                                message = "8h balance: ${api.ioBalance(admission.encounter_id).balance.toInt()} ml"
                            }
                            "pain" -> {
                                api.createPain(CreatePainEntryPayload(admission.encounter_id, "numeric", int("score", "Pain score", 0..10, required = true)!!, text("location"), text("character"), text("intervention")))
                                message = "Saved to bedside chart."
                            }
                            else -> {
                                val score = int("score", "Fall risk score", required = true)!!
                                val level = fallRiskMorseLevel(score.toLong())
                                api.createFallRisk(CreateFallRiskPayload(admission.encounter_id, "morse", score, level, text("interventions").orEmpty().split(",").map { it.trim() }.filter { it.isNotEmpty() }))
                                message = "Saved: $level risk."
                            }
                        }
                    } catch (e: FormError) { error = e.message } catch (e: Exception) { error = (e as? ApiError)?.message ?: "Could not reach the hospital server." } finally { busy = false }
                }
            })
        }
    }
}
