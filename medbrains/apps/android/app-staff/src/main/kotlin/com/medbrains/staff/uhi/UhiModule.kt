package com.medbrains.staff.uhi

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
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
import androidx.compose.ui.unit.dp
import com.medbrains.kit.LocalApiClient
import com.medbrains.kit.LocalIdentity
import com.medbrains.kit.Remote
import com.medbrains.kit.ServerTime
import com.medbrains.kit.TenantIdentity
import com.medbrains.kit.UhiRequests
import com.medbrains.kit.UhiRequestsApi
import com.medbrains.staff.shared.tokens.QueueActionState
import com.medbrains.ui.CarbonDangerButton
import com.medbrains.ui.CarbonNotification
import com.medbrains.ui.CarbonPrimaryButton
import com.medbrains.ui.CarbonTag
import com.medbrains.ui.CarbonTertiaryButton
import com.medbrains.ui.CarbonTextField
import com.medbrains.ui.Eyebrow
import com.medbrains.ui.NotificationKind
import com.medbrains.ui.RemoteContent
import com.medbrains.ui.carbon
import kotlinx.coroutines.launch

/** New requests arrive from patients' apps; the queue re-asks this often while open. */
private const val POLL_MS = 30_000L

/**
 * UHI requests: what patient apps booked or asked for through NHA's Unified
 * Health Interface, with state, payment and hold time. Accepting or declining
 * needs `uhi.requests.respond` and the service's own module permission,
 * exactly as the web and the server decide. The answer goes back to the app.
 */
@Composable
fun UhiModule() {
    val identity = LocalIdentity.current
    val api = UhiRequestsApi(LocalApiClient.current)
    val remote = remember { Remote<List<UhiRequests.Request>>() }
    val action = remember { QueueActionState() }
    var filter by remember { mutableStateOf(UhiRequests.Filter.Waiting) }
    var declining by remember { mutableStateOf<UhiRequests.Request?>(null) }
    val scope = rememberCoroutineScope()
    val canView = identity?.can(UhiRequests.Permission.VIEW) == true
    suspend fun load() { if (canView) remote.load { api.list(filter) } }
    // Restarts on a filter change and stops when the screen leaves: no poll outlives it.
    LaunchedEffect(filter) { if (canView) remote.poll(POLL_MS) { api.list(filter) } }
    val state by remote.state.collectAsState()
    val stale by remote.staleSince.collectAsState()
    fun answer(done: String, op: suspend () -> Unit) {
        scope.launch {
            action.run("Could not reach the hospital server.") { op(); done }
            load()
        }
    }

    Column(Modifier.fillMaxSize().testTag("module-home-uhi")) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
            Eyebrow("Module")
            Text("Bookings and requests from patient apps, through NHA's Unified Health Interface.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 16.dp).testTag("uhi-filter")) {
            UhiRequests.Filter.entries.forEachIndexed { i, f ->
                SegmentedButton(selected = filter == f, onClick = { filter = f }, shape = SegmentedButtonDefaults.itemShape(i, UhiRequests.Filter.entries.size), modifier = Modifier.testTag("uhi-filter-${f.name.lowercase()}")) { Text(f.label) }
            }
        }
        action.failure?.let { CarbonNotification(NotificationKind.Error, "That didn't go through", it, Modifier.padding(16.dp)) }
            ?: action.toast?.let { CarbonNotification(NotificationKind.Success, it, "The patient's app has been told.", Modifier.padding(16.dp).testTag("uhi-toast")) }
        if (stale != null) CarbonNotification(NotificationKind.Warning, "Showing the last list", "The latest refresh failed; this may be out of date.", Modifier.padding(16.dp))
        RemoteContent(
            id = "uhi-requests", state = state,
            unavailableTitle = "Could not load UHI requests", unavailableMessage = "This does not mean there are none — the list failed to load.",
            isEmpty = { it.isEmpty() },
            emptyTitle = if (filter == UhiRequests.Filter.Waiting) "Nothing is waiting for an answer" else "No requests yet",
            emptyMessage = "Requests from patients' apps appear here as they arrive.",
            retry = { scope.launch { load() } },
        ) { rows ->
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 32.dp)) {
                items(rows, key = { it.id }) { r ->
                    RequestRow(r, identity, busy = action.busy,
                        onAccept = { answer("Request accepted") { api.accept(r.id) } },
                        onDecline = { declining = r })
                }
            }
        }
    }
    declining?.let { r ->
        DeclineSheet(r, onClose = { declining = null }) { why -> answer("Request declined") { api.decline(r.id, why) }; declining = null }
    }
}

