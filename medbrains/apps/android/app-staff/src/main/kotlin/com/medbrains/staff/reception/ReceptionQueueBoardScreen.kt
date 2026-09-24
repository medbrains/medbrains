package com.medbrains.staff.reception

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
import com.medbrains.staff.doctor.DoctorApi
import com.medbrains.staff.doctor.WorklistToken
import com.medbrains.staff.doctor.tokenTone
import com.medbrains.ui.CarbonActionRow
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch

/**
 * The floor as the desk sees it, and one action: Call next. Who is next is
 * the server's decision under its lock, by priority, never a call per row.
 * An outage is never an empty floor.
 */
@Composable
fun ReceptionQueueBoardScreen(api: DoctorApi) {
    val identity = LocalIdentity.current
    val scope = rememberCoroutineScope()
    val queue = remember { Remote<List<WorklistToken>>() }
    var toast by remember { mutableStateOf<String?>(null) }
    var failure by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { queue.poll(5_000) { api.listWorklist() } }
    val state by queue.state.collectAsState()
    val waiting = state.value.orEmpty().count { it.status == "waiting" }

    Column(Modifier.fillMaxSize().testTag("screen-reception-queue")) {
        CarbonPageHeader("Reception", "Queue board", "Today's OPD tokens, oldest first.")
        if (identity?.can("opd.token.manage") == true) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                toast?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.testTag("queue-call-next-toast").semantics { liveRegion = LiveRegionMode.Polite }) }
                failure?.let { CarbonNotification(NotificationKind.Error, "Nobody called", it) }
                CarbonPrimaryButton("Call next ($waiting waiting)", enabled = !busy && waiting > 0, modifier = Modifier.testTag("queue-call-next"), onClick = {
                    scope.launch {
                        busy = true; failure = null
                        try {
                            val called = api.callNext()
                            toast = if (called != null) "Called the next patient" else "Nobody waiting"
                            queue.load { api.listWorklist() }
                        } catch (e: ApiError) { failure = e.message } catch (e: Exception) { failure = "Could not reach the hospital server. Nobody was called." } finally { busy = false }
                    }
                })
            }
        }
        RemoteContent("reception-queue", state, "Couldn't load the board", "The hospital server did not answer. Do not read this as an empty floor.", { it.isEmpty() }, "Nobody in the queue", "No OPD tokens today yet.", { scope.launch { queue.load { api.listWorklist() } } }) { rows ->
            LazyColumn(Modifier.fillMaxSize().testTag("reception-queue-tokens")) {
                items(rows, key = { it.id }) { t ->
                    CarbonActionRow("${t.number} · ${t.patient_name ?: "Unnamed patient"}", listOfNotNull(t.uhid, t.scope_label).joinToString(" · "), onClick = {}, modifier = Modifier.fillMaxWidth().testTag("queue-row-${t.patient_id ?: t.id}")) {
                        CarbonTag(t.status.replace('_', ' '), tokenTone(t.status))
                    }
                }
            }
        }
    }
}
