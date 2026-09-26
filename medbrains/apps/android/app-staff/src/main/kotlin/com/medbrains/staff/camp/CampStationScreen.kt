package com.medbrains.staff.camp

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.medbrains.kit.ApiError
import com.medbrains.kit.Remote
import com.medbrains.kit.value
import com.medbrains.staff.doctor.WorklistToken
import com.medbrains.staff.doctor.tokenTone
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPicker
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonRow
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.PickerOption
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/**
 * One camp station: its queue, one Call next, and what happened to the
 * patient in front of you. A step shared by two doctors asks which room you
 * are in, so the call tells the patient where to walk.
 */
@Composable
fun CampStationScreen(api: CampApi, station: CampStation, isLast: Boolean) {
    val scope = rememberCoroutineScope()
    val queue = remember { Remote<List<WorklistToken>>() }
    var room by remember { mutableStateOf<String?>(null) }
    var toast by remember { mutableStateOf<String?>(null) }
    var failure by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    LaunchedEffect(station.counter_id) { queue.poll(5_000) { api.queue(station) } }
    val state by queue.state.collectAsState()
    val waiting = state.value.orEmpty().count { it.status == "waiting" }
    val callingRoom = if (station.rooms.size > 1) room else station.rooms.firstOrNull() ?: station.name

    /** Runs one action; its answer is what the volunteer is told happened. */
    val act: (suspend () -> String) -> Unit = { call ->
        scope.launch {
            busy = true; failure = null
            try {
                toast = call()
                queue.load { api.queue(station) }
            } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. Nothing was changed." } finally { busy = false }
        }
    }

    Column(Modifier.fillMaxSize().testTag("screen-camp-station")) {
        CarbonPageHeader(station.camp_name, station.label, "Patients are called by the number they got at registration.")
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (station.rooms.size > 1) {
                CarbonPicker("Your room", station.rooms.map { PickerOption(it, it) }, room, { room = it }, placeholder = "Which room you call to", allowNone = false, tag = "camp-room-picker")
            }
            toast?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.testTag("camp-toast").semantics { liveRegion = LiveRegionMode.Polite }) }
            failure?.let { CarbonNotification(NotificationKind.Error, "Not done", it) }
            CarbonPrimaryButton("Call next ($waiting waiting)", enabled = !busy && waiting > 0 && callingRoom != null, modifier = Modifier.testTag("camp-call-next"), onClick = {
                act { if (api.callNext(station, callingRoom ?: station.name) == null) "Nobody waiting" else "Called the next patient" }
            })
        }
        RemoteContent("camp-queue", state, "Couldn't load this station", "The hospital server did not answer. Do not read this as an empty queue.", { it.isEmpty() }, "Nobody here yet", "Patients appear once the station before this one is done with them.", { scope.launch { queue.load { api.queue(station) } } }) { rows ->
            LazyColumn(Modifier.fillMaxSize().testTag("camp-queue-tokens")) {
                items(rows, key = { it.id }) { t -> TokenRow(t, isLast, busy, act, api) }
            }
        }
    }
}

@Composable
private fun TokenRow(t: WorklistToken, isLast: Boolean, busy: Boolean, act: (suspend () -> String) -> Unit, api: CampApi) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).testTag("camp-row-${t.number}")) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { CarbonRow("${t.number} · ${t.displayName}", t.counter_label) }
            CarbonTag(t.status.replace('_', ' '), tokenTone(t.status))
        }
        if (t.status == "called" || t.status == "serving") {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                CarbonPrimaryButton(if (isLast) "Done" else "Done — send on", enabled = !busy, modifier = Modifier.testTag("camp-complete-${t.number}"), onClick = {
                    act { api.complete(t.id); if (isLast) "Done" else "Sent to the next station" }
                })
                if (!isLast) {
                    CarbonTertiaryButton("Done — finished", enabled = !busy, modifier = Modifier.testTag("camp-finish-${t.number}"), onClick = {
                        act { api.finish(t.id); "Finished — not sent on" }
                    })
                }
                TextButton(onClick = { act { api.noShow(t.id); "Marked not here" } }, enabled = !busy, modifier = Modifier.testTag("camp-no-show-${t.number}")) { Text("Not here") }
            }
        }
    }
}
