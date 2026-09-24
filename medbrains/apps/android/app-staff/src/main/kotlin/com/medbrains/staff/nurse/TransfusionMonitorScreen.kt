package com.medbrains.staff.nurse

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.medbrains.kit.ApiError
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.RemoteState
import com.medbrains.kit.ServerTime
import com.medbrains.kit.value
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.CodeText
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch
import uniffi.edge_rn.transfusionIsRunning
import uniffi.edge_rn.transfusionPhaseStates
import java.time.Instant

private val phaseLabel = mapOf("baseline" to "Before starting", "fifteen_min" to "15 minutes in", "periodic" to "Hourly", "completion" to "At the end")

/**
 * The transfusions running on this bed and the observations they owe. The
 * fifteen-minute check is called out by name and goes red when it is late.
 * `reaction_suspected` is read, never computed.
 */
@Composable
fun TransfusionMonitorScreen(api: NurseApi, admission: AdmissionRow) {
    val identity = LocalIdentity.current
    val remote = remember { Remote<List<BedsideTransfusion>>() }
    val scope = rememberCoroutineScope()
    suspend fun load() = remote.load { api.listTransfusions(admission.id) }
    LaunchedEffect(Unit) { load() }
    val state by remote.state.collectAsState()

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-transfusions")) {
        CarbonPageHeader("Transfusion", admission.patient_name, admission.bedLine)
        RemoteContent(
            id = "transfusions", state = state,
            unavailableTitle = "Couldn't load the transfusion chart", unavailableMessage = "Do not read this as nothing running; check the bedside chart.",
            isEmpty = { it.isEmpty() }, emptyTitle = "No transfusions", emptyMessage = "Nothing has been hung on this bed.",
            retry = { scope.launch { load() } },
        ) { units ->
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                units.forEach { unit -> TransfusionCard(api, unit, identity?.can("nurse.transfusion.administer") == true) { scope.launch { load() } } }
            }
        }
    }
}

@Composable
private fun TransfusionCard(api: NurseApi, unit: BedsideTransfusion, canRecord: Boolean, onChanged: () -> Unit) {
    val observations = remember { Remote<List<TransfusionObservation>>() }
    LaunchedEffect(unit.id) { observations.load { api.listObservations(unit.id) } }
    val obsState by observations.state.collectAsState()
    val charted = obsState.value.orEmpty()
    val started = ServerTime.parse(unit.transfusion_start_time)?.epochSecond
    val ended = unit.transfusion_end_time != null
    val running = transfusionIsRunning(started, ended)
    val suspected = charted.any { it.reaction_suspected }
    val states = transfusionPhaseStates(started, ended, charted.map { it.phase }, Instant.now().epochSecond)
    var phase by remember { mutableStateOf<String?>(null) }
    var failure by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val tone = if (suspected) CarbonTone.Danger else if (running) CarbonTone.Success else CarbonTone.Neutral

    CarbonTonedTile(tone) {
        Row(Modifier.fillMaxWidth()) {
            Text("${unit.product_type ?: "Unit"} · ${unit.blood_group ?: "?"}" + (unit.rh_factor?.let { " $it" } ?: ""), style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            CarbonTag(if (suspected) "reaction suspected" else if (running) "running" else "finished", tone)
        }
        Text("BAG ${unit.bag_number ?: "—"}", style = CodeText, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (suspected) Text("Stop the transfusion, keep the line open, and call the doctor. Return the bag and the giving set to the blood bank.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.error)
        // A chart that cannot be read is not an empty chart.
        if (obsState is RemoteState.Failed) {
            CarbonNotification(NotificationKind.Error, "Observations unavailable", "What is outstanding is unknown.")
        } else {
            states.forEach { s ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(phaseLabel[s.phase] ?: s.phase, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    CarbonTag(if (s.recorded) "charted" else if (s.overdue) "overdue" else "due later", if (s.recorded) CarbonTone.Success else if (s.overdue) CarbonTone.Danger else CarbonTone.Neutral)
                }
            }
        }
        failure?.let { CarbonNotification(NotificationKind.Error, "Not saved", it) }
        if (canRecord && running && phase == null) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                states.filter { it.phase != "completion" }.forEach { s ->
                    val label = phaseLabel[s.phase] ?: s.phase
                    if (s.overdue) CarbonPrimaryButton(label, onClick = { phase = s.phase }) else CarbonTertiaryButton(label, onClick = { phase = s.phase }, modifier = Modifier.fillMaxWidth())
                }
                CarbonTertiaryButton("Finish unit", onClick = { phase = "completion" }, modifier = Modifier.fillMaxWidth())
            }
        }
        phase?.let { p ->
            if (canRecord) ObservationForm(api, unit.id, p, onCancel = { phase = null }) { wasCompletion ->
                phase = null
                scope.launch {
                    observations.load { api.listObservations(unit.id) }
                    if (wasCompletion) try { api.completeTransfusion(unit.id); onChanged() } catch (e: Exception) { failure = (e as? ApiError)?.message ?: "The unit could not be closed." }
                }
            }
        }
    }
}

/** One set of observations. Every field is optional except the signs tick: an empty field is not a zero. */
@Composable
private fun ObservationForm(api: NurseApi, transfusionId: String, phase: String, onCancel: () -> Unit, onRecorded: (Boolean) -> Unit) {
    var temperature by remember { mutableStateOf("") }
    var pulse by remember { mutableStateOf("") }
    var systolic by remember { mutableStateOf("") }
    var diastolic by remember { mutableStateOf("") }
    var adverse by remember { mutableStateOf(false) }
    var notes by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    fun num(s: String): Double? = s.replace(',', '.').toDoubleOrNull()
    Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(phaseLabel[phase] ?: phase, style = MaterialTheme.typography.titleSmall)
        CarbonTextField(temperature, { temperature = it }, "Temperature (°C)", keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
        CarbonTextField(pulse, { pulse = it }, "Pulse", keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CarbonTextField(systolic, { systolic = it }, "Systolic", Modifier.weight(1f), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
            CarbonTextField(diastolic, { diastolic = it }, "Diastolic", Modifier.weight(1f), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = adverse, onCheckedChange = { adverse = it })
            Text("Rigors, rash, breathlessness or back pain", style = MaterialTheme.typography.bodyLarge)
        }
        CarbonTextField(notes, { notes = it }, "Notes")
        failure?.let { CarbonNotification(NotificationKind.Error, "Not saved", it) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CarbonPrimaryButton("Save", enabled = !busy, modifier = Modifier.weight(1f), onClick = {
                scope.launch {
                    busy = true; failure = null
                    try {
                        api.recordObservation(transfusionId, RecordObservationPayload(phase, num(temperature), num(pulse)?.toInt(), num(systolic)?.toInt(), num(diastolic)?.toInt(), adverse, notes.ifBlank { null }))
                        onRecorded(phase == "completion")
                    } catch (e: Exception) { failure = (e as? ApiError)?.message ?: "The observations could not be saved." } finally { busy = false }
                }
            })
            TextButton(onClick = onCancel) { Text("Cancel") }
        }
    }
}
