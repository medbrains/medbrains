package com.medbrains.staff.reception

import com.medbrains.staff.shared.tokens.WorklistToken
import com.medbrains.staff.shared.tokens.tokenTone
import com.medbrains.staff.shared.tokens.countIn
import com.medbrains.staff.shared.tokens.TokenStatus
import com.medbrains.staff.shared.tokens.QueuePolling
import com.medbrains.staff.shared.tokens.QueueActionState
import com.medbrains.staff.shared.tokens.QueueSlice
import com.medbrains.staff.shared.tokens.TokenApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.medbrains.kit.ApiError
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.value
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPicker
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.PickerOption
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/**
 * The desk's department as the desk sees it, and one action: Call next. Who
 * is next is the server's decision under its lock, by priority, never a call
 * per row. An outage is never an empty floor. Never the whole hospital: a
 * large OPD runs past the server's page and the desk's patients fall off it.
 */
@Composable
fun ReceptionQueueBoardScreen(api: TokenApi, session: ReceptionSession) {
    val identity = LocalIdentity.current
    val scope = rememberCoroutineScope()
    val queue = remember { Remote<List<WorklistToken>>() }
    val action = remember { QueueActionState() }
    val dept = session.departmentId
    val slice = dept?.let { QueueSlice.Department(it) }
    LaunchedEffect(dept) { if (slice != null) queue.poll(QueuePolling.QUEUE_MS) { api.worklist(slice) } }
    val state by queue.state.collectAsState()
    val waiting = state.value.orEmpty().countIn(TokenStatus.WAITING)

    Column(Modifier.fillMaxSize().testTag("screen-reception-queue")) {
        CarbonPageHeader("Reception", "Queue board", "Today's OPD tokens for your department, oldest first.")
        CarbonPicker("Department", session.departments.map { PickerOption(it.id, it.name) }, dept, { session.departmentId = it }, Modifier.padding(horizontal = 16.dp), placeholder = "Choose the desk's department", allowNone = false, tag = "picker-board-department")
        if (identity?.can("opd.token.manage") == true) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                action.toast?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.testTag("queue-call-next-toast").semantics { liveRegion = LiveRegionMode.Polite }) }
                action.failure?.let { CarbonNotification(NotificationKind.Error, "Nobody called", it) }
                CarbonPrimaryButton("Call next ($waiting waiting)", enabled = !action.busy && waiting > 0 && slice != null, modifier = Modifier.testTag("queue-call-next"), onClick = {
                    val s = slice ?: return@CarbonPrimaryButton
                    scope.launch {
                        action.run("Could not reach the hospital server. Nobody was called.") {
                            val called = api.callNext(s)
                            queue.load { api.worklist(s) }
                            if (called != null) "Called the next patient" else "Nobody waiting"
                        }
                    }
                })
            }
        }
        if (slice == null && session.departmentsFailed) {
            CarbonNotification(NotificationKind.Error, "Couldn't load the board", "The hospital server did not answer. Do not read this as an empty floor.", Modifier.padding(16.dp).testTag("reception-queue-unavailable"))
            return@Column
        }
        if (slice == null) {
            Text("Choose the desk's department to see who is waiting for it.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(16.dp).testTag("reception-queue-choose-department"))
            return@Column
        }
        RemoteContent("reception-queue", state, "Couldn't load the board", "The hospital server did not answer. Do not read this as an empty floor.", { it.isEmpty() }, "Nobody in the queue", "No OPD tokens today yet.", { scope.launch { queue.load { api.worklist(slice) } } }) { rows ->
            LazyColumn(Modifier.fillMaxSize().testTag("reception-queue-tokens")) {
                items(rows, key = { it.id }) { t ->
                    CarbonActionRow("${t.number} · ${t.patient_name ?: "Unnamed patient"}", listOfNotNull(t.uhid, t.scope_label).joinToString(" · "), onClick = {}, modifier = Modifier.fillMaxWidth().testTag("queue-row-${t.patient_id ?: t.id}")) {
                        CarbonTag(TokenStatus.label(t.status), tokenTone(t.status))
                    }
                }
            }
        }
    }
}
