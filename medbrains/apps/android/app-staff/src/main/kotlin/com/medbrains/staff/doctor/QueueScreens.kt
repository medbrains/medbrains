package com.medbrains.staff.doctor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.medbrains.kit.ApiError
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.ServerTime
import com.medbrains.kit.value
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/**
 * Today's OPD queue — the unified queue the waiting-room board shows.
 * "Call next" lets the server pick under its lock; a client choosing a row
 * would race another desk and call one patient twice.
 */
@Composable
fun QueueListScreen(nav: NavHostController, api: DoctorApi, session: DoctorSession) {
    val identity = LocalIdentity.current
    val remote = remember { Remote<List<WorklistToken>>() }
    var calling by remember { mutableStateOf(false) }
    var callError by remember { mutableStateOf<String?>(null) }
    var toast by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    suspend fun load() = remote.load { api.listWorklist().also { rows -> rows.forEach { session.tokens[it.id] = it } } }
    LaunchedEffect(Unit) { load() }
    val state by remote.state.collectAsState()
    val waiting = state.value.orEmpty().count { it.status == "waiting" }

    Column(Modifier.fillMaxSize().testTag("screen-doctor-queue")) {
        CarbonPageHeader("Doctor", "OPD queue", "Today's tokens — tap a row to begin a consult.")
        if (identity?.can("opd.token.manage") == true) {
            Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                CarbonPrimaryButton(
                    if (waiting > 0) "Call next ($waiting waiting)" else "Call next",
                    enabled = !calling,
                    modifier = Modifier.testTag("queue-call-next").semantics { contentDescription = if (waiting > 0) "Call the next patient, $waiting waiting" else "Call the next patient, nobody waiting" },
                    onClick = {
                        scope.launch {
                            calling = true; callError = null
                            try {
                                val called = api.callNext()
                                // Null is a real answer, not a failure: the queue is empty.
                                toast = if (called != null) "Called the next patient" else "Nobody is waiting"
                                load()
                            } catch (e: Exception) { callError = (e as? ApiError)?.message ?: "Could not reach the hospital server." } finally { calling = false }
                        }
                    },
                )
                callError?.let { CarbonNotification(NotificationKind.Error, "Could not call the next patient", it) }
                // The confirmation is the point: a call that says nothing is a call the doctor presses twice.
                toast?.let { CarbonNotification(NotificationKind.Info, it, "", Modifier.testTag("queue-call-next-toast")) }
            }
        }
        RemoteContent(
            id = "doctor-queue", state = state,
            unavailableTitle = "Couldn't load the queue", unavailableMessage = "Today's tokens could not be loaded. Do not read this as an empty clinic.",
            isEmpty = { it.isEmpty() }, emptyTitle = "Queue is empty", emptyMessage = "No tokens issued for today yet.",
            retry = { scope.launch { load() } },
        ) { rows ->
            LazyColumn(Modifier.fillMaxSize().testTag("queue-tokens"), contentPadding = PaddingValues(bottom = 32.dp)) {
                items(rows, key = { it.id }) { token ->
                    // Keyed by patient, not position: a queue reorders as it advances.
                    CarbonActionRow(token.displayName, "UHID ${token.uhid ?: "—"} · TOKEN ${token.number}", onClick = { nav.navigate("queue/${token.id}") },
                        modifier = Modifier.fillMaxWidth().testTag("queue-row-${token.patient_id ?: token.id}")) {
                        CarbonTag(token.status, tokenTone(token.status))
                    }
                }
            }
        }
    }
}

/**
 * One token's call / serve / complete state machine. All three transitions
 * take `opd.token.manage`, which is what the server checks; the consultation
 * takes `opd.visit.update`. A recall IS a call.
 */
@Composable
fun QueueDetailScreen(nav: NavHostController, api: DoctorApi, initial: WorklistToken) {
    val identity = LocalIdentity.current
    var token by remember { mutableStateOf(initial) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val canWork = identity?.can("opd.token.manage") == true
    fun run(op: suspend () -> ModuleToken) {
        scope.launch {
            busy = true; error = null
            try {
                val next = op()
                token = token.copy(status = next.status, called_at = next.called_at ?: token.called_at, counter_label = next.counter_label ?: token.counter_label)
            } catch (e: Exception) { error = (e as? ApiError)?.message ?: "Could not reach the hospital server." } finally { busy = false }
        }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).testTag("screen-queue-detail"), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        CarbonPageHeader("Queue", token.displayName, "UHID ${token.uhid ?: "—"} · Token ${token.number}")
        CarbonTonedTile(tokenTone(token.status), Modifier.padding(horizontal = 16.dp)) {
            Eyebrow("Status")
            Text(token.status, style = MaterialTheme.typography.titleMedium)
            Text("Last action: ${ServerTime.short(token.called_at ?: token.created_at)}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CarbonTag("token ${token.number}", mono = true)
                CarbonTag(token.priority, CarbonTone.Info, mono = true)
            }
        }
        error?.let { CarbonNotification(NotificationKind.Error, "Action failed", it, Modifier.padding(horizontal = 16.dp)) }
        Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (token.status == "waiting" && canWork) CarbonPrimaryButton("Call patient", enabled = !busy, modifier = Modifier.testTag("queue-call-patient"), onClick = { run { api.call(token.id) } })
            if (token.status == "called" && canWork) {
                CarbonPrimaryButton("Patient is in", enabled = !busy, modifier = Modifier.testTag("queue-patient-is-in"), onClick = { run { api.serve(token.id) } })
                CarbonTertiaryButton("Recall", enabled = !busy, modifier = Modifier.fillMaxWidth().testTag("queue-recall-patient").semantics { contentDescription = "Call this token again" }, onClick = { run { api.call(token.id) } })
                CarbonTertiaryButton("No-show", enabled = !busy, modifier = Modifier.fillMaxWidth().testTag("queue-no-show").semantics { contentDescription = "Mark this patient as not present" }, onClick = { run { api.noShow(token.id) } })
            }
            if (token.status == "serving" && canWork) CarbonPrimaryButton("Mark complete", enabled = !busy, modifier = Modifier.testTag("queue-mark-complete"), onClick = { run { api.complete(token.id) } })
            if (identity?.can("opd.visit.update") == true) {
                CarbonTertiaryButton("Consultation", enabled = !busy, modifier = Modifier.fillMaxWidth().testTag("queue-open-consultation").semantics { contentDescription = "Open the consultation for this patient" }, onClick = { nav.navigate("consultation/${token.id}") })
            }
            TextButton(onClick = { nav.popBackStack() }, enabled = !busy, modifier = Modifier.testTag("screen-back")) { Text("Back to queue") }
        }
    }
}
