package com.medbrains.staff.nurse

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.value
import com.medbrains.ui.CarbonPageHeader
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTone
import com.medbrains.ui.CarbonTonedTile
import com.medbrains.ui.CodeText
import com.medbrains.ui.RemoteContent
import kotlinx.coroutines.launch
import uniffi.edge_rn.nurseCallIsOverdue
import uniffi.edge_rn.nurseCallWaitLabel

/** A ward that has more than this waiting has a staffing problem, not a paging one. */
private const val PAGE_SIZE = 50

private val requestTypeLabel = mapOf(
    "bathroom_assist" to "Bathroom", "blanket_pillow" to "Blanket / pillow", "nurse_call" to "Nurse call",
    "other" to "Assistance", "pain_management" to "Pain", "position_change" to "Reposition", "water_food" to "Water / food",
)

private fun escalation(e: String): Pair<String, CarbonTone> = when (e) {
    "supervisor" -> "Supervisor" to CarbonTone.Danger
    "charge_nurse" -> "Charge nurse" to CarbonTone.Warning
    else -> "Waiting" to CarbonTone.Neutral
}

/**
 * The ward's open calls, on the phone that can answer them. **Seen** records
 * that a human has the call, **Done** that they went; the server keeps the
 * clock on `created_at` through both, so acknowledging never quiets the board.
 */
@Composable
fun NurseCallBoardScreen(api: NurseApi) {
    val identity = LocalIdentity.current
    val remote = remember { Remote<NurseCallBoard>() }
    val scope = rememberCoroutineScope()
    suspend fun load() = remote.load { api.listNurseCalls() }
    LaunchedEffect(Unit) { load() }
    val state by remote.state.collectAsState()
    val calls = state.value?.calls.orEmpty().take(PAGE_SIZE)
    val overdue = calls.count { nurseCallIsOverdue(it.escalation) }

    Column(Modifier.fillMaxSize().testTag("screen-nurse-calls")) {
        CarbonPageHeader("Nurse calls", "Open calls", "Every call still waiting, oldest first.") {
            if (overdue > 0) CarbonTag("$overdue overdue", CarbonTone.Danger)
        }
        RemoteContent(
            id = "nurse-calls", state = state,
            unavailableTitle = "Call board unavailable",
            unavailableMessage = "The ward's calls could not be loaded. Do not read this as a quiet ward — check the station board or the handset.",
            isEmpty = { it.calls.isEmpty() }, emptyTitle = "No open calls", emptyMessage = "Every call has been answered.",
            retry = { scope.launch { load() } },
        ) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(calls, key = { it.id }) { call ->
                    CallRow(api, call, canRespond = identity?.can("bedside.sessions.manage") == true) { scope.launch { load() } }
                }
            }
        }
    }
}

@Composable
private fun CallRow(api: NurseApi, call: ActiveNurseCall, canRespond: Boolean, onChanged: () -> Unit) {
    val (label, tone) = escalation(call.escalation)
    var busy by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    fun respond(status: String) {
        scope.launch {
            busy = true
            failure = null
            try {
                api.updateNurseCall(call.id, status)
                onChanged()
            } catch (e: Exception) {
                failure = "Not recorded — try again."
            } finally {
                // Unbusy on failure too: a button that never comes back reads as "it worked".
                busy = false
            }
        }
    }
    val bed = call.bed_number ?: "an unassigned bed"
    CarbonTonedTile(tone) {
        Row(Modifier.fillMaxWidth()) {
            Text((call.bed_number ?: "No bed") + (call.ward_name?.let { " · $it" } ?: ""), style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            CarbonTag(label, tone)
        }
        Text(requestTypeLabel[call.request_type] ?: "Assistance", style = MaterialTheme.typography.bodyLarge)
        call.notes?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        Text(nurseCallWaitLabel(call.waiting_seconds) + " waiting" + (if (call.acknowledged_at != null) " · seen" else ""), style = CodeText, color = MaterialTheme.colorScheme.onSurfaceVariant)
        failure?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
        if (canRespond) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (call.acknowledged_at == null) {
                    CarbonTertiaryButton("Seen", onClick = { respond("acknowledged") }, enabled = !busy,
                        modifier = Modifier.testTag("nurse-call-seen-${call.id}").semantics { contentDescription = "Mark the call from $bed as seen" })
                }
                CarbonPrimaryButton("Done", onClick = { respond("completed") }, enabled = !busy,
                    modifier = Modifier.weight(1f).testTag("nurse-call-done-${call.id}").semantics { contentDescription = "Mark the call from $bed as answered" })
            }
        }
    }
}