@Composable
private fun RequestRow(r: UhiRequests.Request, who: TenantIdentity?, busy: Boolean, onAccept: () -> Unit, onDecline: () -> Unit) {
    val state = UhiRequests.state(r.state)
    val secondary = MaterialTheme.colorScheme.onSurfaceVariant
    @Composable fun line(text: String) = Text(text, style = MaterialTheme.typography.bodyMedium, color = secondary)
    Column(Modifier.fillMaxWidth().padding(16.dp).testTag("uhi-request-${r.id}"), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(UhiRequests.serviceLabel(r.service), style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            Spacer(Modifier.width(8.dp))
            CarbonTag(state.text, state.tone.carbon)
        }
        line(ServerTime.short(r.confirmed_at ?: r.updated_at))
        Text(r.customer_name ?: "—", style = MaterialTheme.typography.bodyLarge)
        listOfNotNull(r.customer_phone, r.customer_abha).joinToString(" · ").takeIf { it.isNotEmpty() }?.let { line(it) }
        Text(r.summary.ifEmpty { "—" }, style = MaterialTheme.typography.bodyMedium)
        if (UhiRequests.isInAppointments(r)) line("In the OPD appointments for that day")
        if (r.lab_order_ids.isNotEmpty()) line("${r.lab_order_ids.size} lab orders placed")
        r.decline_reason?.let { line("Declined: $it") }
        if (r.state == UhiRequests.AWAITING_PAYMENT) r.hold_expires_at?.let { line("Slot let go at ${ServerTime.short(it)} unless paid") }
        UhiRequests.payment(r)?.let { pay ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                CarbonTag(pay.text, pay.tone.carbon)
                line(UhiRequests.amountLine(r))
            }
        }
        if (UhiRequests.mayAnswer(r, who)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CarbonPrimaryButton(UhiRequests.acceptLabel(r.service), onClick = onAccept, enabled = !busy, modifier = Modifier.weight(1f).testTag("uhi-accept-${r.id}"))
                CarbonTertiaryButton("Decline", onClick = onDecline, enabled = !busy, modifier = Modifier.testTag("uhi-decline-${r.id}"))
            }
        }
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}

/** Decline with the reason the patient's app will show, so they can look elsewhere. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DeclineSheet(r: UhiRequests.Request, onClose: () -> Unit, onDecline: (String) -> Unit) {
    var reason by remember { mutableStateOf("") }
    ModalBottomSheet(onDismissRequest = onClose) {
        Column(Modifier.fillMaxWidth().padding(16.dp).imePadding().navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Decline this request?", style = MaterialTheme.typography.titleLarge)
            Text("${UhiRequests.serviceLabel(r.service)} for ${r.customer_name ?: "the patient"}", style = MaterialTheme.typography.bodyLarge)
            CarbonTextField(reason, { reason = it }, "Reason the patient will see", Modifier.testTag("uhi-decline-reason"), singleLine = false)
            Text("For example: No ambulance free for the next hour.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            val why = UhiRequests.declineReason(reason)
            CarbonDangerButton("Decline", onClick = { why?.let(onDecline) }, enabled = why != null, modifier = Modifier.testTag("uhi-decline-confirm"))
            TextButton(onClick = onClose, modifier = Modifier.fillMaxWidth()) { Text("Cancel") }
        }
    }
}
